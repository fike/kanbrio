use crate::AppError;
use crate::models::audit::CardTransition;
use crate::models::board::BoardState;
use crate::models::card::{Card, MoveCard};
use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct Pagination {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[tracing::instrument(skip(pool))]
pub async fn get_card_history(
    State(pool): State<PgPool>,
    Path((workspace_id, card_id)): Path<(Uuid, Uuid)>,
    Query(pagination): Query<Pagination>,
) -> Result<Json<Vec<CardTransition>>, AppError> {
    let limit = pagination.limit.unwrap_or(50).min(100);
    let offset = pagination.offset.unwrap_or(0);

    let history = CardTransition::get_history(&pool, card_id, workspace_id, limit, offset).await?;
    Ok(Json(history))
}

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

#[derive(Debug, Deserialize)]
pub struct BlockCardPayload {
    pub reason: String,
}

#[tracing::instrument(skip(pool))]
pub async fn block_card(
    State(pool): State<PgPool>,
    Path((workspace_id, card_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<BlockCardPayload>,
) -> Result<Json<Card>, AppError> {
    // 1. Fetch card with workspace isolation
    let card = sqlx::query_as::<_, Card>("SELECT * FROM cards WHERE id = $1 AND workspace_id = $2")
        .bind(card_id)
        .bind(workspace_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            _ => AppError::Database(e),
        })?;

    // 2. Perform block
    let updated = card.block(&pool, payload.reason).await?;
    Ok(Json(updated))
}

#[tracing::instrument(skip(pool))]
pub async fn unblock_card(
    State(pool): State<PgPool>,
    Path((workspace_id, card_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Card>, AppError> {
    // 1. Fetch card with workspace isolation
    let card = sqlx::query_as::<_, Card>("SELECT * FROM cards WHERE id = $1 AND workspace_id = $2")
        .bind(card_id)
        .bind(workspace_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound,
            _ => AppError::Database(e),
        })?;

    // 2. Perform unblock
    let updated = card.unblock(&pool).await?;
    Ok(Json(updated))
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
