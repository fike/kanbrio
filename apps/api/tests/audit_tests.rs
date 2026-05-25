use kanbrio_api::models::audit::CardTransition;
use kanbrio_api::models::board::{Column, Swimlane};
use kanbrio_api::models::card::{Card, CreateCard, MoveCard};
use uuid::Uuid;

#[sqlx::test]
async fn test_card_audit_trail(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Setup Environment
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_id = Uuid::new_v4();

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
