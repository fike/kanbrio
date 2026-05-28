use kanbrio_api::models::audit::CardTransition;
use kanbrio_api::models::board::{Column, Swimlane};
use kanbrio_api::models::card::{Card, CreateCard, MoveCard};
use uuid::Uuid;

#[sqlx::test]
async fn test_card_audit_trail(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Setup Environment
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

    // Create Workspace first (FK requirement)
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let col_a: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Col A', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;
    let col_b: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Col B', 1) RETURNING id",
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

    let col_a_id = col_a.0;
    let col_b_id = col_b.0;
    let lane_id = lane.0;

    // 2. Action: Create Card
    let card = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Audit Test".to_string(),
            current_column_id: col_a_id,
            current_swimlane_id: lane_id,
        },
    )
    .await?;

    // 3. Action: Move Card
    Card::move_to(
        &pool,
        MoveCard {
            card_id: card.id,
            workspace_id,
            to_column_id: col_b_id,
            to_swimlane_id: lane_id,
            user_id: None,
        },
    )
    .await?;

    // 4. Verification: Fetch History
    let history = CardTransition::get_history(&pool, card.id, workspace_id, 50, 0).await?;

    // We expect 2 entries: 1 for 'create', 1 for 'move', ordered by recent first
    assert_eq!(history.len(), 2);

    let latest = &history[0];
    assert_eq!(latest.transition_type, "move");
    assert_eq!(latest.from_column_id, Some(col_a_id));
    assert_eq!(latest.to_column_id, Some(col_b_id));

    let first = &history[1];
    assert_eq!(first.transition_type, "create");
    assert_eq!(first.to_column_id, Some(col_a_id));

    Ok(())
}

#[sqlx::test]
async fn test_card_lifecycle_auditing(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Setup Environment
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

    // Create Workspace first (FK requirement)
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
    let lane: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Lane', 0) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let col_id = col.0;
    let lane_id = lane.0;

    // 2. Action: Create Card (Should log with payload)
    let card = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Audited Card".to_string(),
            current_column_id: col_id,
            current_swimlane_id: lane_id,
        },
    )
    .await?;

    // 3. Action: Update Card
    let old_title = card.title.clone();
    let updated_card = card
        .update_title(&pool, "Updated Title".to_string())
        .await?;

    // 4. Action: Block Card
    updated_card
        .block(&pool, "Blocked for testing".to_string())
        .await?;

    // 5. Action: Unblock Card
    updated_card.unblock(&pool).await?;

    // 6. Action: Archive Card
    updated_card.archive(&pool).await?;

    // 7. Action: Delete Card (Should still log before final removal or if it's soft delete)
    // For now let's assume it logs the deletion event.
    updated_card.delete(&pool).await?;

    // 8. Verification: Fetch History
    // Note: delete might have removed the card, but card_transitions has ON DELETE CASCADE in current schema!
    // If it's ON DELETE CASCADE, the history will be gone.
    // The requirement says log 'delete'. This might mean we should NOT use CASCADE or we log it elsewhere.
    // Or 'delete' means something else. ADR 003 might have info.

    let history = CardTransition::get_history(&pool, card.id, workspace_id, 50, 0).await?;

    // Verify events and payloads
    // Ordered by occurred_at DESC
    assert_eq!(history[0].transition_type, "delete");
    assert_eq!(history[1].transition_type, "archive");
    assert_eq!(history[2].transition_type, "unblock");
    assert_eq!(history[3].transition_type, "block");
    assert_eq!(
        history[3].payload.as_ref().unwrap()["reason"],
        "Blocked for testing"
    );
    assert_eq!(history[4].transition_type, "update");
    assert_eq!(
        history[4].payload.as_ref().unwrap()["previous_title"],
        old_title
    );
    assert_eq!(history[5].transition_type, "create");

    Ok(())
}
