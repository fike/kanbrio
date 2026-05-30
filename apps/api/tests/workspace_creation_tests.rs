// File: apps/api/tests/workspace_creation_tests.rs
use axum::{
    body::Body,
    http::{self, Request, StatusCode},
};
use kanbrio_api::create_app;
use serde_json::json;
use tower::ServiceExt;

#[sqlx::test]
async fn test_workspace_creation_and_seeding_flow(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let app = create_app(pool.clone());

    // 1. Create a user
    let user: kanbrio_api::models::user::User =
        sqlx::query_as("INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *")
            .bind("Workspace Founder")
            .bind("founder@kanbrio.io")
            .fetch_one(&pool)
            .await?;

    // 2. Create a session
    let session =
        kanbrio_api::services::session_service::SessionService::create_session(&pool, user.id)
            .await?;

    // 3. Make workspace creation request
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/api/workspaces")
                .header(http::header::CONTENT_TYPE, "application/json")
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .body(Body::from(
                    json!({
                        "name": "  Kanbrio Startup  "
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    // Parse response
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let res_json: serde_json::Value = serde_json::from_slice(&body_bytes)?;

    assert_eq!(res_json["name"], "Kanbrio Startup");
    let ws_id_str = res_json["id"].as_str().expect("id should be a string");
    let ws_id = uuid::Uuid::parse_str(ws_id_str)?;
    let ws_slug = res_json["slug"].as_str().expect("slug should be a string");

    assert!(ws_slug.starts_with("kanbrio-startup-"));

    // 4. Verify Admin Membership Binding in DB
    let role: String = sqlx::query_scalar(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
    )
    .bind(ws_id)
    .bind(user.id)
    .fetch_one(&pool)
    .await?;
    assert_eq!(role, "admin");

    // 5. Verify Column Seeding (To Do, In Progress, Done) in DB
    let seeded_cols: Vec<(String, i32, bool)> = sqlx::query_as(
        "SELECT title, position, is_done FROM columns WHERE workspace_id = $1 ORDER BY position ASC"
    )
    .bind(ws_id)
    .fetch_all(&pool)
    .await?;

    assert_eq!(seeded_cols.len(), 3);
    assert_eq!(seeded_cols[0], ("To Do".to_string(), 1, false));
    assert_eq!(seeded_cols[1], ("In Progress".to_string(), 2, false));
    assert_eq!(seeded_cols[2], ("Done".to_string(), 3, true));

    // 6. Verify a Default Swimlane is created/seeded in DB
    let seeded_swimlanes: Vec<(String, i32)> = sqlx::query_as(
        "SELECT title, position FROM swimlanes WHERE workspace_id = $1 ORDER BY position ASC",
    )
    .bind(ws_id)
    .fetch_all(&pool)
    .await?;
    assert_eq!(seeded_swimlanes.len(), 1);
    assert_eq!(seeded_swimlanes[0], ("Default Swimlane".to_string(), 0));

    Ok(())
}

#[sqlx::test]
async fn test_workspace_creation_invalid_name(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let app = create_app(pool.clone());

    let user: kanbrio_api::models::user::User =
        sqlx::query_as("INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *")
            .bind("Workspace Founder")
            .bind("founder@kanbrio.io")
            .fetch_one(&pool)
            .await?;

    let session =
        kanbrio_api::services::session_service::SessionService::create_session(&pool, user.id)
            .await?;

    // Test too short (empty after trimming)
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/api/workspaces")
                .header(http::header::CONTENT_TYPE, "application/json")
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .body(Body::from(
                    json!({
                        "name": "   "
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // Test too long (>50 characters)
    let response2 = app
        .clone()
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/api/workspaces")
                .header(http::header::CONTENT_TYPE, "application/json")
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .body(Body::from(
                    json!({
                        "name": "a".repeat(51)
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(response2.status(), StatusCode::BAD_REQUEST);

    Ok(())
}
