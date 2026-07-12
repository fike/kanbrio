use axum::{
    body::Body,
    http::{self, Request, StatusCode},
};
use kanbrio_api::create_app;
use kanbrio_api::services::session_service::SessionService;
use serde_json::json;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

#[sqlx::test]
async fn test_list_rules_empty(pool: PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let user_id = Uuid::new_v4();
    sqlx::query("INSERT INTO users (id, email, name) VALUES ($1, 'admin@kanbrio.dev', 'Admin')")
        .bind(user_id)
        .execute(&pool)
        .await?;

    let session = SessionService::create_session(&pool, user_id).await?;

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&pool)
    .await?;

    let app = create_app(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::GET)
                .uri(format!("/api/workspaces/{}/rules", workspace_id))
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    Ok(())
}

#[sqlx::test]
async fn test_list_rules_forbidden_for_non_admin(pool: PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let user_id = Uuid::new_v4();
    sqlx::query("INSERT INTO users (id, email, name) VALUES ($1, 'member@kanbrio.dev', 'Member')")
        .bind(user_id)
        .execute(&pool)
        .await?;

    let session = SessionService::create_session(&pool, user_id).await?;

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&pool)
    .await?;

    let app = create_app(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::GET)
                .uri(format!("/api/workspaces/{}/rules", workspace_id))
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    Ok(())
}

#[sqlx::test]
async fn test_create_rule(pool: PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let user_id = Uuid::new_v4();
    sqlx::query("INSERT INTO users (id, email, name) VALUES ($1, 'admin@kanbrio.dev', 'Admin')")
        .bind(user_id)
        .execute(&pool)
        .await?;

    let session = SessionService::create_session(&pool, user_id).await?;

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&pool)
    .await?;

    let app = create_app(pool);

    let body = json!({
        "name": "Auto-Move Parent to Done",
        "trigger_type": "child_status_changed",
        "trigger_config": {},
        "action_type": "move_parent_card",
        "action_config": {
            "in_progress_column_id": Uuid::new_v4().to_string(),
            "done_column_id": Uuid::new_v4().to_string()
        },
        "is_active": true
    });

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri(format!("/api/workspaces/{}/rules", workspace_id))
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);
    Ok(())
}

#[sqlx::test]
async fn test_create_rule_duplicate_name(pool: PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let user_id = Uuid::new_v4();
    sqlx::query("INSERT INTO users (id, email, name) VALUES ($1, 'admin@kanbrio.dev', 'Admin')")
        .bind(user_id)
        .execute(&pool)
        .await?;

    let session = SessionService::create_session(&pool, user_id).await?;

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&pool)
    .await?;

    let app = create_app(pool);

    let body = json!({
        "name": "Duplicate Rule",
        "trigger_type": "child_status_changed",
        "trigger_config": {},
        "action_type": "move_parent_card",
        "action_config": {}
    });

    let req = || -> Result<_, anyhow::Error> {
        Request::builder()
            .method(http::Method::POST)
            .uri(format!("/api/workspaces/{}/rules", workspace_id))
            .header(
                http::header::COOKIE,
                format!("__Host-sid={}", session.session_token),
            )
            .header(http::header::CONTENT_TYPE, "application/json")
            .body(Body::from(body.to_string()))
            .map_err(Into::into)
    };

    let response1 = app.clone().oneshot(req()?).await?;
    assert_eq!(response1.status(), StatusCode::CREATED);

    let response2 = app.oneshot(req()?).await?;
    assert_eq!(response2.status(), StatusCode::BAD_REQUEST);
    Ok(())
}

#[sqlx::test]
async fn test_update_rule_toggle_active(pool: PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let user_id = Uuid::new_v4();
    sqlx::query("INSERT INTO users (id, email, name) VALUES ($1, 'admin@kanbrio.dev', 'Admin')")
        .bind(user_id)
        .execute(&pool)
        .await?;

    let session = SessionService::create_session(&pool, user_id).await?;

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&pool)
    .await?;

    let app = create_app(pool);

    let create_body = json!({
        "name": "Toggle Rule",
        "trigger_type": "card_entered_column",
        "trigger_config": { "column_id": Uuid::new_v4().to_string() },
        "action_type": "assign_card",
        "action_config": {}
    });

    let create_resp = app
        .clone()
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri(format!("/api/workspaces/{}/rules", workspace_id))
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(Body::from(create_body.to_string()))?,
        )
        .await?;

    assert_eq!(create_resp.status(), StatusCode::CREATED);
    let body_bytes = axum::body::to_bytes(create_resp.into_body(), usize::MAX).await?;
    let rule: serde_json::Value = serde_json::from_slice(&body_bytes)?;
    let rule_id = rule["id"].as_str().unwrap();

    let update_body = json!({ "is_active": false });

    let update_resp = app
        .oneshot(
            Request::builder()
                .method(http::Method::PATCH)
                .uri(format!(
                    "/api/workspaces/{}/rules/{}",
                    workspace_id, rule_id
                ))
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(Body::from(update_body.to_string()))?,
        )
        .await?;

    assert_eq!(update_resp.status(), StatusCode::OK);

    let updated_body = axum::body::to_bytes(update_resp.into_body(), usize::MAX).await?;
    let updated: serde_json::Value = serde_json::from_slice(&updated_body)?;
    assert_eq!(updated["is_active"], false);

    Ok(())
}

#[sqlx::test]
async fn test_delete_rule(pool: PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let user_id = Uuid::new_v4();
    sqlx::query("INSERT INTO users (id, email, name) VALUES ($1, 'admin@kanbrio.dev', 'Admin')")
        .bind(user_id)
        .execute(&pool)
        .await?;

    let session = SessionService::create_session(&pool, user_id).await?;

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&pool)
    .await?;

    let app = create_app(pool);

    let create_body = json!({
        "name": "Rule to Delete",
        "trigger_type": "child_status_changed",
        "trigger_config": {},
        "action_type": "move_parent_card",
        "action_config": {}
    });

    let create_resp = app
        .clone()
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri(format!("/api/workspaces/{}/rules", workspace_id))
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(Body::from(create_body.to_string()))?,
        )
        .await?;

    let body_bytes = axum::body::to_bytes(create_resp.into_body(), usize::MAX).await?;
    let rule: serde_json::Value = serde_json::from_slice(&body_bytes)?;
    let rule_id = rule["id"].as_str().unwrap();

    let delete_resp = app
        .oneshot(
            Request::builder()
                .method(http::Method::DELETE)
                .uri(format!(
                    "/api/workspaces/{}/rules/{}",
                    workspace_id, rule_id
                ))
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(delete_resp.status(), StatusCode::NO_CONTENT);
    Ok(())
}
