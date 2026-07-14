use crate::AppError;
use crate::handlers::board::authenticate_member;
use crate::models::analytics::BoardAnalytics;
use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CycleTimeQuery {
    days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct AgingWipQuery {
    threshold_days: Option<i32>,
}

#[tracing::instrument(skip(pool, headers))]
pub async fn get_cycle_times(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path(workspace_id): Path<Uuid>,
    Query(q): Query<CycleTimeQuery>,
) -> Result<Json<crate::models::analytics::CycleTimeResponse>, AppError> {
    let _ = authenticate_member(&pool, &headers, workspace_id).await?;

    let days = q.days.unwrap_or(90).clamp(7, 365);
    let result = BoardAnalytics::cycle_times(&pool, workspace_id, days).await?;
    Ok(Json(result))
}

#[tracing::instrument(skip(pool, headers))]
pub async fn get_flow_efficiency(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<crate::models::analytics::FlowEfficiencyResponse>, AppError> {
    let _ = authenticate_member(&pool, &headers, workspace_id).await?;
    let result = BoardAnalytics::flow_efficiency(&pool, workspace_id).await?;
    Ok(Json(result))
}

#[tracing::instrument(skip(pool, headers))]
pub async fn get_aging_wip(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path(workspace_id): Path<Uuid>,
    Query(q): Query<AgingWipQuery>,
) -> Result<Json<crate::models::analytics::AgingWipResponse>, AppError> {
    let _ = authenticate_member(&pool, &headers, workspace_id).await?;
    let threshold_days = q.threshold_days.unwrap_or(3).clamp(1, 365);
    let result = BoardAnalytics::aging_wip(&pool, workspace_id, threshold_days).await?;
    Ok(Json(result))
}
