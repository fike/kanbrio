use crate::AppError;
use crate::models::board::BoardState;
use crate::models::card::{Card, MoveCard};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

#[tracing::instrument(skip(pool))]
pub async fn get_board_state(
    State(pool): State<PgPool>,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<BoardState>, AppError> {
    let state = BoardState::get_state(&pool, workspace_id).await?;
    Ok(Json(state))
}

#[derive(Debug, Deserialize)]
pub struct MoveCardPayload {
    pub to_column_id: Uuid,
    pub to_swimlane_id: Uuid,
    pub user_id: Option<Uuid>,
}

#[tracing::instrument(skip(pool))]
pub async fn move_card(
    State(pool): State<PgPool>,
    Path((workspace_id, card_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<MoveCardPayload>,
) -> Result<Json<Card>, AppError> {
    let card = Card::move_to(
        &pool,
        MoveCard {
            card_id,
            workspace_id,
            to_column_id: payload.to_column_id,
            to_swimlane_id: payload.to_swimlane_id,
            user_id: payload.user_id,
        },
    )
    .await?;

    Ok(Json(card))
}
