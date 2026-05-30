use axum::{
    body::Body,
    http::{self, Request, StatusCode},
};
use kanbrio_api::create_app;
use kanbrio_api::models::card::{Card, CreateCard};
use kanbrio_api::services::session_service::SessionService;
use serde_json::json;
use tower::ServiceExt; // for `oneshot`
use uuid::Uuid;

#[sqlx::test]
async fn test_move_card_api_happy_path(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Setup
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

    // Insert workspace to satisfy FK
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let col_todo: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'To Do', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let col_done: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Done', 1) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let lane: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Lane', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let card = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "API Test Card".to_string(),
            current_column_id: col_todo.0,
            current_swimlane_id: lane.0,
        },
    )
    .await?;

    // Seed admin user and session
    let user_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, email, name) VALUES ($1, 'admin@example.com', 'Admin User')",
    )
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

    // 2. Action: Move via API
    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri(format!(
                    "/api/workspaces/{}/cards/{}/move",
                    workspace_id, card.id
                ))
                .header(http::header::CONTENT_TYPE, "application/json")
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .body(Body::from(
                    json!({
                        "to_column_id": col_done.0,
                        "to_swimlane_id": lane.0
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    // 3. Assert
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let updated_card: Card = serde_json::from_slice(&body).unwrap();

    assert_eq!(updated_card.current_column_id, col_done.0);

    Ok(())
}

#[sqlx::test]
async fn test_move_card_api_unauthenticated(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let col_todo: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'To Do', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let col_done: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Done', 1) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let lane: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Lane', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let card = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "API Test Card".to_string(),
            current_column_id: col_todo.0,
            current_swimlane_id: lane.0,
        },
    )
    .await?;

    let app = create_app(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri(format!(
                    "/api/workspaces/{}/cards/{}/move",
                    workspace_id, card.id
                ))
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "to_column_id": col_done.0,
                        "to_swimlane_id": lane.0
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    Ok(())
}

#[sqlx::test]
async fn test_move_card_api_non_member(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let col_todo: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'To Do', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let col_done: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Done', 1) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let lane: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Lane', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let card = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "API Test Card".to_string(),
            current_column_id: col_todo.0,
            current_swimlane_id: lane.0,
        },
    )
    .await?;

    // Seed user and session but NO workspace membership
    let user_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, email, name) VALUES ($1, 'random@example.com', 'Random User')",
    )
    .bind(user_id)
    .execute(&pool)
    .await?;

    let session = SessionService::create_session(&pool, user_id).await?;

    let app = create_app(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri(format!(
                    "/api/workspaces/{}/cards/{}/move",
                    workspace_id, card.id
                ))
                .header(http::header::CONTENT_TYPE, "application/json")
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .body(Body::from(
                    json!({
                        "to_column_id": col_done.0,
                        "to_swimlane_id": lane.0
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    Ok(())
}

#[sqlx::test]
async fn test_move_card_api_member_override_forbidden(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let col_todo: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'To Do', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let col_done: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Done', 1) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let lane: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Lane', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let card = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "API Test Card".to_string(),
            current_column_id: col_todo.0,
            current_swimlane_id: lane.0,
        },
    )
    .await?;

    // Seed regular member user and session
    let user_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, email, name) VALUES ($1, 'member@example.com', 'Member User')",
    )
    .bind(user_id)
    .execute(&pool)
    .await?;

    let session = SessionService::create_session(&pool, user_id).await?;

    // Set role to 'member' (NOT admin)
    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&pool)
    .await?;

    let app = create_app(pool);

    // Regular member attempts an override
    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri(format!(
                    "/api/workspaces/{}/cards/{}/move",
                    workspace_id, card.id
                ))
                .header(http::header::CONTENT_TYPE, "application/json")
                .header(
                    http::header::COOKIE,
                    format!("__Host-sid={}", session.session_token),
                )
                .body(Body::from(
                    json!({
                        "to_column_id": col_done.0,
                        "to_swimlane_id": lane.0,
                        "override_rules": true,
                        "override_reason": "Just because"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    Ok(())
}
