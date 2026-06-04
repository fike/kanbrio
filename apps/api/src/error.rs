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

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Rule violation: {0}")]
    RuleViolation(String),

    #[error("Card is blocked: {0}")]
    CardIsBlocked(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Too many requests: {0}")]
    TooManyRequests(String),
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
            AppError::Unauthorized(ref msg) => (StatusCode::UNAUTHORIZED, msg.clone(), None),
            AppError::BadRequest(ref msg) => (StatusCode::BAD_REQUEST, msg.clone(), None),
            AppError::RuleViolation(ref msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                msg.clone(),
                Some("RULE_VIOLATION".to_string()),
            ),
            AppError::CardIsBlocked(ref msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                msg.clone(),
                Some("CARD_IS_BLOCKED".to_string()),
            ),
            AppError::Internal(ref msg) => {
                tracing::error!("Internal error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                    None,
                )
            }
            AppError::TooManyRequests(ref msg) => {
                (StatusCode::TOO_MANY_REQUESTS, msg.clone(), None)
            }
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
