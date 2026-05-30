use crate::AppError;
use crate::models::audit::CardTransition;
use crate::models::board::BoardState;
use crate::models::card::{Card, ChecklistItem, MoveCard};
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
    pub override_rules: Option<bool>,
    pub override_reason: Option<String>,
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
            override_rules: payload.override_rules,
            override_reason: payload.override_reason,
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

#[derive(Debug, Deserialize)]
pub struct CreateChecklistItemPayload {
    pub title: String,
    pub position: i32,
}

#[tracing::instrument(skip(pool))]
pub async fn create_checklist_item(
    State(pool): State<PgPool>,
    Path((workspace_id, card_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<CreateChecklistItemPayload>,
) -> Result<Json<ChecklistItem>, AppError> {
    // Verify card exists in workspace
    let card_exists: (bool,) =
        sqlx::query_as("SELECT EXISTS(SELECT 1 FROM cards WHERE id = $1 AND workspace_id = $2)")
            .bind(card_id)
            .bind(workspace_id)
            .fetch_one(&pool)
            .await?;

    if !card_exists.0 {
        return Err(AppError::NotFound);
    }

    let item = sqlx::query_as::<_, ChecklistItem>(
        r#"
        INSERT INTO card_checklists (card_id, title, position)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(card_id)
    .bind(payload.title)
    .bind(payload.position)
    .fetch_one(&pool)
    .await?;

    Ok(Json(item))
}

#[derive(Debug, Deserialize)]
pub struct UpdateChecklistItemPayload {
    pub title: Option<String>,
    pub is_completed: Option<bool>,
    pub position: Option<i32>,
    pub completed_by: Option<Uuid>,
}

#[tracing::instrument(skip(pool))]
pub async fn update_checklist_item(
    State(pool): State<PgPool>,
    Path((workspace_id, card_id, checklist_id)): Path<(Uuid, Uuid, Uuid)>,
    Json(payload): Json<UpdateChecklistItemPayload>,
) -> Result<Json<ChecklistItem>, AppError> {
    // Verify item belongs to card, and card belongs to workspace
    let item_exists: (bool,) = sqlx::query_as(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM card_checklists c
            INNER JOIN cards card ON c.card_id = card.id
            WHERE c.id = $1 AND c.card_id = $2 AND card.workspace_id = $3
        )
        "#,
    )
    .bind(checklist_id)
    .bind(card_id)
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    if !item_exists.0 {
        return Err(AppError::NotFound);
    }

    let current_item =
        sqlx::query_as::<_, ChecklistItem>("SELECT * FROM card_checklists WHERE id = $1")
            .bind(checklist_id)
            .fetch_one(&pool)
            .await?;

    let (is_completed, completed_by, completed_at) = match payload.is_completed {
        Some(true) => {
            let by = payload.completed_by.or(current_item.completed_by);
            let at = Some(chrono::Utc::now());
            (true, by, at)
        }
        Some(false) => (false, None, None),
        None => (
            current_item.is_completed,
            current_item.completed_by,
            current_item.completed_at,
        ),
    };

    let title = payload.title.unwrap_or(current_item.title);
    let position = payload.position.unwrap_or(current_item.position);

    let updated = sqlx::query_as::<_, ChecklistItem>(
        r#"
        UPDATE card_checklists
        SET title = $1, is_completed = $2, position = $3, completed_by = $4, completed_at = $5, updated_at = NOW()
        WHERE id = $6
        RETURNING *
        "#
    )
    .bind(title)
    .bind(is_completed)
    .bind(position)
    .bind(completed_by)
    .bind(completed_at)
    .bind(checklist_id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(updated))
}

#[tracing::instrument(skip(pool))]
pub async fn delete_checklist_item(
    State(pool): State<PgPool>,
    Path((workspace_id, card_id, checklist_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<axum::http::StatusCode, AppError> {
    let deleted = sqlx::query(
        r#"
        DELETE FROM card_checklists c
        USING cards card
        WHERE c.card_id = card.id
          AND c.id = $1
          AND c.card_id = $2
          AND card.workspace_id = $3
        "#,
    )
    .bind(checklist_id)
    .bind(card_id)
    .bind(workspace_id)
    .execute(&pool)
    .await?;

    if deleted.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(axum::http::StatusCode::NO_CONTENT)
}
