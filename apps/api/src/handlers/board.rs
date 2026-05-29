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

#[derive(Debug, Deserialize)]
pub struct SetUserWipLimit {
    pub wip_limit: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct AssignCard {
    pub assignee_id: Option<Uuid>,
    pub override_limit: Option<bool>,
    pub override_reason: Option<String>,
}

#[tracing::instrument(skip(pool, headers))]
pub async fn set_user_wip_limit(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path((workspace_id, target_user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<SetUserWipLimit>,
) -> Result<axum::http::StatusCode, AppError> {
    if payload.wip_limit.is_some_and(|limit| limit <= 0) {
        return Err(AppError::BadRequest(
            "WIP limit must be greater than zero".into(),
        ));
    }
    // 1. Authenticate caller
    let cookie_hdr = headers
        .get(axum::http::header::COOKIE)
        .ok_or_else(|| AppError::Unauthorized("No cookie found".to_string()))?;

    let cookie_str = cookie_hdr
        .to_str()
        .map_err(|_| AppError::Unauthorized("Invalid cookie header".to_string()))?;

    let token = cookie_str
        .split(';')
        .find_map(|cookie| {
            let parts: Vec<&str> = cookie.trim().split('=').collect();
            if parts.len() == 2 && parts[0] == "__Host-sid" {
                Some(parts[1].to_string())
            } else {
                None
            }
        })
        .ok_or_else(|| AppError::Unauthorized("No active session".to_string()))?;

    let user =
        crate::services::session_service::SessionService::validate_session(&pool, &token).await?;

    // 2. Verify caller role
    let caller_member: (String,) = sqlx::query_as(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
    )
    .bind(workspace_id)
    .bind(user.id)
    .fetch_one(&pool)
    .await
    .map_err(|_| AppError::Forbidden)?;

    if caller_member.0 != "admin" {
        return Err(AppError::Forbidden);
    }

    // 3. Update WIP limit
    sqlx::query(
        "UPDATE workspace_members SET wip_limit = $1, updated_at = NOW() WHERE workspace_id = $2 AND user_id = $3"
    )
    .bind(payload.wip_limit)
    .bind(workspace_id)
    .bind(target_user_id)
    .execute(&pool)
    .await?;

    Ok(axum::http::StatusCode::OK)
}

#[tracing::instrument(skip(pool, headers))]
pub async fn assign_card(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path((workspace_id, card_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<AssignCard>,
) -> Result<Json<Card>, AppError> {
    // 1. Authenticate caller
    let cookie_hdr = headers
        .get(axum::http::header::COOKIE)
        .ok_or_else(|| AppError::Unauthorized("No cookie found".to_string()))?;

    let cookie_str = cookie_hdr
        .to_str()
        .map_err(|_| AppError::Unauthorized("Invalid cookie header".to_string()))?;

    let token = cookie_str
        .split(';')
        .find_map(|cookie| {
            let parts: Vec<&str> = cookie.trim().split('=').collect();
            if parts.len() == 2 && parts[0] == "__Host-sid" {
                Some(parts[1].to_string())
            } else {
                None
            }
        })
        .ok_or_else(|| AppError::Unauthorized("No active session".to_string()))?;

    let user =
        crate::services::session_service::SessionService::validate_session(&pool, &token).await?;

    // 2. Check caller role
    let caller_member: (String,) = sqlx::query_as(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
    )
    .bind(workspace_id)
    .bind(user.id)
    .fetch_one(&pool)
    .await
    .map_err(|_| AppError::Forbidden)?;

    let is_admin = caller_member.0 == "admin";

    // 3. Call core assignment logic
    let card = Card::assign_to(
        &pool,
        workspace_id,
        user.id,
        card_id,
        payload.assignee_id,
        is_admin,
        payload.override_limit.unwrap_or(false),
        payload.override_reason,
    )
    .await?;

    Ok(Json(card))
}
