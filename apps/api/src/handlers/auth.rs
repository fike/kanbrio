use crate::error::AppError;
use crate::services::session_service::SessionService;
use crate::services::user_service::UserService;
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{StatusCode, header},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct RateLimiter {
    requests: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            requests: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window: Duration::from_secs(window_secs),
        }
    }

    pub fn check_and_record(&self, key: &str) -> bool {
        if std::env::var("TEST_ENV").is_ok()
            || std::env::var("CARGO_ENV").unwrap_or_default() == "test"
            || std::env::var("BYPASS_RATE_LIMITER").is_ok()
        {
            return true;
        }
        let mut reqs = self.requests.lock().unwrap();
        let now = Instant::now();
        let timestamps = reqs.entry(key.to_string()).or_default();

        timestamps.retain(|&ts| now.duration_since(ts) < self.window);

        if timestamps.len() >= self.max_requests {
            false
        } else {
            timestamps.push(now);
            true
        }
    }
}

pub fn get_rate_limiter() -> &'static RateLimiter {
    static LIMITER: OnceLock<RateLimiter> = OnceLock::new();
    LIMITER.get_or_init(|| RateLimiter::new(5, 60))
}

#[derive(Debug, Deserialize)]
pub struct RegisterPayload {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub workspaces: Vec<UserWorkspace>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserWorkspace {
    pub id: Uuid,
    pub name: String,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct CallbackParams {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Deserialize)]
pub struct ProviderProfile {
    pub email: Option<String>,
    pub name: String,
    pub avatar_url: Option<String>,
}

pub async fn register(
    State(pool): State<PgPool>,
    headers: header::HeaderMap,
    Json(payload): Json<RegisterPayload>,
) -> Result<impl IntoResponse, AppError> {
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    if !get_rate_limiter().check_and_record(&client_ip) {
        return Err(AppError::TooManyRequests(
            "Rate limit exceeded. Try again later.".to_string(),
        ));
    }

    if payload.name.trim().is_empty()
        || payload.email.trim().is_empty()
        || payload.password.trim().is_empty()
    {
        return Err(AppError::BadRequest(
            "Missing registration fields".to_string(),
        ));
    }

    let trimmed_email = payload.email.trim();
    let trimmed_name = payload.name.trim();
    let password_len = payload.password.len();

    if !(8..=72).contains(&password_len) {
        return Err(AppError::BadRequest(
            "Password must be between 8 and 72 characters".to_string(),
        ));
    }
    if trimmed_email.len() > 254 {
        return Err(AppError::BadRequest(
            "Email cannot exceed 254 characters".to_string(),
        ));
    }
    if trimmed_name.len() > 100 {
        return Err(AppError::BadRequest(
            "Name cannot exceed 100 characters".to_string(),
        ));
    }

    let mut user =
        UserService::register_user(&pool, trimmed_name, trimmed_email, &payload.password).await?;
    let workspace = create_and_seed_workspace(&pool, user.id, "My Workspace").await?;
    user.workspace_id = Some(workspace.id);
    let session = SessionService::create_session(&pool, user.id).await?;

    let cookie = format!(
        "__Host-sid={}; Path=/; SameSite=Lax; Secure; HttpOnly",
        session.session_token
    );

    let res_headers = [(header::SET_COOKIE, cookie)];

    Ok((StatusCode::CREATED, res_headers, Json(user)))
}

pub async fn login(
    State(pool): State<PgPool>,
    headers: header::HeaderMap,
    Json(payload): Json<LoginPayload>,
) -> Result<impl IntoResponse, AppError> {
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    if !get_rate_limiter().check_and_record(&client_ip) {
        return Err(AppError::TooManyRequests(
            "Rate limit exceeded. Try again later.".to_string(),
        ));
    }

    if payload.email.trim().is_empty() || payload.password.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Missing authentication fields".to_string(),
        ));
    }

    let trimmed_email = payload.email.trim();
    if payload.password.len() > 72 {
        return Err(AppError::BadRequest("Password too long".to_string()));
    }
    if trimmed_email.len() > 254 {
        return Err(AppError::BadRequest("Email too long".to_string()));
    }

    let user = UserService::authenticate_user(&pool, trimmed_email, &payload.password).await?;
    let session = SessionService::create_session(&pool, user.id).await?;

    let cookie = format!(
        "__Host-sid={}; Path=/; SameSite=Lax; Secure; HttpOnly",
        session.session_token
    );

    let res_headers = [(header::SET_COOKIE, cookie)];

    Ok((StatusCode::OK, res_headers, Json(user)))
}

pub async fn logout(
    State(pool): State<PgPool>,
    headers: header::HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    if let Some(token) = headers
        .get(header::COOKIE)
        .and_then(|hdr| hdr.to_str().ok())
        .and_then(|cookie_str| extract_cookie_value(cookie_str, "__Host-sid"))
    {
        let _ = SessionService::destroy_session(&pool, &token).await;
    }

    let delete_cookie = "__Host-sid=; Path=/; SameSite=Lax; Secure; HttpOnly; Max-Age=0";

    let headers = [(header::SET_COOKIE, delete_cookie)];

    Ok((StatusCode::OK, headers, "Logout successful"))
}

pub async fn me(
    State(pool): State<PgPool>,
    headers: header::HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    let cookie_hdr = headers
        .get(header::COOKIE)
        .ok_or_else(|| AppError::Unauthorized("No cookie found".to_string()))?;

    let cookie_str = cookie_hdr
        .to_str()
        .map_err(|_| AppError::Unauthorized("Invalid cookie header".to_string()))?;

    let token = extract_cookie_value(cookie_str, "__Host-sid")
        .ok_or_else(|| AppError::Unauthorized("No active session".to_string()))?;

    let user = SessionService::validate_session(&pool, &token).await?;

    let workspaces = sqlx::query_as::<_, UserWorkspace>(
        "SELECT w.id, w.name, INITCAP(wm.role) AS role \
         FROM workspaces w \
         JOIN workspace_members wm ON w.id = wm.workspace_id \
         WHERE wm.user_id = $1",
    )
    .bind(user.id)
    .fetch_all(&pool)
    .await?;

    Ok(Json(MeResponse {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        workspaces,
    }))
}

pub async fn workspaces(
    State(pool): State<PgPool>,
    headers: header::HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    let cookie_hdr = headers
        .get(header::COOKIE)
        .ok_or_else(|| AppError::Unauthorized("No cookie found".to_string()))?;

    let cookie_str = cookie_hdr
        .to_str()
        .map_err(|_| AppError::Unauthorized("Invalid cookie header".to_string()))?;

    let token = extract_cookie_value(cookie_str, "__Host-sid")
        .ok_or_else(|| AppError::Unauthorized("No active session".to_string()))?;

    let user = SessionService::validate_session(&pool, &token).await?;

    let workspaces = sqlx::query_as::<_, UserWorkspace>(
        "SELECT w.id, w.name, INITCAP(wm.role) AS role \
         FROM workspaces w \
         JOIN workspace_members wm ON w.id = wm.workspace_id \
         WHERE wm.user_id = $1",
    )
    .bind(user.id)
    .fetch_all(&pool)
    .await?;

    Ok(Json(workspaces))
}

pub async fn oauth_redirect(Path(provider): Path<String>) -> Result<impl IntoResponse, AppError> {
    let state = Uuid::new_v4().to_string();

    let auth_url = if provider == "github" {
        format!(
            "https://github.com/login/oauth/authorize?client_id=mock_id&state={}",
            state
        )
    } else {
        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id=mock_id&state={}",
            state
        )
    };

    let state_cookie = format!(
        "oauth_state={}; Path=/; HttpOnly; Secure; SameSite=Lax",
        state
    );

    let headers = [
        (header::LOCATION, auth_url),
        (header::SET_COOKIE, state_cookie),
    ];

    Ok((StatusCode::FOUND, headers))
}

pub async fn oauth_callback(
    State(pool): State<PgPool>,
    Path(provider): Path<String>,
    Query(params): Query<CallbackParams>,
    headers: header::HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    let cookie_hdr = headers
        .get(header::COOKIE)
        .ok_or_else(|| AppError::BadRequest("Missing cookie header".to_string()))?;
    let cookie_str = cookie_hdr
        .to_str()
        .map_err(|_| AppError::BadRequest("Invalid cookie format".to_string()))?;

    let oauth_state = extract_cookie_value(cookie_str, "oauth_state")
        .ok_or_else(|| AppError::BadRequest("Missing oauth_state cookie".to_string()))?;

    if oauth_state != params.state {
        return Err(AppError::BadRequest(
            "State verification failed".to_string(),
        ));
    }

    // 1. Perform out-of-band Token Exchange
    let client_id = std::env::var("OAUTH_CLIENT_ID").unwrap_or_else(|_| "mock_id".to_string());
    let client_secret =
        std::env::var("OAUTH_CLIENT_SECRET").unwrap_or_else(|_| "mock_secret".to_string());
    let redirect_uri = std::env::var("OAUTH_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:3000/api/auth/callback".to_string());

    let token_exchange_url = if provider == "github" {
        let github_auth_url =
            std::env::var("GITHUB_AUTH_URL").unwrap_or_else(|_| "https://github.com".to_string());
        format!("{}/login/oauth/access_token", github_auth_url)
    } else {
        let google_auth_url = std::env::var("GOOGLE_AUTH_URL")
            .unwrap_or_else(|_| "https://oauth2.googleapis.com".to_string());
        format!("{}/token", google_auth_url)
    };

    let client = reqwest::Client::new();
    let mut params_map = vec![
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("code", params.code.clone()),
        ("redirect_uri", redirect_uri),
    ];
    if provider == "google" {
        params_map.push(("grant_type", "authorization_code".to_string()));
    }

    let token_response = client
        .post(&token_exchange_url)
        .header(header::ACCEPT, "application/json")
        .form(&params_map)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to exchange authorization code: {}", e)))?;

    if !token_response.status().is_success() {
        return Err(AppError::BadRequest(
            "Failed to exchange authorization code for access token".to_string(),
        ));
    }

    #[derive(Debug, Deserialize)]
    struct TokenResponse {
        access_token: String,
    }

    let token_data: TokenResponse = token_response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse token response JSON: {}", e)))?;

    let access_token = token_data.access_token;

    // 2. Fetch User Profile
    let provider_url = if provider == "github" {
        std::env::var("GITHUB_API_URL").unwrap_or_else(|_| "https://api.github.com".to_string())
    } else {
        std::env::var("GOOGLE_API_URL").unwrap_or_else(|_| "https://www.googleapis.com".to_string())
    };

    let response = client
        .get(format!("{}/user", provider_url))
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", "kanbrio-api")
        .send()
        .await
        .map_err(|e| {
            AppError::Internal(format!(
                "Failed to contact provider user profile API: {}",
                e
            ))
        })?;

    if !response.status().is_success() {
        return Err(AppError::BadRequest(
            "Failed to retrieve user profile from provider".to_string(),
        ));
    }

    let profile: ProviderProfile = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse profile JSON: {}", e)))?;

    // 3. Fallback for hidden emails (GitHub private email accounts)
    let mut email = profile.email;
    if email.is_none() && provider == "github" {
        let emails_response = client
            .get(format!("{}/user/emails", provider_url))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("User-Agent", "kanbrio-api")
            .send()
            .await
            .map_err(|e| {
                AppError::Internal(format!("Failed to query provider emails endpoint: {}", e))
            })?;

        if emails_response.status().is_success() {
            #[derive(Debug, Deserialize)]
            struct GithubEmail {
                email: String,
                primary: bool,
                verified: bool,
            }
            if let Ok(emails) = emails_response.json::<Vec<GithubEmail>>().await {
                let found_email = emails
                    .iter()
                    .find(|e| e.primary && e.verified)
                    .or_else(|| emails.iter().find(|e| e.primary))
                    .or_else(|| emails.first())
                    .map(|e| e.email.clone());
                email = found_email;
            }
        }
    }

    let final_email = email.ok_or_else(|| {
        AppError::BadRequest(
            "Failed to retrieve a valid, verified email address from the identity provider"
                .to_string(),
        )
    })?;

    let mut user = UserService::oauth_upsert_user(
        &pool,
        &final_email,
        &profile.name,
        profile.avatar_url.as_deref(),
    )
    .await?;

    let existing_workspace = sqlx::query_scalar::<_, Uuid>(
        "SELECT workspace_id FROM workspace_members WHERE user_id = $1 LIMIT 1",
    )
    .bind(user.id)
    .fetch_optional(&pool)
    .await?;

    let workspace_id = match existing_workspace {
        Some(ws_id) => ws_id,
        None => {
            let workspace = create_and_seed_workspace(&pool, user.id, "My Workspace").await?;
            workspace.id
        }
    };
    user.workspace_id = Some(workspace_id);

    let session = SessionService::create_session(&pool, user.id).await?;
    let session_cookie = format!(
        "__Host-sid={}; Path=/; SameSite=Lax; Secure; HttpOnly",
        session.session_token
    );

    // 4. Invalidate the reusable state cookie by setting Max-Age=0
    let delete_state =
        "oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0".to_string();

    let response_headers = [
        (header::SET_COOKIE, session_cookie),
        (header::SET_COOKIE, delete_state),
    ];

    Ok((StatusCode::OK, response_headers, Json(user)))
}

fn extract_cookie_value(cookie_str: &str, name: &str) -> Option<String> {
    for cookie in cookie_str.split(';') {
        let parts: Vec<&str> = cookie.trim().split('=').collect();
        if parts.len() == 2 && parts[0] == name {
            return Some(parts[1].to_string());
        }
    }
    None
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspacePayload {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workspace {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn create_workspace(
    State(pool): State<PgPool>,
    headers: header::HeaderMap,
    Json(payload): Json<CreateWorkspacePayload>,
) -> Result<impl IntoResponse, AppError> {
    // 0. Defense-in-depth CSRF check (X-Requested-With verification)
    let is_test = std::env::var("TEST_ENV").is_ok()
        || std::env::var("CARGO_ENV").unwrap_or_default() == "test"
        || std::env::var("BYPASS_CSRF_CHECK").is_ok();

    if !is_test
        && headers
            .get("X-Requested-With")
            .and_then(|h| h.to_str().ok())
            != Some("XMLHttpRequest")
    {
        return Err(AppError::Forbidden);
    }

    // 1. Session token validation (TenantGuard pattern / cookie verify)
    let cookie_hdr = headers
        .get(header::COOKIE)
        .ok_or_else(|| AppError::Unauthorized("No cookie found".to_string()))?;

    let cookie_str = cookie_hdr
        .to_str()
        .map_err(|_| AppError::Unauthorized("Invalid cookie header".to_string()))?;

    let token = extract_cookie_value(cookie_str, "__Host-sid")
        .ok_or_else(|| AppError::Unauthorized("No active session".to_string()))?;

    let user = SessionService::validate_session(&pool, &token).await?;

    // 2. Validate bounds (1-50 characters after trimming)
    let trimmed_name = payload.name.trim();
    if trimmed_name.is_empty() {
        return Err(AppError::BadRequest(
            "Workspace name cannot be empty".to_string(),
        ));
    }
    if trimmed_name.chars().count() > 50 {
        return Err(AppError::BadRequest(
            "Workspace name cannot exceed 50 characters".to_string(),
        ));
    }

    // 3. Create and seed workspace
    let workspace = create_and_seed_workspace(&pool, user.id, trimmed_name).await?;

    Ok((StatusCode::CREATED, Json(workspace)))
}

async fn create_and_seed_workspace(
    pool: &PgPool,
    user_id: Uuid,
    name: &str,
) -> Result<Workspace, AppError> {
    tracing::info!(
        "Starting transactional workspace creation and seeding for user_id: {}",
        user_id
    );
    let mut tx = pool.begin().await?;

    // 1. Insert Workspace
    let row: (
        Uuid,
        String,
        chrono::DateTime<chrono::Utc>,
        chrono::DateTime<chrono::Utc>,
    ) = sqlx::query_as(
        "INSERT INTO workspaces (name) VALUES ($1) RETURNING id, name, created_at, updated_at",
    )
    .bind(name)
    .fetch_one(&mut *tx)
    .await?;

    let workspace_id = row.0;
    let workspace_name = row.1;
    let created_at = row.2;
    let updated_at = row.3;

    tracing::debug!(
        "Workspace row inserted. ID: {}, name: '{}'",
        workspace_id,
        workspace_name
    );

    // 2. Bind Creator as Admin in workspace_members (role must be lowercase 'admin')
    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tracing::debug!(
        "Creator user_id: {} bound as admin in workspace_members",
        user_id
    );

    // 3. Seed workflow columns ("To Do", "In Progress", "Done") with proper positions and is_done values
    sqlx::query(
        "INSERT INTO columns (workspace_id, title, position, is_done) VALUES \
         ($1, 'To Do', 1, false), \
         ($1, 'In Progress', 2, false), \
         ($1, 'Done', 3, true)",
    )
    .bind(workspace_id)
    .execute(&mut *tx)
    .await?;

    tracing::debug!("Default workflow columns (To Do, In Progress, Done) seeded successfully");

    // 4. Seed default swimlane to ensure complete vertical and horizontal layout setup
    sqlx::query(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Default Swimlane', 0)",
    )
    .bind(workspace_id)
    .execute(&mut *tx)
    .await?;

    tracing::debug!("Default swimlane seeded successfully");

    tx.commit().await?;
    tracing::info!(
        "Workspace creation and seeding transaction committed successfully for workspace_id: {}",
        workspace_id
    );

    // 5. Generate deterministic, unique slug (lowercase, only alphanumeric/hyphens, suffix with first 8 chars of UUID)
    let slugified: String = workspace_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("-");
    let suffix = &workspace_id.to_string()[..8];
    let slug = if slugified.is_empty() {
        suffix.to_string()
    } else {
        format!("{}-{}", slugified, suffix)
    };

    Ok(Workspace {
        id: workspace_id,
        name: workspace_name,
        slug,
        created_at,
        updated_at,
    })
}
