use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct CardTransition {
    pub id: Uuid,
    pub card_id: Uuid,
    pub user_id: Option<Uuid>,
    pub transition_type: String,
    pub from_column_id: Option<Uuid>,
    pub to_column_id: Option<Uuid>,
    pub from_swimlane_id: Option<Uuid>,
    pub to_swimlane_id: Option<Uuid>,
    pub payload: Option<serde_json::Value>,
    pub occurred_at: DateTime<Utc>,
}

impl CardTransition {
    #[tracing::instrument(skip(pool))]
    pub async fn get_history(
        pool: &sqlx::PgPool,
        card_id: Uuid,
        workspace_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Self>, crate::AppError> {
        // Security: Validate card belongs to workspace
        let card_exists: (bool,) = sqlx::query!(
            "SELECT EXISTS(SELECT 1 FROM cards WHERE id = $1 AND workspace_id = $2)",
            card_id,
            workspace_id
        )
        .fetch_one(pool)
        .await?;

        if !card_exists.0 {
            return Err(crate::AppError::Forbidden);
        }

        let history = sqlx::query_as!(
            CardTransition,
            r#"
            SELECT * FROM card_transitions
            WHERE card_id = $1
            ORDER BY occurred_at DESC
            LIMIT $2 OFFSET $3
            "#,
            card_id,
            limit,
            offset
        )
        .fetch_all(pool)
        .await?;

        Ok(history)
    }
}
