use kanbrio_api::models::board::{BoardState, Column, Swimlane};
use kanbrio_api::models::card::{Card, CreateCard, MoveCard};
use uuid::Uuid;

use chrono::{DateTime, Utc};

#[derive(Debug, sqlx::FromRow)]
struct CardTransition {
    pub from_column_id: Option<Uuid>,
    pub to_column_id: Option<Uuid>,
    pub from_swimlane_id: Option<Uuid>,
    pub to_swimlane_id: Option<Uuid>,
}

#[sqlx::test]
async fn test_board_2d_context(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Manually run migrations (as established in Issue #1 tests)
    sqlx::migrate!("./migrations").run(&pool).await?;

    let workspace_id = Uuid::new_v4();

    // Insert workspace to satisfy FK
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    // 2. Create Board Structure
    let col_todo = sqlx::query_as::<_, Column>(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'To Do', 0) RETURNING *",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let col_doing = sqlx::query_as::<_, Column>(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Doing', 1) RETURNING *",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let lane_standard = sqlx::query_as::<_, Swimlane>(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Standard', 0) RETURNING *",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    // 3. Create Card in 2D Context
    let card = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Test Card".to_string(),
            current_column_id: col_todo.id,
            current_swimlane_id: lane_standard.id,
        },
    )
    .await?;

    // 4. Fetch Board State
    let state = BoardState::get_state(&pool, workspace_id).await?;
    assert_eq!(state.columns.len(), 2);
    assert_eq!(state.swimlanes.len(), 1);
    assert_eq!(state.cards.len(), 1);
    assert_eq!(state.cards[0].id, card.id);

    // 5. Move Card (2D Transition)
    let moved_card = Card::move_to(
        &pool,
        MoveCard {
            card_id: card.id,
            workspace_id,
            to_column_id: col_doing.id,
            to_swimlane_id: lane_standard.id,
            user_id: None,
        },
    )
    .await?;

    assert_eq!(moved_card.current_column_id, col_doing.id);

    // 6. Verify Audit Log (Issue #3 Requirement)
    let transition = sqlx::query_as::<_, CardTransition>(
        "SELECT from_column_id, to_column_id, from_swimlane_id, to_swimlane_id FROM card_transitions WHERE card_id = $1 AND transition_type = 'move'",
    )
    .bind(card.id)
    .fetch_one(&pool)
    .await?;

    assert_eq!(transition.from_column_id, Some(col_todo.id));
    assert_eq!(transition.to_column_id, Some(col_doing.id));
    assert_eq!(transition.from_swimlane_id, Some(lane_standard.id));
    assert_eq!(transition.to_swimlane_id, Some(lane_standard.id));

    Ok(())
}
