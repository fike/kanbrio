use crate::AppError;
use crate::models::board::BoardState;
use axum::{
    Json,
    extract::{Path, State},
};
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
