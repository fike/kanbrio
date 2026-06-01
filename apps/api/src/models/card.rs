use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct ChecklistItem {
    pub id: Uuid,
    pub card_id: Uuid,
    pub title: String,
    pub is_completed: bool,
    pub position: i32,
    pub completed_by: Option<Uuid>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Card {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub workspace_id: Uuid,
    pub title: String,
    pub current_column_id: Uuid,
    pub current_swimlane_id: Uuid,
    pub assigned_user_id: Option<Uuid>,
    pub is_blocked: bool,
    pub blocked_by: Option<Uuid>,
    pub blocked_at: Option<DateTime<Utc>>,
    pub blocked_reason: Option<String>,
    pub is_archived: bool,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCard {
    pub parent_id: Option<Uuid>,
    pub workspace_id: Uuid,
    pub title: String,
    pub current_column_id: Uuid,
    pub current_swimlane_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CardHierarchy {
    #[serde(flatten)]
    pub card: Card,
    pub children: Vec<CardHierarchy>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct BlockComment {
    pub id: Uuid,
    pub card_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Represents a card row from the recursive hierarchy CTE query.
/// All fields are Option because CTE columns are considered nullable by PostgreSQL.
#[derive(Debug, sqlx::FromRow, Clone)]
pub struct CardHierarchyRow {
    pub id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub workspace_id: Option<Uuid>,
    pub title: Option<String>,
    pub current_column_id: Option<Uuid>,
    pub current_swimlane_id: Option<Uuid>,
    pub assigned_user_id: Option<Uuid>,
    pub is_blocked: Option<bool>,
    pub blocked_by: Option<Uuid>,
    pub blocked_at: Option<DateTime<Utc>>,
    pub blocked_reason: Option<String>,
    pub is_archived: Option<bool>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

impl CardHierarchyRow {
    #[allow(clippy::wrong_self_convention)]
    fn to_card(self) -> Option<Card> {
        Some(Card {
            id: self.id?,
            parent_id: self.parent_id,
            workspace_id: self.workspace_id?,
            title: self.title?,
            current_column_id: self.current_column_id?,
            current_swimlane_id: self.current_swimlane_id?,
            assigned_user_id: self.assigned_user_id,
            is_blocked: self.is_blocked?,
            blocked_by: self.blocked_by,
            blocked_at: self.blocked_at,
            blocked_reason: self.blocked_reason,
            is_archived: self.is_archived?,
            deleted_at: self.deleted_at,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BlockCardPayload {
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnblockCardPayload {}

#[derive(Debug, Serialize, Deserialize)]
pub struct BlockCommentPayload {
    pub content: String,
}

use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct MoveCard {
    pub card_id: Uuid,
    pub workspace_id: Uuid, // Security: Required for isolation
    pub to_column_id: Uuid,
    pub to_swimlane_id: Uuid,
    pub user_id: Option<Uuid>,
    pub override_rules: Option<bool>,
    pub override_reason: Option<String>,
}

impl Card {
    #[tracing::instrument(skip(pool))]
    #[allow(clippy::collapsible_if)]
    pub async fn move_to(pool: &sqlx::PgPool, data: MoveCard) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;

        // 1. Get current state with workspace isolation
        let current_card = sqlx::query_as!(
            Card,
            "SELECT * FROM cards WHERE id = $1 AND workspace_id = $2 FOR UPDATE",
            data.card_id,
            data.workspace_id
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => crate::AppError::NotFound,
            _ => crate::AppError::Database(e),
        })?;

        if current_card.is_blocked {
            return Err(crate::AppError::CardIsBlocked(format!(
                "Card '{}' is blocked and cannot be moved",
                current_card.title
            )));
        }

        // 2. Validate target column/swimlane workspace alignment
        let target_col_ws_row = sqlx::query!(
            "SELECT workspace_id FROM columns WHERE id = $1",
            data.to_column_id
        )
        .fetch_one(&mut *tx)
        .await?;

        let target_lane_ws_row = sqlx::query!(
            "SELECT workspace_id FROM swimlanes WHERE id = $1",
            data.to_swimlane_id
        )
        .fetch_one(&mut *tx)
        .await?;

        if target_col_ws_row.workspace_id != data.workspace_id
            || target_lane_ws_row.workspace_id != data.workspace_id
        {
            return Err(anyhow::anyhow!(
                "Target column or swimlane belongs to a different workspace"
            )
            .into());
        }

        // --- 3.5 Arrival & Departure Rules (Issue #31) ---
        let mut is_admin = false;
        if let Some(user_id) = data.user_id {
            let role_res = sqlx::query!(
                "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
                data.workspace_id,
                user_id
            )
            .fetch_one(&mut *tx)
            .await;
            if let Ok(role) = role_res {
                is_admin = role.role == "admin";
            }
        }

        let is_override = is_admin && data.override_rules.unwrap_or(false);

        // Only enforce if the column has actually changed and override is NOT active
        if current_card.current_column_id != data.to_column_id && !is_override {
            // Validate Departure Rules of the source column
            let departure_rules: Vec<crate::models::board::TransitionRule> = sqlx::query_as!(
                crate::models::board::TransitionRule,
                "SELECT * FROM transition_rules WHERE column_id = $1 AND rule_type = 'departure'",
                current_card.current_column_id
            )
            .fetch_all(&mut *tx)
            .await?;

            for rule in departure_rules {
                Self::evaluate_rule(&mut tx, &current_card, &rule).await?;
            }

            // Validate Arrival Rules of the target column
            let arrival_rules: Vec<crate::models::board::TransitionRule> = sqlx::query_as!(
                crate::models::board::TransitionRule,
                "SELECT * FROM transition_rules WHERE column_id = $1 AND rule_type = 'arrival'",
                data.to_column_id
            )
            .fetch_all(&mut *tx)
            .await?;

            for rule in arrival_rules {
                Self::evaluate_rule(&mut tx, &current_card, &rule).await?;
            }
        }

        // 3. WIP Limit Validation (Issue #4)
        // Security/SRE: Lock the column conditionally to prevent race conditions during WIP count
        let wip_limit_check_row = sqlx::query!(
            "SELECT wip_limit FROM columns WHERE id = $1",
            data.to_column_id
        )
        .fetch_one(&mut *tx)
        .await?;

        if let Some(limit) = wip_limit_check_row.wip_limit {
            let _wip_limit_row = sqlx::query!(
                "SELECT wip_limit FROM columns WHERE id = $1 FOR UPDATE",
                data.to_column_id
            )
            .fetch_one(&mut *tx)
            .await?;

            // Only enforce if moving from a different column
            if current_card.current_column_id != data.to_column_id {
                let current_count_row =
                    sqlx::query!(
                        "SELECT COUNT(*) FROM cards WHERE current_column_id = $1 AND is_archived = false AND deleted_at IS NULL AND id != $2",
                        data.to_column_id,
                        data.card_id
                    )
                    .fetch_one(&mut *tx)
                    .await?;

                if current_count_row.count.unwrap_or(0) >= limit as i64 {
                    tracing::warn!(
                        column_id = ?data.to_column_id,
                        card_id = ?data.card_id,
                        limit = limit,
                        "WIP limit exceeded for column"
                    );
                    return Err(crate::AppError::WipLimitExceeded {
                        entity: "column".to_string(),
                        limit,
                    });
                }
            }
        }

        let swimlane_wip_limit_check = sqlx::query!(
            "SELECT wip_limit FROM swimlanes WHERE id = $1",
            data.to_swimlane_id
        )
        .fetch_one(&mut *tx)
        .await?;

        if let Some(limit) = swimlane_wip_limit_check.wip_limit {
            let _swimlane_wip_limit = sqlx::query!(
                "SELECT wip_limit FROM swimlanes WHERE id = $1 FOR UPDATE",
                data.to_swimlane_id
            )
            .fetch_one(&mut *tx)
            .await?;

            // Only enforce if moving from a different swimlane
            if current_card.current_swimlane_id != data.to_swimlane_id {
                let current_count_row =
                    sqlx::query!(
                        "SELECT COUNT(*) FROM cards WHERE current_swimlane_id = $1 AND is_archived = false AND deleted_at IS NULL AND id != $2",
                        data.to_swimlane_id,
                        data.card_id
                    )
                    .fetch_one(&mut *tx)
                    .await?;

                if current_count_row.count.unwrap_or(0) >= limit as i64 {
                    tracing::warn!(
                        swimlane_id = ?data.to_swimlane_id,
                        card_id = ?data.card_id,
                        limit = limit,
                        "WIP limit exceeded for swimlane"
                    );
                    return Err(crate::AppError::WipLimitExceeded {
                        entity: "swimlane".to_string(),
                        limit,
                    });
                }
            }
        }

        let source_col_row = sqlx::query!(
            "SELECT is_done FROM columns WHERE id = $1",
            current_card.current_column_id
        )
        .fetch_one(&mut *tx)
        .await?;
        let target_col_row = sqlx::query!(
            "SELECT is_done FROM columns WHERE id = $1",
            data.to_column_id
        )
        .fetch_one(&mut *tx)
        .await?;

        if let Some(target_user) = current_card.assigned_user_id {
            if source_col_row.is_done && !target_col_row.is_done {
                let member: crate::models::user::WorkspaceMember = sqlx::query_as!(
                    crate::models::user::WorkspaceMember,
                    "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 FOR UPDATE",
                    data.workspace_id,
                    target_user
                )
                .fetch_one(&mut *tx)
                .await?;

                if let Some(limit) = member.wip_limit {
                    let active_count_row = sqlx::query!(
                        r#"
                        SELECT COUNT(*)
                        FROM cards c
                        INNER JOIN columns col ON c.current_column_id = col.id
                        WHERE c.assigned_user_id = $1
                          AND c.workspace_id = $2
                          AND col.is_done = FALSE
                          AND c.is_archived = FALSE
                          AND c.deleted_at IS NULL
                          AND c.id != $3
                        "#,
                        target_user,
                        data.workspace_id,
                        data.card_id
                    )
                    .fetch_one(&mut *tx)
                    .await?;

                    if active_count_row.count.unwrap_or(0) >= limit as i64 {
                        return Err(crate::AppError::WipLimitExceeded {
                            entity: "user".to_string(),
                            limit,
                        });
                    }
                }
            }
        }

        // 4. Perform the move
        let updated_card = sqlx::query_as!(
            Card,
            r#"
            UPDATE cards
            SET current_column_id = $1, current_swimlane_id = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
            "#,
            data.to_column_id,
            data.to_swimlane_id,
            data.card_id
        )
        .fetch_one(&mut *tx)
        .await?;

        // 5. Log transition (Issue #3)
        let transition_type = if is_override {
            "move_override".to_string()
        } else {
            "move".to_string()
        };

        sqlx::query!(
            r#"
            INSERT INTO card_transitions (
                card_id, user_id, transition_type,
                from_column_id, to_column_id,
                from_swimlane_id, to_swimlane_id,
                payload
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
            updated_card.id,
            data.user_id,
            transition_type,
            current_card.current_column_id,
            updated_card.current_column_id,
            current_card.current_swimlane_id,
            updated_card.current_swimlane_id,
            serde_json::json!({
                "from_column_id": current_card.current_column_id,
                "to_column_id": updated_card.current_column_id,
                "from_swimlane_id": current_card.current_swimlane_id,
                "to_swimlane_id": updated_card.current_swimlane_id,
                "is_override": is_override,
                "override_reason": data.override_reason
            })
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(updated_card)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn create(pool: &sqlx::PgPool, data: CreateCard) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;

        // 1. Validate parent workspace alignment
        if let Some(parent_id) = data.parent_id {
            let parent_workspace_id_row =
                sqlx::query!("SELECT workspace_id FROM cards WHERE id = $1", parent_id)
                    .fetch_one(&mut *tx)
                    .await
                    .map_err(|e| match e {
                        sqlx::Error::RowNotFound => crate::AppError::NotFound,
                        _ => crate::AppError::Database(e),
                    })?;

            if parent_workspace_id_row.workspace_id != data.workspace_id {
                return Err(anyhow::anyhow!("Parent card belongs to a different workspace").into());
            }
        }

        // 2. WIP Limit Validation (Issue #4)
        // Lock the column conditionally to prevent race conditions
        let wip_limit_check_row = sqlx::query!(
            "SELECT wip_limit FROM columns WHERE id = $1",
            data.current_column_id
        )
        .fetch_one(&mut *tx)
        .await?;

        if let Some(limit) = wip_limit_check_row.wip_limit {
            let _wip_limit_row = sqlx::query!(
                "SELECT wip_limit FROM columns WHERE id = $1 FOR UPDATE",
                data.current_column_id
            )
            .fetch_one(&mut *tx)
            .await?;

            let current_count_row = sqlx::query!(
                "SELECT COUNT(*) FROM cards WHERE current_column_id = $1 AND is_archived = false AND deleted_at IS NULL",
                data.current_column_id
            )
            .fetch_one(&mut *tx)
            .await?;

            if current_count_row.count.unwrap_or(0) >= limit as i64 {
                tracing::warn!(
                    column_id = ?data.current_column_id,
                    workspace_id = ?data.workspace_id,
                    limit = limit,
                    "WIP limit exceeded for column on card creation"
                );
                return Err(crate::AppError::WipLimitExceeded {
                    entity: "column".to_string(),
                    limit,
                });
            }
        }

        let swimlane_wip_limit_check_row = sqlx::query!(
            "SELECT wip_limit FROM swimlanes WHERE id = $1",
            data.current_swimlane_id
        )
        .fetch_one(&mut *tx)
        .await?;

        if let Some(limit) = swimlane_wip_limit_check_row.wip_limit {
            let _swimlane_wip_limit_row = sqlx::query!(
                "SELECT wip_limit FROM swimlanes WHERE id = $1 FOR UPDATE",
                data.current_swimlane_id
            )
            .fetch_one(&mut *tx)
            .await?;

            let current_count_row = sqlx::query!(
                "SELECT COUNT(*) FROM cards WHERE current_swimlane_id = $1 AND is_archived = false AND deleted_at IS NULL",
                data.current_swimlane_id
            )
            .fetch_one(&mut *tx)
            .await?;

            if current_count_row.count.unwrap_or(0) >= limit as i64 {
                tracing::warn!(
                    swimlane_id = ?data.current_swimlane_id,
                    workspace_id = ?data.workspace_id,
                    limit = limit,
                    "WIP limit exceeded for swimlane on card creation"
                );
                return Err(crate::AppError::WipLimitExceeded {
                    entity: "swimlane".to_string(),
                    limit,
                });
            }
        }

        let card = sqlx::query_as!(
            Card,
            r#"
            INSERT INTO cards (parent_id, workspace_id, title, current_column_id, current_swimlane_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
            data.parent_id,
            data.workspace_id,
            data.title,
            data.current_column_id,
            data.current_swimlane_id
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO card_transitions (card_id, transition_type, to_column_id, payload)
            VALUES ($1, 'create', $2, $3)
            "#,
            card.id,
            card.current_column_id,
            serde_json::json!({
                "title": card.title,
                "workspace_id": card.workspace_id
            })
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(card)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn update_title(
        &self,
        pool: &sqlx::PgPool,
        new_title: String,
    ) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;
        let old_title = self.title.clone();

        let updated = sqlx::query_as!(
            Card,
            "UPDATE cards SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            new_title,
            self.id
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            "INSERT INTO card_transitions (card_id, transition_type, payload) VALUES ($1, 'update', $2)",
            self.id,
            serde_json::json!({ "previous_title": old_title, "new_title": updated.title })
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn block(
        &self,
        pool: &sqlx::PgPool,
        blocked_by: Uuid,
        reason: String,
    ) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;

        // 1. SELECT FOR UPDATE to lock row
        let current_card = sqlx::query_as!(
            Card,
            "SELECT * FROM cards WHERE id = $1 FOR UPDATE",
            self.id
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => crate::AppError::NotFound,
            _ => crate::AppError::Database(e),
        })?;

        if current_card.is_blocked {
            return Ok(current_card);
        }

        // 2. Perform block update
        let updated = sqlx::query_as!(
            Card,
            r#"
            UPDATE cards
            SET is_blocked = TRUE, blocked_by = $1, blocked_at = NOW(), blocked_reason = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
            "#,
            blocked_by,
            reason,
            self.id
        )
        .fetch_one(&mut *tx)
        .await?;

        // 3. Insert transition
        sqlx::query!(
            "INSERT INTO card_transitions (card_id, user_id, transition_type, payload) VALUES ($1, $2, 'block', $3)",
            self.id,
            blocked_by,
            serde_json::json!({ "reason": reason })
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn unblock(
        &self,
        pool: &sqlx::PgPool,
        unblocked_by: Uuid,
    ) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;

        // 1. SELECT FOR UPDATE to lock row
        let current_card = sqlx::query_as!(
            Card,
            "SELECT * FROM cards WHERE id = $1 FOR UPDATE",
            self.id
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => crate::AppError::NotFound,
            _ => crate::AppError::Database(e),
        })?;

        if !current_card.is_blocked {
            return Ok(current_card);
        }

        // 2. Perform unblock update
        let updated = sqlx::query_as!(
            Card,
            r#"
            UPDATE cards
            SET is_blocked = FALSE, blocked_by = NULL, blocked_at = NULL, blocked_reason = NULL, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
            self.id
        )
        .fetch_one(&mut *tx)
        .await?;

        // 3. Insert transition
        sqlx::query!(
            "INSERT INTO card_transitions (card_id, user_id, transition_type) VALUES ($1, $2, 'unblock')",
            self.id,
            unblocked_by
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn get_block_comments(
        pool: &sqlx::PgPool,
        card_id: Uuid,
    ) -> Result<Vec<BlockComment>, crate::AppError> {
        let comments = sqlx::query_as!(
            BlockComment,
            "SELECT * FROM card_block_comments WHERE card_id = $1 ORDER BY created_at ASC",
            card_id
        )
        .fetch_all(pool)
        .await?;

        Ok(comments)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn add_block_comment(
        pool: &sqlx::PgPool,
        card_id: Uuid,
        user_id: Uuid,
        content: String,
    ) -> Result<BlockComment, crate::AppError> {
        let trimmed = content.trim();
        if trimmed.is_empty() {
            return Err(crate::AppError::BadRequest(
                "Comment content cannot be empty".to_string(),
            ));
        }

        let mut tx = pool.begin().await?;

        let card = sqlx::query_as!(
            Card,
            "SELECT * FROM cards WHERE id = $1 FOR UPDATE",
            card_id
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => crate::AppError::NotFound,
            _ => crate::AppError::Database(e),
        })?;

        if !card.is_blocked {
            return Err(crate::AppError::BadRequest(
                "Cannot comment on an unblocked card".to_string(),
            ));
        }

        let comment = sqlx::query_as!(
            BlockComment,
            r#"
            INSERT INTO card_block_comments (card_id, user_id, content)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
            card_id,
            user_id,
            trimmed
        )
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(comment)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn archive(&self, pool: &sqlx::PgPool) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;

        let updated = sqlx::query_as!(
            Card,
            "UPDATE cards SET is_archived = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *",
            self.id
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            "INSERT INTO card_transitions (card_id, transition_type) VALUES ($1, 'archive')",
            self.id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn delete(&self, pool: &sqlx::PgPool) -> Result<(), crate::AppError> {
        let mut tx = pool.begin().await?;

        // Soft delete
        sqlx::query!("UPDATE cards SET deleted_at = NOW() WHERE id = $1", self.id)
            .execute(&mut *tx)
            .await?;

        sqlx::query!(
            "INSERT INTO card_transitions (card_id, transition_type) VALUES ($1, 'delete')",
            self.id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(())
    }

    #[tracing::instrument(skip(pool))]
    pub async fn get_hierarchy(
        pool: &sqlx::PgPool,
        root_id: Uuid,
    ) -> Result<CardHierarchy, crate::AppError> {
        let rows = sqlx::query_as!(
            CardHierarchyRow,
            r#"
            WITH RECURSIVE hierarchy AS (
                -- Base case
                SELECT *, 1 as depth, ARRAY[id] as path FROM cards
                WHERE id = $1 AND deleted_at IS NULL
                UNION ALL
                -- Recursive step with depth limit and cycle detection
                SELECT c.*, h.depth + 1, h.path || c.id
                FROM cards c
                INNER JOIN hierarchy h ON c.parent_id = h.id
                WHERE h.depth < 10            -- SRE: Depth limit
                AND NOT (c.id = ANY(h.path))  -- Security: Cycle detection
                AND c.deleted_at IS NULL      -- SRE: Exclude deleted
            )
            SELECT id, parent_id, workspace_id, title, current_column_id, current_swimlane_id, assigned_user_id, is_blocked, blocked_by, blocked_at, blocked_reason, is_archived, deleted_at, created_at, updated_at
            FROM hierarchy
            "#,
            root_id
        )
        .fetch_all(pool)
        .await?;

        if rows.is_empty() {
            return Err(crate::AppError::NotFound);
        }

        // Build the tree structure efficiently using a HashMap O(N)
        let mut nodes_by_parent: HashMap<Option<Uuid>, Vec<Card>> = HashMap::new();
        let mut root_card = None;

        for row in rows {
            let card = row.to_card().ok_or(crate::AppError::NotFound)?;
            if card.id == root_id {
                root_card = Some(card.clone());
            }
            nodes_by_parent
                .entry(card.parent_id)
                .or_default()
                .push(card);
        }

        let root_card = root_card.ok_or(crate::AppError::NotFound)?;

        fn build_tree(
            current: Card,
            nodes_by_parent: &HashMap<Option<Uuid>, Vec<Card>>,
        ) -> CardHierarchy {
            let children = nodes_by_parent
                .get(&Some(current.id))
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .map(|c| build_tree(c, nodes_by_parent))
                .collect();

            CardHierarchy {
                card: current,
                children,
            }
        }

        Ok(build_tree(root_card, &nodes_by_parent))
    }

    /// Safely assigns a card to a user after verifying multi-tenant boundaries and user WIP limits.
    #[tracing::instrument(skip(pool))]
    #[allow(clippy::too_many_arguments, clippy::collapsible_if)]
    pub async fn assign_to(
        pool: &sqlx::PgPool,
        workspace_id: Uuid,
        actor_id: Uuid,
        card_id: Uuid,
        assignee_id: Option<Uuid>,
        is_admin: bool,
        override_limit: bool,
        override_reason: Option<String>,
    ) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;

        // First, perform a lightweight, non-locking select
        let card_workspace_row =
            sqlx::query!("SELECT workspace_id FROM cards WHERE id = $1", card_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| match e {
                    sqlx::Error::RowNotFound => crate::AppError::NotFound,
                    _ => crate::AppError::Database(e),
                })?;

        if card_workspace_row.workspace_id != workspace_id {
            return Err(crate::AppError::Forbidden);
        }

        // Then, lock the row using SELECT * FROM cards WHERE id = $1 AND workspace_id = $2 FOR UPDATE
        let card = sqlx::query_as!(
            Card,
            "SELECT * FROM cards WHERE id = $1 AND workspace_id = $2 FOR UPDATE",
            card_id,
            workspace_id
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => crate::AppError::NotFound,
            _ => crate::AppError::Database(e),
        })?;

        // 2. Determine target column's completed state
        let target_col_row = sqlx::query!(
            "SELECT is_done FROM columns WHERE id = $1 AND workspace_id = $2",
            card.current_column_id,
            workspace_id
        )
        .fetch_one(&mut *tx)
        .await?;

        let is_target_active = !target_col_row.is_done;

        if let Some(target_user) = assignee_id {
            // 3. Pessimistic lock on the user's membership to serialize parallel assignments
            let member: crate::models::user::WorkspaceMember = sqlx::query_as!(
                crate::models::user::WorkspaceMember,
                "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 FOR UPDATE",
                workspace_id,
                target_user
            )
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => crate::AppError::BadRequest("Target assignee is not a workspace member".into()),
                _ => crate::AppError::Database(e),
            })?;

            // 4. Enforce User WIP Limit only if target column is active
            if is_target_active {
                if let Some(limit) = member.wip_limit {
                    if !override_limit || !is_admin {
                        // Count active cards assigned to this user in active columns
                        let active_count_row = sqlx::query!(
                            r#"
                            SELECT COUNT(*)
                            FROM cards c
                            INNER JOIN columns col ON c.current_column_id = col.id
                            WHERE c.assigned_user_id = $1
                              AND c.workspace_id = $2
                              AND col.is_done = FALSE
                              AND c.is_archived = FALSE
                              AND c.deleted_at IS NULL
                              AND c.id != $3
                            "#,
                            target_user,
                            workspace_id,
                            card_id
                        )
                        .fetch_one(&mut *tx)
                        .await?;

                        let active_count = active_count_row.count.unwrap_or(0);
                        if active_count >= limit as i64 {
                            tracing::warn!(
                                user_id = ?target_user,
                                limit = limit,
                                active_count = active_count,
                                "User WIP limit exceeded"
                            );
                            return Err(crate::AppError::WipLimitExceeded {
                                entity: "user".to_string(),
                                limit,
                            });
                        }
                    }
                }
            }
        }

        // 5. Update card's assignee
        let updated_card = sqlx::query_as!(
            Card,
            r#"
            UPDATE cards
            SET assigned_user_id = $1, updated_at = NOW()
            WHERE id = $2 AND workspace_id = $3
            RETURNING *
            "#,
            assignee_id,
            card_id,
            workspace_id
        )
        .fetch_one(&mut *tx)
        .await?;

        // 6. Record transition event
        let transition_type = if override_limit && is_admin {
            "assign_override".to_string()
        } else {
            "assign".to_string()
        };

        let payload = serde_json::json!({
            "previous_assignee": card.assigned_user_id,
            "new_assignee": assignee_id,
            "override_reason": override_reason
        });

        sqlx::query!(
            r#"
            INSERT INTO card_transitions (card_id, user_id, transition_type, payload)
            VALUES ($1, $2, $3, $4)
            "#,
            card_id,
            actor_id,
            transition_type,
            payload
        )
        .bind(payload)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated_card)
    }

    async fn evaluate_rule(
        conn: &mut sqlx::PgConnection,
        card: &Card,
        rule: &crate::models::board::TransitionRule,
    ) -> Result<(), crate::AppError> {
        match rule.criteria_type.as_str() {
            "assignee_required" if card.assigned_user_id.is_none() => {
                tracing::warn!(
                    card_id = ?card.id,
                    workspace_id = ?card.workspace_id,
                    column_id = ?rule.column_id,
                    criteria_type = ?rule.criteria_type,
                    "Transition rule violation: Assignee is required"
                );
                return Err(crate::AppError::RuleViolation(
                    "Assignee is required".into(),
                ));
            }
            "checklist_completed" => {
                let uncompleted_count_row = sqlx::query!(
                    "SELECT COUNT(*) FROM card_checklists WHERE card_id = $1 AND is_completed = FALSE",
                    card.id
                )
                .fetch_one(conn)
                .await?;

                if uncompleted_count_row.count.unwrap_or(0) > 0 {
                    tracing::warn!(
                        card_id = ?card.id,
                        workspace_id = ?card.workspace_id,
                        column_id = ?rule.column_id,
                        criteria_type = ?rule.criteria_type,
                        uncompleted_checklist_count = uncompleted_count_row.count.unwrap_or(0),
                        "Transition rule violation: Uncompleted checklist items"
                    );
                    return Err(crate::AppError::RuleViolation(
                        "All checklist items must be completed".into(),
                    ));
                }
            }
            "subtasks_completed" => {
                let active_children_row = sqlx::query!(
                    r#"
                    SELECT COUNT(*)
                    FROM cards c
                    INNER JOIN columns col ON c.current_column_id = col.id
                    WHERE c.parent_id = $1 AND col.is_done = FALSE AND c.deleted_at IS NULL
                    "#,
                    card.id
                )
                .fetch_one(conn)
                .await?;

                let active_children = active_children_row.count.unwrap_or(0);
                if active_children > 0 {
                    tracing::warn!(
                        card_id = ?card.id,
                        workspace_id = ?card.workspace_id,
                        column_id = ?rule.column_id,
                        criteria_type = ?rule.criteria_type,
                        active_subtasks_count = active_children,
                        "Transition rule violation: Active subtasks remaining"
                    );
                    return Err(crate::AppError::RuleViolation(
                        "All subtasks must be completed".into(),
                    ));
                }
            }
            _ => {}
        }
        Ok(())
    }
}
