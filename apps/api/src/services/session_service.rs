use crate::error::AppError;
use crate::models::user::{User, UserRow, UserSession};
use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

pub struct SessionService;

impl SessionService {
    pub async fn create_session(pool: &PgPool, user_id: Uuid) -> Result<UserSession, AppError> {
        let token = Uuid::new_v4().to_string();
        let expires_at = Utc::now() + Duration::days(1);

        let session = sqlx::query_as!(
            UserSession,
            "INSERT INTO user_sessions (user_id, session_token, expires_at) \
             VALUES ($1, $2, $3) \
             RETURNING *",
            user_id,
            token,
            expires_at
        )
        .fetch_one(pool)
        .await?;

        Ok(session)
    }

    pub async fn validate_session(pool: &PgPool, token: &str) -> Result<User, AppError> {
        let now = Utc::now();

        let session = sqlx::query_as!(
            UserSession,
            "SELECT id, user_id, session_token, expires_at, created_at, last_active_at \
             FROM user_sessions \
             WHERE session_token = $1",
            token
        )
        .fetch_optional(pool)
        .await?;

        let session = match session {
            Some(s) => s,
            None => return Err(AppError::Unauthorized("Invalid session".to_string())),
        };

        if session.expires_at < now {
            let _ = sqlx::query!("DELETE FROM user_sessions WHERE session_token = $1", token)
                .execute(pool)
                .await;
            return Err(AppError::Unauthorized("Session expired".to_string()));
        }

        let user_row = sqlx::query_as!(
            UserRow,
            "SELECT id, email, name, avatar_url, created_at, updated_at \
             FROM users \
             WHERE id = $1",
            session.user_id
        )
        .fetch_optional(pool)
        .await?;

        let user = match user_row {
            Some(r) => r.into(),
            None => return Err(AppError::Unauthorized("User not found".to_string())),
        };

        // Update last active timestamp
        let _ = sqlx::query!(
            "UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1",
            session.id
        )
        .execute(pool)
        .await;

        Ok(user)
    }

    pub async fn destroy_session(pool: &PgPool, token: &str) -> Result<(), AppError> {
        sqlx::query!("DELETE FROM user_sessions WHERE session_token = $1", token)
            .execute(pool)
            .await?;

        Ok(())
    }
}
