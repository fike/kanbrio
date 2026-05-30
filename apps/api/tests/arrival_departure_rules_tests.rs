use kanbrio_api::models::card::{Card, CreateCard, MoveCard};
use uuid::Uuid;

#[sqlx::test]
async fn test_arrival_departure_rules(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    let workspace_id = Uuid::new_v4();
    let admin_id = Uuid::new_v4();

    // Seed workspace and admin user
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Rule Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    sqlx::query("INSERT INTO users (id, email, name) VALUES ($1, 'admin@test.com', 'Admin User')")
        .bind(admin_id)
        .execute(&pool)
        .await?;

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
    )
    .bind(workspace_id)
    .bind(admin_id)
    .execute(&pool)
    .await?;

    // Seed board components
    let col_backlog: Uuid = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position, is_done) VALUES ($1, 'Backlog', 1, FALSE) RETURNING id"
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await.map(|r: (Uuid,)| r.0)?;

    let col_review: Uuid = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position, is_done) VALUES ($1, 'Review', 2, FALSE) RETURNING id"
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await.map(|r: (Uuid,)| r.0)?;

    let lane_id: Uuid = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Standard', 1) RETURNING id"
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await.map(|r: (Uuid,)| r.0)?;

    // 2. Set Arrival Rule on 'Review' Column: assignee_required
    sqlx::query(
        "INSERT INTO transition_rules (workspace_id, column_id, rule_type, criteria_type) VALUES ($1, $2, 'arrival', 'assignee_required')"
    )
    .bind(workspace_id)
    .bind(col_review)
    .execute(&pool)
    .await?;

    // 3. Create a card with no assignee in Backlog
    let card_data = CreateCard {
        parent_id: None,
        workspace_id,
        title: "Rule Bound Card".to_string(),
        current_column_id: col_backlog,
        current_swimlane_id: lane_id,
    };
    let card = Card::create(&pool, card_data).await?;

    // 4. Try to move to 'Review' column (Should FAIL due to assignee_required rule)
    let move_fail = Card::move_to(
        &pool,
        MoveCard {
            card_id: card.id,
            workspace_id,
            to_column_id: col_review,
            to_swimlane_id: lane_id,
            user_id: Some(admin_id),
            override_rules: Some(false),
            override_reason: None,
        },
    )
    .await;

    assert!(move_fail.is_err());
    let err = move_fail.unwrap_err();
    assert!(
        err.to_string().contains("Assignee is required"),
        "Expected error to complain about missing assignee, got: {:?}",
        err
    );

    // 5. Assign the card to admin user
    sqlx::query("UPDATE cards SET assigned_user_id = $1 WHERE id = $2")
        .bind(admin_id)
        .bind(card.id)
        .execute(&pool)
        .await?;

    // 6. Set Departure Rule on 'Backlog' Column: checklist_completed
    sqlx::query(
        "INSERT INTO transition_rules (workspace_id, column_id, rule_type, criteria_type) VALUES ($1, $2, 'departure', 'checklist_completed')"
    )
    .bind(workspace_id)
    .bind(col_backlog)
    .execute(&pool)
    .await?;

    // Add uncompleted checklist item to card
    sqlx::query(
        "INSERT INTO card_checklists (card_id, title, is_completed, position) VALUES ($1, 'Do things', FALSE, 1)"
    )
    .bind(card.id)
    .execute(&pool)
    .await?;

    // 7. Try to move to 'Review' column (Should FAIL due to checklist_completed rule)
    let move_fail_2 = Card::move_to(
        &pool,
        MoveCard {
            card_id: card.id,
            workspace_id,
            to_column_id: col_review,
            to_swimlane_id: lane_id,
            user_id: Some(admin_id),
            override_rules: Some(false),
            override_reason: None,
        },
    )
    .await;

    assert!(move_fail_2.is_err());
    let err2 = move_fail_2.unwrap_err();
    assert!(
        err2.to_string()
            .contains("All checklist items must be completed"),
        "Expected error to complain about checklist, got: {:?}",
        err2
    );

    // 8. Try to move with ADMIN OVERRIDE (Should succeed!)
    let move_success = Card::move_to(
        &pool,
        MoveCard {
            card_id: card.id,
            workspace_id,
            to_column_id: col_review,
            to_swimlane_id: lane_id,
            user_id: Some(admin_id),
            override_rules: Some(true),
            override_reason: Some("Critical hotfix bypass".to_string()),
        },
    )
    .await?;

    assert_eq!(move_success.current_column_id, col_review);

    // Check that transaction type is 'move_override'
    let transition: (String, serde_json::Value) = sqlx::query_as(
        "SELECT transition_type, payload FROM card_transitions WHERE card_id = $1 ORDER BY occurred_at DESC LIMIT 1"
    )
    .bind(card.id)
    .fetch_one(&pool)
    .await?;

    assert_eq!(transition.0, "move_override");
    assert_eq!(transition.1["override_reason"], "Critical hotfix bypass");
    assert_eq!(transition.1["is_override"], true);

    Ok(())
}
