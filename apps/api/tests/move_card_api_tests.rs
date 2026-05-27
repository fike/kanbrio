use axum::{
    body::Body,
    http::{self, Request, StatusCode},
};
use kanbrio_api::create_app;
use kanbrio_api::models::card::{Card, CreateCard};
use serde_json::json;
use tower::ServiceExt; // for `oneshot`
use uuid::Uuid;

#[sqlx::test]
async fn test_move_card_api(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Setup
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

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
