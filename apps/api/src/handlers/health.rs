use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub database: String,
    pub version: String,
}

pub async fn health(State(pool): State<PgPool>) -> impl IntoResponse {
    let version = env!("CARGO_PKG_VERSION").to_string();

    match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&pool)
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(HealthResponse {
                status: "ok".to_string(),
                database: "connected".to_string(),
                version,
            }),
        )
            .into_response(),
        Err(_) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(HealthResponse {
                status: "error".to_string(),
                database: "failed".to_string(),
                version,
            }),
        )
            .into_response(),
    }
}
