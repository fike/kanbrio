use kanbrio_api::AppError;
use kanbrio_api::models::audit::CardTransition;
use kanbrio_api::models::card::{Card, CreateCard};
use uuid::Uuid;

#[sqlx::test]
async fn test_audit_history_isolation(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Setup Environment
    sqlx::migrate!("./migrations").run(&pool).await?;
    let workspace_a = Uuid::new_v4();
    let workspace_b = Uuid::new_v4();

    // Create a column and swimlane in Workspace A
    let col_a: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Col A', 0) RETURNING id",
    )
    .bind(workspace_a)
    .fetch_one(&pool)
    .await?;
    let lane_a: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Lane A', 0) RETURNING id",
    )
    .bind(workspace_a)
    .fetch_one(&pool)
    .await?;

    // 2. Create Card in Workspace A
    let card_a = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id: workspace_a,
            title: "Secret Card".to_string(),
            current_column_id: col_a.0,
            current_swimlane_id: lane_a.0,
        },
    )
    .await?;

    // 3. ATTEMPT TO READ HISTORY FROM WORKSPACE B (Should fail)
    let result = CardTransition::get_history(&pool, card_a.id, workspace_b, 50, 0).await;

    match result {
        Err(AppError::Forbidden) => {} // PASS
        other => panic!("Expected Forbidden error, got {:?}", other),
    }

    // 4. READ HISTORY FROM WORKSPACE A (Should succeed)
    let history = CardTransition::get_history(&pool, card_a.id, workspace_a, 50, 0).await?;
    assert!(!history.is_empty());
    assert_eq!(history[0].card_id, card_a.id);

    Ok(())
}
