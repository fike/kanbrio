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
    pub occurred_at: DateTime<Utc>,
}

impl CardTransition {
    #[tracing::instrument(skip(pool))]
    pub async fn get_history(
        pool: &sqlx::PgPool,
        card_id: Uuid,
    ) -> Result<Vec<Self>, crate::AppError> {
        let history = sqlx::query_as::<_, CardTransition>(
            r#"
            SELECT * FROM card_transitions 
            WHERE card_id = $1 
            ORDER BY occurred_at DESC
            "#,
        )
        .bind(card_id)
        .fetch_all(pool)
        .await?;

        Ok(history)
    }
}
