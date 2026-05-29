use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

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
    pub is_archived: bool,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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

use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct MoveCard {
    pub card_id: Uuid,
    pub workspace_id: Uuid, // Security: Required for isolation
    pub to_column_id: Uuid,
    pub to_swimlane_id: Uuid,
    pub user_id: Option<Uuid>,
}

impl Card {
    #[tracing::instrument(skip(pool))]
    #[allow(clippy::collapsible_if)]
    pub async fn move_to(pool: &sqlx::PgPool, data: MoveCard) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;

        // 1. Get current state with workspace isolation
        let current_card = sqlx::query_as::<_, Card>(
            "SELECT * FROM cards WHERE id = $1 AND workspace_id = $2 FOR UPDATE",
        )
        .bind(data.card_id)
        .bind(data.workspace_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => crate::AppError::NotFound,
            _ => crate::AppError::Database(e),
        })?;

        // 2. Validate target column/swimlane workspace alignment
        let target_col_ws: (Uuid,) =
            sqlx::query_as("SELECT workspace_id FROM columns WHERE id = $1")
                .bind(data.to_column_id)
                .fetch_one(&mut *tx)
                .await?;

        let target_lane_ws: (Uuid,) =
            sqlx::query_as("SELECT workspace_id FROM swimlanes WHERE id = $1")
                .bind(data.to_swimlane_id)
                .fetch_one(&mut *tx)
                .await?;

        if target_col_ws.0 != data.workspace_id || target_lane_ws.0 != data.workspace_id {
            return Err(anyhow::anyhow!(
                "Target column or swimlane belongs to a different workspace"
            )
            .into());
        }

        // 3. WIP Limit Validation (Issue #4)
        // Security/SRE: Lock the column to prevent race conditions during WIP count
        let wip_limit: (Option<i32>,) =
            sqlx::query_as("SELECT wip_limit FROM columns WHERE id = $1 FOR UPDATE")
                .bind(data.to_column_id)
                .fetch_one(&mut *tx)
                .await?;

        if let Some(limit) = wip_limit.0 {
            // Only enforce if moving from a different column
            if current_card.current_column_id != data.to_column_id {
                let current_count: (i64,) =
                    sqlx::query_as("SELECT COUNT(*) FROM cards WHERE current_column_id = $1 AND is_archived = false AND deleted_at IS NULL AND id != $2")
                        .bind(data.to_column_id)
                        .bind(data.card_id)
                        .fetch_one(&mut *tx)
                        .await?;

                if current_count.0 >= limit as i64 {
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

        let swimlane_wip_limit: (Option<i32>,) =
            sqlx::query_as("SELECT wip_limit FROM swimlanes WHERE id = $1 FOR UPDATE")
                .bind(data.to_swimlane_id)
                .fetch_one(&mut *tx)
                .await?;

        if let Some(limit) = swimlane_wip_limit.0 {
            // Only enforce if moving from a different swimlane
            if current_card.current_swimlane_id != data.to_swimlane_id {
                let current_count: (i64,) =
                    sqlx::query_as("SELECT COUNT(*) FROM cards WHERE current_swimlane_id = $1 AND is_archived = false AND deleted_at IS NULL AND id != $2")
                        .bind(data.to_swimlane_id)
                        .bind(data.card_id)
                        .fetch_one(&mut *tx)
                        .await?;

                if current_count.0 >= limit as i64 {
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

        let source_col: (bool,) = sqlx::query_as("SELECT is_done FROM columns WHERE id = $1")
            .bind(current_card.current_column_id)
            .fetch_one(&mut *tx)
            .await?;
        let target_col: (bool,) = sqlx::query_as("SELECT is_done FROM columns WHERE id = $1")
            .bind(data.to_column_id)
            .fetch_one(&mut *tx)
            .await?;

        if let Some(target_user) = current_card.assigned_user_id {
            if source_col.0 && !target_col.0 {
                let member: crate::models::user::WorkspaceMember = sqlx::query_as(
                    "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 FOR UPDATE"
                )
                .bind(data.workspace_id)
                .bind(target_user)
                .fetch_one(&mut *tx)
                .await?;

                if let Some(limit) = member.wip_limit {
                    let active_count: (i64,) = sqlx::query_as(
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
                    )
                    .bind(target_user)
                    .bind(data.workspace_id)
                    .bind(data.card_id)
                    .fetch_one(&mut *tx)
                    .await?;

                    if active_count.0 >= limit as i64 {
                        return Err(crate::AppError::WipLimitExceeded {
                            entity: "user".to_string(),
                            limit,
                        });
                    }
                }
            }
        }

        // 4. Perform the move
        let updated_card = sqlx::query_as::<_, Card>(
            r#"
            UPDATE cards
            SET current_column_id = $1, current_swimlane_id = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
            "#,
        )
        .bind(data.to_column_id)
        .bind(data.to_swimlane_id)
        .bind(data.card_id)
        .fetch_one(&mut *tx)
        .await?;

        // 5. Log transition (Issue #3)
        sqlx::query(
            r#"
            INSERT INTO card_transitions (
                card_id, user_id, transition_type,
                from_column_id, to_column_id,
                from_swimlane_id, to_swimlane_id,
                payload
            )
            VALUES ($1, $2, 'move', $3, $4, $5, $6, $7)
            "#,
        )
        .bind(updated_card.id)
        .bind(data.user_id)
        .bind(current_card.current_column_id)
        .bind(updated_card.current_column_id)
        .bind(current_card.current_swimlane_id)
        .bind(updated_card.current_swimlane_id)
        .bind(serde_json::json!({
            "from_column_id": current_card.current_column_id,
            "to_column_id": updated_card.current_column_id,
            "from_swimlane_id": current_card.current_swimlane_id,
            "to_swimlane_id": updated_card.current_swimlane_id
        }))
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
            let parent_workspace_id: (Uuid,) =
                sqlx::query_as("SELECT workspace_id FROM cards WHERE id = $1")
                    .bind(parent_id)
                    .fetch_one(&mut *tx)
                    .await
                    .map_err(|e| match e {
                        sqlx::Error::RowNotFound => crate::AppError::NotFound,
                        _ => crate::AppError::Database(e),
                    })?;

            if parent_workspace_id.0 != data.workspace_id {
                return Err(anyhow::anyhow!("Parent card belongs to a different workspace").into());
            }
        }

        // 2. WIP Limit Validation (Issue #4)
        // Lock the column to prevent race conditions
        let wip_limit: (Option<i32>,) =
            sqlx::query_as("SELECT wip_limit FROM columns WHERE id = $1 FOR UPDATE")
                .bind(data.current_column_id)
                .fetch_one(&mut *tx)
                .await?;

        if let Some(limit) = wip_limit.0 {
            let current_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM cards WHERE current_column_id = $1 AND is_archived = false AND deleted_at IS NULL",
            )
            .bind(data.current_column_id)
            .fetch_one(&mut *tx)
            .await?;

            if current_count.0 >= limit as i64 {
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

        let swimlane_wip_limit: (Option<i32>,) =
            sqlx::query_as("SELECT wip_limit FROM swimlanes WHERE id = $1 FOR UPDATE")
                .bind(data.current_swimlane_id)
                .fetch_one(&mut *tx)
                .await?;

        if let Some(limit) = swimlane_wip_limit.0 {
            let current_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM cards WHERE current_swimlane_id = $1 AND is_archived = false AND deleted_at IS NULL",
            )
            .bind(data.current_swimlane_id)
            .fetch_one(&mut *tx)
            .await?;

            if current_count.0 >= limit as i64 {
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

        let card = sqlx::query_as::<_, Card>(
            r#"
            INSERT INTO cards (parent_id, workspace_id, title, current_column_id, current_swimlane_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#
        )
        .bind(data.parent_id)
        .bind(data.workspace_id)
        .bind(data.title)
        .bind(data.current_column_id)
        .bind(data.current_swimlane_id)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO card_transitions (card_id, transition_type, to_column_id, payload)
            VALUES ($1, 'create', $2, $3)
            "#,
        )
        .bind(card.id)
        .bind(card.current_column_id)
        .bind(serde_json::json!({
            "title": card.title,
            "workspace_id": card.workspace_id
        }))
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

        let updated = sqlx::query_as::<_, Card>(
            "UPDATE cards SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        )
        .bind(new_title)
        .bind(self.id)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO card_transitions (card_id, transition_type, payload) VALUES ($1, 'update', $2)"
        )
        .bind(self.id)
        .bind(serde_json::json!({ "previous_title": old_title, "new_title": updated.title }))
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn block(
        &self,
        pool: &sqlx::PgPool,
        reason: String,
    ) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;

        let updated = sqlx::query_as::<_, Card>(
            "UPDATE cards SET is_blocked = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(self.id)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO card_transitions (card_id, transition_type, payload) VALUES ($1, 'block', $2)"
        )
        .bind(self.id)
        .bind(serde_json::json!({ "reason": reason }))
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn unblock(&self, pool: &sqlx::PgPool) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;

        let updated = sqlx::query_as::<_, Card>(
            "UPDATE cards SET is_blocked = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(self.id)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO card_transitions (card_id, transition_type) VALUES ($1, 'unblock')",
        )
        .bind(self.id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn archive(&self, pool: &sqlx::PgPool) -> Result<Self, crate::AppError> {
        let mut tx = pool.begin().await?;

        let updated = sqlx::query_as::<_, Card>(
            "UPDATE cards SET is_archived = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *",
        )
        .bind(self.id)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO card_transitions (card_id, transition_type) VALUES ($1, 'archive')",
        )
        .bind(self.id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated)
    }

    #[tracing::instrument(skip(pool))]
    pub async fn delete(&self, pool: &sqlx::PgPool) -> Result<(), crate::AppError> {
        let mut tx = pool.begin().await?;

        // Soft delete
        sqlx::query("UPDATE cards SET deleted_at = NOW() WHERE id = $1")
            .bind(self.id)
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            "INSERT INTO card_transitions (card_id, transition_type) VALUES ($1, 'delete')",
        )
        .bind(self.id)
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
        let rows = sqlx::query_as::<_, Card>(
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
            SELECT id, parent_id, workspace_id, title, current_column_id, current_swimlane_id, assigned_user_id, is_blocked, is_archived, deleted_at, created_at, updated_at
            FROM hierarchy
            "#
        )
        .bind(root_id)
        .fetch_all(pool)
        .await?;

        if rows.is_empty() {
            return Err(crate::AppError::NotFound);
        }

        // Build the tree structure efficiently using a HashMap O(N)
        let mut nodes_by_parent: HashMap<Option<Uuid>, Vec<Card>> = HashMap::new();
        let mut root_card = None;

        for row in rows {
            if row.id == root_id {
                root_card = Some(row.clone());
            }
            nodes_by_parent.entry(row.parent_id).or_default().push(row);
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
        let card_workspace: (Uuid,) =
            sqlx::query_as("SELECT workspace_id FROM cards WHERE id = $1")
                .bind(card_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| match e {
                    sqlx::Error::RowNotFound => crate::AppError::NotFound,
                    _ => crate::AppError::Database(e),
                })?;

        if card_workspace.0 != workspace_id {
            return Err(crate::AppError::Forbidden);
        }

        // Then, lock the row using SELECT * FROM cards WHERE id = $1 AND workspace_id = $2 FOR UPDATE
        let card = sqlx::query_as::<_, Card>(
            "SELECT * FROM cards WHERE id = $1 AND workspace_id = $2 FOR UPDATE",
        )
        .bind(card_id)
        .bind(workspace_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => crate::AppError::NotFound,
            _ => crate::AppError::Database(e),
        })?;

        // 2. Determine target column's completed state
        let target_col: (bool,) =
            sqlx::query_as("SELECT is_done FROM columns WHERE id = $1 AND workspace_id = $2")
                .bind(card.current_column_id)
                .bind(workspace_id)
                .fetch_one(&mut *tx)
                .await?;

        let is_target_active = !target_col.0;

        if let Some(target_user) = assignee_id {
            // 3. Pessimistic lock on the user's membership to serialize parallel assignments
            let member: crate::models::user::WorkspaceMember = sqlx::query_as(
                "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 FOR UPDATE"
            )
            .bind(workspace_id)
            .bind(target_user)
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
                        let active_count: (i64,) = sqlx::query_as(
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
                        )
                        .bind(target_user)
                        .bind(workspace_id)
                        .bind(card_id)
                        .fetch_one(&mut *tx)
                        .await?;

                        if active_count.0 >= limit as i64 {
                            tracing::warn!(
                                user_id = ?target_user,
                                limit = limit,
                                active_count = active_count.0,
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
        let updated_card = sqlx::query_as::<_, Card>(
            r#"
            UPDATE cards
            SET assigned_user_id = $1, updated_at = NOW()
            WHERE id = $2 AND workspace_id = $3
            RETURNING *
            "#,
        )
        .bind(assignee_id)
        .bind(card_id)
        .bind(workspace_id)
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

        sqlx::query(
            r#"
            INSERT INTO card_transitions (card_id, user_id, transition_type, payload)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(card_id)
        .bind(actor_id) // Transition actor
        .bind(transition_type)
        .bind(payload)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(updated_card)
    }
}
