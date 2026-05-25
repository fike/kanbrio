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

        // 3. Perform the move
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

        // 3. Log transition (Issue #3)
        sqlx::query(
            r#"
            INSERT INTO card_transitions (
                card_id, user_id, transition_type, 
                from_column_id, to_column_id, 
                from_swimlane_id, to_swimlane_id
            )
            VALUES ($1, $2, 'move', $3, $4, $5, $6)
            "#,
        )
        .bind(updated_card.id)
        .bind(data.user_id)
        .bind(current_card.current_column_id)
        .bind(updated_card.current_column_id)
        .bind(current_card.current_swimlane_id)
        .bind(updated_card.current_swimlane_id)
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
            INSERT INTO card_transitions (card_id, transition_type, to_column_id)
            VALUES ($1, 'create', $2)
            "#,
        )
        .bind(card.id)
        .bind(card.current_column_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(card)
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
                SELECT *, 1 as depth, ARRAY[id] as path FROM cards WHERE id = $1
                UNION ALL
                -- Recursive step with depth limit and cycle detection
                SELECT c.*, h.depth + 1, h.path || c.id 
                FROM cards c
                INNER JOIN hierarchy h ON c.parent_id = h.id
                WHERE h.depth < 10            -- SRE: Depth limit
                AND NOT (c.id = ANY(h.path))  -- Security: Cycle detection
            )
            SELECT id, parent_id, workspace_id, title, current_column_id, current_swimlane_id, created_at, updated_at 
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
}
