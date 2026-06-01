use crate::error::AppError;
use crate::models::user::{User, UserRow};
use argon2::{
    Argon2, Params,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
};
use rand::rngs::OsRng;
use sqlx::PgPool;

pub struct UserService;

impl UserService {
    pub async fn register_user(
        pool: &PgPool,
        name: &str,
        email: &str,
        password: &str,
    ) -> Result<User, AppError> {
        let name_owned = name.to_string();
        let email_owned = email.to_string();
        let password_owned = password.to_string();

        // 1. Check if user already exists
        let email_exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)",
            email_owned
        )
        .fetch_one(pool)
        .await?
        .unwrap_or(false);

        if email_exists {
            return Err(AppError::BadRequest(
                "User with this email already exists".to_string(),
            ));
        }

        // 2. Hash password in blocking task
        let password_hash = tokio::task::spawn_blocking(move || {
            let params = Params::new(15360, 2, 1, Some(32))
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
            let salt = SaltString::generate(&mut OsRng);
            argon2
                .hash_password(password_owned.as_bytes(), &salt)
                .map(|hash| hash.to_string())
                .map_err(|e| AppError::Internal(e.to_string()))
        })
        .await
        .map_err(|e| AppError::Internal(e.to_string()))??;

        // 3. Insert user & credentials in a transaction
        let mut tx = pool.begin().await?;

        let row = sqlx::query_as!(
            UserRow,
            "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
            name_owned,
            email_owned
        )
        .fetch_one(&mut *tx)
        .await?;

        let user: User = row.into();

        sqlx::query!(
            "INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)",
            user.id,
            password_hash
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(user)
    }

    pub async fn authenticate_user(
        pool: &PgPool,
        email: &str,
        password: &str,
    ) -> Result<User, AppError> {
        let email_owned = email.to_string();
        let password_owned = password.to_string();

        // 1. Fetch user by email
        let user_row = sqlx::query_as!(
            UserRow,
            "SELECT id, email, name, avatar_url, created_at, updated_at FROM users WHERE email = $1",
            email_owned
        )
        .fetch_optional(pool)
        .await?;

        let user: User = match user_row {
            Some(r) => r.into(),
            None => {
                return Err(AppError::Unauthorized(
                    "Invalid email or password".to_string(),
                ));
            }
        };

        // 2. Fetch credential password hash
        let password_hash: String = sqlx::query_scalar!(
            "SELECT password_hash FROM user_credentials WHERE user_id = $1",
            user.id
        )
        .fetch_one(pool)
        .await?;

        // 3. Verify password hash in blocking task
        tokio::task::spawn_blocking(move || {
            let params = Params::new(15360, 2, 1, Some(32))
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
            let parsed_hash =
                PasswordHash::new(&password_hash).map_err(|e| AppError::Internal(e.to_string()))?;
            argon2
                .verify_password(password_owned.as_bytes(), &parsed_hash)
                .map_err(|_| AppError::Unauthorized("Invalid email or password".to_string()))
        })
        .await
        .map_err(|e| AppError::Internal(e.to_string()))??;

        Ok(user)
    }

    pub async fn oauth_upsert_user(
        pool: &PgPool,
        email: &str,
        name: &str,
        avatar_url: Option<&str>,
    ) -> Result<User, AppError> {
        let email_owned = email.to_string();
        let name_owned = name.to_string();
        let avatar_url_owned = avatar_url.map(|s| s.to_string());

        // Upsert user based on email matching
        let user_row = sqlx::query_as!(
            UserRow,
            "INSERT INTO users (email, name, avatar_url) \
             VALUES ($1, $2, $3) \
             ON CONFLICT (email) \
             DO UPDATE SET name = EXCLUDED.name, avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url), updated_at = NOW() \
             RETURNING *",
            email_owned,
            name_owned,
            avatar_url_owned
        )
        .fetch_one(pool)
        .await?;

        Ok(user_row.into())
    }
}
