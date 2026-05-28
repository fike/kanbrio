use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal server error")]
    Anyhow(#[from] anyhow::Error),

    #[error("Not found")]
    NotFound,

    #[error("Forbidden")]
    Forbidden,

    #[error("WIP limit {limit} exceeded for {entity}")]
    WipLimitExceeded { entity: String, limit: i32 },
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message, code) = match self {
            AppError::Database(ref e) => {
                tracing::error!("Database error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Database error".to_string(),
                    None,
                )
            }
            AppError::Anyhow(ref e) => {
                tracing::error!("Internal error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                    None,
                )
            }
            AppError::NotFound => (
                StatusCode::NOT_FOUND,
                "Resource not found".to_string(),
                None,
            ),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "Forbidden".to_string(), None),
            AppError::WipLimitExceeded { entity, limit } => (
                StatusCode::CONFLICT,
                format!("WIP limit {} exceeded for {}", limit, entity),
                Some("WIP_LIMIT_EXCEEDED".to_string()),
            ),
        };

        let mut body = json!({
            "error": error_message,
        });

        if let Some(c) = code {
            body.as_object_mut()
                .unwrap()
                .insert("code".to_string(), json!(c));
        }

        (status, Json(body)).into_response()
    }
}
