use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use crate::models::card::Card;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Column {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub title: String,
    pub position: i32,
    pub wip_limit: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Swimlane {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub title: String,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BoardState {
    pub columns: Vec<Column>,
    pub swimlanes: Vec<Swimlane>,
    pub cards: Vec<Card>,
}

impl BoardState {
    #[tracing::instrument(skip(pool))]
    pub async fn get_state(pool: &sqlx::PgPool, workspace_id: Uuid) -> Result<Self, crate::AppError> {
        let columns_fut = sqlx::query_as::<_, Column>(
            "SELECT id, workspace_id, title, position, wip_limit, created_at, updated_at FROM columns WHERE workspace_id = $1 ORDER BY position"
        )
        .bind(workspace_id)
        .fetch_all(pool);

        let swimlanes_fut = sqlx::query_as::<_, Swimlane>(
            "SELECT id, workspace_id, title, position, created_at, updated_at FROM swimlanes WHERE workspace_id = $1 ORDER BY position"
        )
        .bind(workspace_id)
        .fetch_all(pool);

        let cards_fut = sqlx::query_as::<_, Card>(
            "SELECT id, parent_id, workspace_id, title, current_column_id, current_swimlane_id, created_at, updated_at FROM cards WHERE workspace_id = $1"
        )
        .bind(workspace_id)
        .fetch_all(pool);

        let (columns, swimlanes, cards) = tokio::try_join!(columns_fut, swimlanes_fut, cards_fut)?;

        Ok(BoardState {
            columns,
            swimlanes,
            cards,
        })
    }
}
