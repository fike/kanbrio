use crate::models::card::Card;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct TransitionRule {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub column_id: Uuid,
    pub rule_type: String,     // "arrival" or "departure"
    pub criteria_type: String, // "assignee_required", "checklist_completed", "subtasks_completed"
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Column {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub title: String,
    pub position: i32,
    pub wip_limit: Option<i32>,
    pub is_done: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct Swimlane {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub title: String,
    pub position: i32,
    pub wip_limit: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BoardState {
    pub columns: Vec<Column>,
    pub swimlanes: Vec<Swimlane>,
    pub cards: Vec<Card>,
    pub checklists: Vec<crate::models::card::ChecklistItem>,
    pub transition_rules: Vec<TransitionRule>,
}

impl BoardState {
    #[tracing::instrument(skip(pool))]
    pub async fn get_state(
        pool: &sqlx::PgPool,
        workspace_id: Uuid,
    ) -> Result<Self, crate::AppError> {
        let columns_fut = sqlx::query_as!(
            Column,
            "SELECT id, workspace_id, title, position, wip_limit, is_done, created_at, updated_at FROM columns WHERE workspace_id = $1 ORDER BY position",
            workspace_id
        )
        .fetch_all(pool);

        let swimlanes_fut = sqlx::query_as!(
            Swimlane,
            "SELECT id, workspace_id, title, position, wip_limit, created_at, updated_at FROM swimlanes WHERE workspace_id = $1 ORDER BY position",
            workspace_id
        )
        .fetch_all(pool);

        let cards_fut = sqlx::query_as!(
            Card,
            "SELECT * FROM cards WHERE workspace_id = $1 AND deleted_at IS NULL",
            workspace_id
        )
        .fetch_all(pool);

        let checklists_fut = sqlx::query_as!(
            crate::models::card::ChecklistItem,
            r#"
            SELECT c.*
            FROM card_checklists c
            INNER JOIN cards card ON c.card_id = card.id
            WHERE card.workspace_id = $1 AND card.deleted_at IS NULL
            ORDER BY c.card_id, c.position
            "#,
            workspace_id
        )
        .fetch_all(pool);

        let rules_fut = sqlx::query_as!(
            TransitionRule,
            "SELECT * FROM transition_rules WHERE workspace_id = $1",
            workspace_id
        )
        .fetch_all(pool);

        let (columns, swimlanes, cards, checklists, transition_rules) = tokio::try_join!(
            columns_fut,
            swimlanes_fut,
            cards_fut,
            checklists_fut,
            rules_fut
        )?;

        Ok(BoardState {
            columns,
            swimlanes,
            cards,
            checklists,
            transition_rules,
        })
    }
}
