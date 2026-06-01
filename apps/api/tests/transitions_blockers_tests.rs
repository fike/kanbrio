use kanbrio_api::models::card::{Card, CreateCard, MoveCard};
use uuid::Uuid;

#[sqlx::test]
async fn test_card_blocking_and_movement_interception(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    let workspace_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    // Seed workspace and user
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    sqlx::query("INSERT INTO users (id, email, name) VALUES ($1, 'user@test.com', 'Test User')")
        .bind(user_id)
        .execute(&pool)
        .await?;

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&pool)
    .await?;

    // Seed board columns/swimlanes
    let col_todo: Uuid = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position, is_done) VALUES ($1, 'To Do', 1, FALSE) RETURNING id"
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await.map(|r: (Uuid,)| r.0)?;

    let col_progress: Uuid = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position, is_done) VALUES ($1, 'In Progress', 2, FALSE) RETURNING id"
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await.map(|r: (Uuid,)| r.0)?;

    let lane_id: Uuid = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Standard Swimlane', 1) RETURNING id"
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await.map(|r: (Uuid,)| r.0)?;

    // 2. Create card in To Do column
    let card_data = CreateCard {
        parent_id: None,
        workspace_id,
        title: "Blocker Test Card".to_string(),
        current_column_id: col_todo,
        current_swimlane_id: lane_id,
    };
    let card = Card::create(&pool, card_data).await?;
    assert!(!card.is_blocked);
    assert!(card.blocked_by.is_none());
    assert!(card.blocked_at.is_none());
    assert!(card.blocked_reason.is_none());

    // 3. Block the card
    let blocked_card = card
        .block(&pool, user_id, "API dependency blocked".to_string())
        .await?;
    assert!(blocked_card.is_blocked);
    assert_eq!(blocked_card.blocked_by, Some(user_id));
    assert!(blocked_card.blocked_at.is_some());
    assert_eq!(
        blocked_card.blocked_reason.as_deref(),
        Some("API dependency blocked")
    );

    // Verify database constraint and block state consistency
    let db_card: Card = sqlx::query_as("SELECT * FROM cards WHERE id = $1")
        .bind(card.id)
        .fetch_one(&pool)
        .await?;
    assert!(db_card.is_blocked);
    assert_eq!(db_card.blocked_by, Some(user_id));
    assert!(db_card.blocked_at.is_some());
    assert_eq!(
        db_card.blocked_reason.as_deref(),
        Some("API dependency blocked")
    );

    // Verify card transition event is recorded
    let transition: (String, serde_json::Value) = sqlx::query_as(
        "SELECT transition_type, payload FROM card_transitions WHERE card_id = $1 ORDER BY occurred_at DESC LIMIT 1"
    )
    .bind(card.id)
    .fetch_one(&pool)
    .await?;
    assert_eq!(transition.0, "block");
    assert_eq!(transition.1["reason"], "API dependency blocked");

    // 4. Try to move blocked card (Should fail)
    let move_result = Card::move_to(
        &pool,
        MoveCard {
            card_id: card.id,
            workspace_id,
            to_column_id: col_progress,
            to_swimlane_id: lane_id,
            user_id: Some(user_id),
            override_rules: None,
            override_reason: None,
        },
    )
    .await;

    assert!(move_result.is_err());
    let err_str = move_result.unwrap_err().to_string();
    assert!(
        err_str.contains("is blocked and cannot be moved"),
        "Expected block error, got: {}",
        err_str
    );

    // 5. Unblock card
    let unblocked_card = blocked_card.unblock(&pool, user_id).await?;
    assert!(!unblocked_card.is_blocked);
    assert!(unblocked_card.blocked_by.is_none());
    assert!(unblocked_card.blocked_at.is_none());
    assert!(unblocked_card.blocked_reason.is_none());

    // Verify card movement works after unblocking
    let moved_card = Card::move_to(
        &pool,
        MoveCard {
            card_id: card.id,
            workspace_id,
            to_column_id: col_progress,
            to_swimlane_id: lane_id,
            user_id: Some(user_id),
            override_rules: None,
            override_reason: None,
        },
    )
    .await?;
    assert_eq!(moved_card.current_column_id, col_progress);

    Ok(())
}

#[sqlx::test]
async fn test_card_block_comments_thread(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;

    let workspace_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    // Seed data
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Comment Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    sqlx::query(
        "INSERT INTO users (id, email, name) VALUES ($1, 'commenter@test.com', 'Commenter')",
    )
    .bind(user_id)
    .execute(&pool)
    .await?;

    let col_id: Uuid = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position, is_done) VALUES ($1, 'To Do', 1, FALSE) RETURNING id"
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await.map(|r: (Uuid,)| r.0)?;

    let lane_id: Uuid = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Lane', 1) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await
    .map(|r: (Uuid,)| r.0)?;

    let card_data = CreateCard {
        parent_id: None,
        workspace_id,
        title: "Block Comment Card".to_string(),
        current_column_id: col_id,
        current_swimlane_id: lane_id,
    };
    let card = Card::create(&pool, card_data).await?;

    // 1. Try to comment on unblocked card (Should fail)
    let comment_fail = Card::add_block_comment(
        &pool,
        card.id,
        user_id,
        "This comment should fail".to_string(),
    )
    .await;
    assert!(comment_fail.is_err());

    // 2. Block the card
    let card = card
        .block(&pool, user_id, "WIP Blocked".to_string())
        .await?;

    // 3. Comment on blocked card with empty content (Should fail)
    let empty_fail = Card::add_block_comment(&pool, card.id, user_id, "   ".to_string()).await;
    assert!(empty_fail.is_err());

    // 4. Comment on blocked card with valid content (Should succeed)
    let c1 = Card::add_block_comment(
        &pool,
        card.id,
        user_id,
        "Checking on resolution timeline".to_string(),
    )
    .await?;
    assert_eq!(c1.card_id, card.id);
    assert_eq!(c1.user_id, user_id);
    assert_eq!(c1.content, "Checking on resolution timeline");

    // Add a second comment
    let _c2 =
        Card::add_block_comment(&pool, card.id, user_id, "ETA is tomorrow".to_string()).await?;

    // 5. Get comments, verify ordering is chronologically correct (created_at ASC)
    let comments = Card::get_block_comments(&pool, card.id).await?;
    assert_eq!(comments.len(), 2);
    assert_eq!(comments[0].content, "Checking on resolution timeline");
    assert_eq!(comments[1].content, "ETA is tomorrow");

    Ok(())
}
