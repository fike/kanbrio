use kanbrio_api::AppError;
use kanbrio_api::models::board::{Column, Swimlane};
use kanbrio_api::models::card::{Card, CreateCard, MoveCard};
use uuid::Uuid;

#[sqlx::test]
async fn test_wip_limit_enforcement(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Setup Environment
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

    // Insert workspace to satisfy FK
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    // Create a column with WIP limit = 1
    let col_with_limit: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position, wip_limit) VALUES ($1, 'Limited Col', 0, 1) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let col_unlimited: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Unlimited Col', 1) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let lane: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Lane', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let col_limit_id = col_with_limit.0;
    let col_unlimit_id = col_unlimited.0;
    let lane_id = lane.0;

    // 2. Action: Create first card in limited column (Success)
    let card1 = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 1".to_string(),
            current_column_id: col_limit_id,
            current_swimlane_id: lane_id,
        },
    )
    .await?;

    // 3. Action: Attempt to move another card into the limited column (Failure)
    let card2 = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 2".to_string(),
            current_column_id: col_unlimit_id,
            current_swimlane_id: lane_id,
        },
    )
    .await?;

    let move_result = Card::move_to(
        &pool,
        MoveCard {
            card_id: card2.id,
            workspace_id,
            to_column_id: col_limit_id,
            to_swimlane_id: lane_id,
            user_id: None,
        },
    )
    .await;

    // Verify it failed with WipLimitExceeded
    assert!(matches!(move_result, Err(AppError::WipLimitExceeded)));

    // 4. Action: Move Card 1 OUT of the limited column
    Card::move_to(
        &pool,
        MoveCard {
            card_id: card1.id,
            workspace_id,
            to_column_id: col_unlimit_id,
            to_swimlane_id: lane_id,
            user_id: None,
        },
    )
    .await?;

    // 5. Action: Now Card 2 should be able to move in (Success)
    let move_result_success = Card::move_to(
        &pool,
        MoveCard {
            card_id: card2.id,
            workspace_id,
            to_column_id: col_limit_id,
            to_swimlane_id: lane_id,
            user_id: None,
        },
    )
    .await;

    assert!(move_result_success.is_ok());
    assert_eq!(move_result_success.unwrap().current_column_id, col_limit_id);

    // 6. Action: Attempt to CREATE another card directly in the limited column (Failure)
    let create_result = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 3".to_string(),
            current_column_id: col_limit_id,
            current_swimlane_id: lane_id,
        },
    )
    .await;

    assert!(matches!(create_result, Err(AppError::WipLimitExceeded)));

    Ok(())
}

#[sqlx::test]
async fn test_wip_limit_ignore_same_column(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

    // Insert workspace to satisfy FK
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    // Create a column with WIP limit = 1
    let col: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position, wip_limit) VALUES ($1, 'Limited Col', 0, 1) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let lane1: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Lane 1', 0) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let lane2: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Lane 2', 1) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let col_id = col.0;
    let lane1_id = lane1.0;
    let lane2_id = lane2.0;

    let card = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 1".to_string(),
            current_column_id: col_id,
            current_swimlane_id: lane1_id,
        },
    )
    .await?;

    // Moving within the same column (change swimlane) should NOT be blocked by WIP limit
    let move_result = Card::move_to(
        &pool,
        MoveCard {
            card_id: card.id,
            workspace_id,
            to_column_id: col_id,
            to_swimlane_id: lane2_id,
            user_id: None,
        },
    )
    .await;

    assert!(move_result.is_ok());
    assert_eq!(move_result.unwrap().current_swimlane_id, lane2_id);

    Ok(())
}
