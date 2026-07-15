use crate::AppError;
use crate::handlers::board::authenticate_member;
use crate::models::analytics::BoardAnalytics;
use axum::{
    Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
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

#[derive(Debug, Deserialize)]
pub struct CFDQuery {
    from: Option<NaiveDate>,
    to: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct MonteCarloQuery {
    days: Option<i32>,
    simulations: Option<i32>,
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

#[tracing::instrument(skip(pool, headers))]
pub async fn get_cfd(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path(workspace_id): Path<Uuid>,
    Query(q): Query<CFDQuery>,
) -> Result<Json<crate::models::analytics::CFDResponse>, AppError> {
    let _ = authenticate_member(&pool, &headers, workspace_id).await?;

    let today = chrono::Utc::now().date_naive();
    let from = q.from.unwrap_or(today - chrono::TimeDelta::days(30));
    let to = q.to.unwrap_or(today);

    if from > to {
        return Err(AppError::BadRequest(
            "'from' date must be before 'to'".into(),
        ));
    }

    let result = BoardAnalytics::cfd(&pool, workspace_id, from, to).await?;
    Ok(Json(result))
}

#[tracing::instrument(skip(pool, headers))]
pub async fn get_monte_carlo(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path(workspace_id): Path<Uuid>,
    Query(q): Query<MonteCarloQuery>,
) -> Result<Json<crate::models::analytics::MonteCarloResponse>, AppError> {
    let _ = authenticate_member(&pool, &headers, workspace_id).await?;

    let days = q.days.unwrap_or(90).clamp(7, 365);
    let simulations = q.simulations.unwrap_or(1000).clamp(100, 10_000);

    let result = BoardAnalytics::monte_carlo(&pool, workspace_id, days, simulations).await?;
    Ok(Json(result))
}
