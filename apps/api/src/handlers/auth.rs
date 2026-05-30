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
    pub email: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

pub async fn register(
    State(pool): State<PgPool>,
    Json(payload): Json<RegisterPayload>,
) -> Result<impl IntoResponse, AppError> {
    if payload.name.trim().is_empty()
        || payload.email.trim().is_empty()
        || payload.password.trim().is_empty()
    {
        return Err(AppError::BadRequest(
            "Missing registration fields".to_string(),
        ));
    }

    let mut user =
        UserService::register_user(&pool, &payload.name, &payload.email, &payload.password).await?;
    let workspace = create_and_seed_workspace(&pool, user.id, "My Workspace").await?;
    user.workspace_id = Some(workspace.id);
    let session = SessionService::create_session(&pool, user.id).await?;

    let cookie = format!(
        "__Host-sid={}; Path=/; SameSite=Lax; Secure; HttpOnly",
        session.session_token
    );

    let headers = [(header::SET_COOKIE, cookie)];

    Ok((StatusCode::CREATED, headers, Json(user)))
}

pub async fn login(
    State(pool): State<PgPool>,
    Json(payload): Json<LoginPayload>,
) -> Result<impl IntoResponse, AppError> {
    let user = UserService::authenticate_user(&pool, &payload.email, &payload.password).await?;
    let session = SessionService::create_session(&pool, user.id).await?;

    let cookie = format!(
        "__Host-sid={}; Path=/; SameSite=Lax; Secure; HttpOnly",
        session.session_token
    );

    let headers = [(header::SET_COOKIE, cookie)];

    Ok((StatusCode::OK, headers, Json(user)))
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

    let provider_url = if provider == "github" {
        std::env::var("GITHUB_API_URL").unwrap_or_else(|_| "https://api.github.com".to_string())
    } else {
        std::env::var("GOOGLE_API_URL").unwrap_or_else(|_| "https://www.googleapis.com".to_string())
    };

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/user", provider_url))
        .header("Authorization", format!("Bearer {}", params.code))
        .header("User-Agent", "kanbrio-api")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to contact provider: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::BadRequest(
            "Failed to retrieve user profile from provider".to_string(),
        ));
    }

    let profile: ProviderProfile = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse profile JSON: {}", e)))?;

    let mut user = UserService::oauth_upsert_user(
        &pool,
        &profile.email,
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

    let response_headers = [(header::SET_COOKIE, session_cookie)];

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

    // 2. Bind Creator as Admin in workspace_members (role must be lowercase 'admin')
    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

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

    // 4. Seed default swimlane to ensure complete vertical and horizontal layout setup
    sqlx::query(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Default Swimlane', 0)",
    )
    .bind(workspace_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

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
