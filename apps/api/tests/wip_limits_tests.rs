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
    assert!(matches!(
        move_result,
        Err(AppError::WipLimitExceeded { .. })
    ));

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

    assert!(matches!(
        create_result,
        Err(AppError::WipLimitExceeded { .. })
    ));

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

#[sqlx::test]
async fn test_swimlane_wip_limit_enforcement(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

    // Insert workspace to satisfy FK
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let col: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Col', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let lane_with_limit: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position, wip_limit) VALUES ($1, 'Limited Lane', 0, 1) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let lane_unlimited: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Unlimited Lane', 1) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let col_id = col.0;
    let lane_limit_id = lane_with_limit.0;
    let lane_unlimit_id = lane_unlimited.0;

    // 1. Create first card in limited swimlane (Success)
    let card1 = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 1".to_string(),
            current_column_id: col_id,
            current_swimlane_id: lane_limit_id,
        },
    )
    .await?;

    // 2. Create second card in unlimited swimlane (Success)
    let card2 = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 2".to_string(),
            current_column_id: col_id,
            current_swimlane_id: lane_unlimit_id,
        },
    )
    .await?;

    // 3. Attempt to move card2 to limited swimlane (Failure)
    let move_result = Card::move_to(
        &pool,
        MoveCard {
            card_id: card2.id,
            workspace_id,
            to_column_id: col_id,
            to_swimlane_id: lane_limit_id,
            user_id: None,
        },
    )
    .await;

    assert!(matches!(
        move_result,
        Err(AppError::WipLimitExceeded { ref entity, limit }) if entity == "swimlane" && limit == 1
    ));

    // 4. Move Card 1 OUT of the limited swimlane
    Card::move_to(
        &pool,
        MoveCard {
            card_id: card1.id,
            workspace_id,
            to_column_id: col_id,
            to_swimlane_id: lane_unlimit_id,
            user_id: None,
        },
    )
    .await?;

    // 5. Now Card 2 should be able to move in (Success)
    let move_result_success = Card::move_to(
        &pool,
        MoveCard {
            card_id: card2.id,
            workspace_id,
            to_column_id: col_id,
            to_swimlane_id: lane_limit_id,
            user_id: None,
        },
    )
    .await;

    assert!(move_result_success.is_ok());
    assert_eq!(
        move_result_success.unwrap().current_swimlane_id,
        lane_limit_id
    );

    // 6. Attempt to CREATE another card directly in the limited swimlane (Failure)
    let create_result = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 3".to_string(),
            current_column_id: col_id,
            current_swimlane_id: lane_limit_id,
        },
    )
    .await;

    assert!(matches!(
        create_result,
        Err(AppError::WipLimitExceeded { ref entity, limit }) if entity == "swimlane" && limit == 1
    ));

    Ok(())
}

#[sqlx::test]
async fn test_soft_deleted_cards_ignored_by_wip_limit(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

    // Insert workspace
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let col: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position, wip_limit) VALUES ($1, 'Limited Col', 0, 1) RETURNING id",
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

    let col_id = col.0;
    let lane_id = lane.0;

    // 1. Create first card in limited column (Success)
    let card1 = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 1".to_string(),
            current_column_id: col_id,
            current_swimlane_id: lane_id,
        },
    )
    .await?;

    // 2. Attempt to create second card in limited column (Failure - Limit Exceeded)
    let create_result = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 2".to_string(),
            current_column_id: col_id,
            current_swimlane_id: lane_id,
        },
    )
    .await;

    assert!(matches!(
        create_result,
        Err(AppError::WipLimitExceeded { ref entity, limit }) if entity == "column" && limit == 1
    ));

    // 3. Soft-delete Card 1
    card1.delete(&pool).await?;

    // 4. Attempt to create second card again (Success - because Card 1 is soft-deleted)
    let create_result_success = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 2".to_string(),
            current_column_id: col_id,
            current_swimlane_id: lane_id,
        },
    )
    .await;

    assert!(create_result_success.is_ok());

    Ok(())
}

#[sqlx::test]
async fn test_user_wip_limits_enforcement(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;

    // 1. Seed user, workspace, column (active), swimlane
    let workspace_id = Uuid::new_v4();
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Engineering')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let user_id = Uuid::new_v4();
    sqlx::query("INSERT INTO users (id, email, name) VALUES ($1, 'dev@kanbrio.io', 'Developer')")
        .bind(user_id)
        .execute(&pool)
        .await?;

    sqlx::query("INSERT INTO workspace_members (workspace_id, user_id, role, wip_limit) VALUES ($1, $2, 'member', 2)")
        .bind(workspace_id)
        .bind(user_id)
        .execute(&pool)
        .await?;

    let active_col: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position, is_done) VALUES ($1, 'In Progress', 1, FALSE) RETURNING id"
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let done_col: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position, is_done) VALUES ($1, 'Done', 2, TRUE) RETURNING id"
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let lane_id: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Standard', 0) RETURNING id"
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    // 2. Create 2 active cards and assign to User
    let card1 = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 1".to_string(),
            current_column_id: active_col.0,
            current_swimlane_id: lane_id.0,
        },
    )
    .await?;

    let card2 = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 2".to_string(),
            current_column_id: active_col.0,
            current_swimlane_id: lane_id.0,
        },
    )
    .await?;

    // Assign the first two cards
    Card::assign_to(
        &pool,
        workspace_id,
        user_id,
        card1.id,
        Some(user_id),
        false,
        false,
        None,
    )
    .await?;
    Card::assign_to(
        &pool,
        workspace_id,
        user_id,
        card2.id,
        Some(user_id),
        false,
        false,
        None,
    )
    .await?;

    // 3. Attempt to assign a 3rd active card (Should FAIL with WipLimitExceeded)
    let card3 = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Card 3".to_string(),
            current_column_id: active_col.0,
            current_swimlane_id: lane_id.0,
        },
    )
    .await?;

    let assignment_err = Card::assign_to(
        &pool,
        workspace_id,
        user_id,
        card3.id,
        Some(user_id),
        false,
        false,
        None,
    )
    .await
    .unwrap_err();

    assert!(matches!(
        assignment_err,
        AppError::WipLimitExceeded { ref entity, limit } if entity == "user" && limit == 2
    ));

    // 4. Assign to a Completed Column card (Should SUCCESS since target is completed)
    let card_done = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Done Card".to_string(),
            current_column_id: done_col.0,
            current_swimlane_id: lane_id.0,
        },
    )
    .await?;

    Card::assign_to(
        &pool,
        workspace_id,
        user_id,
        card_done.id,
        Some(user_id),
        false,
        false,
        None,
    )
    .await?;

    // 5. Admin override (Should SUCCESS)
    Card::assign_to(
        &pool,
        workspace_id,
        user_id,
        card3.id,
        Some(user_id),
        true,
        true,
        Some("Hotfix override".to_string()),
    )
    .await?;

    // Verify User has now 3 active cards assigned due to admin override
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM cards WHERE assigned_user_id = $1 AND current_column_id = $2",
    )
    .bind(user_id)
    .bind(active_col.0)
    .fetch_one(&pool)
    .await?;
    assert_eq!(count.0, 3);

    // 6. IDOR boundary isolation verification
    // Attempting to assign a card using a mismatched workspace_id returns AppError::Forbidden
    let other_workspace_id = Uuid::new_v4();
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Other Workspace')")
        .bind(other_workspace_id)
        .execute(&pool)
        .await?;

    let idor_err = Card::assign_to(
        &pool,
        other_workspace_id,
        user_id,
        card3.id,
        Some(user_id),
        false,
        false,
        None,
    )
    .await
    .unwrap_err();

    assert!(matches!(idor_err, AppError::Forbidden));

    Ok(())
}
