use kanbrio_api::AppError;
use kanbrio_api::models::card::{Card, CreateCard};
use uuid::Uuid;

#[sqlx::test]
async fn test_transactional_card_creation_and_wip_limits(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;

    let workspace_id = Uuid::new_v4();
    let col_id = Uuid::new_v4();
    let lane_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    // 1. Seed base structures
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Workspace Acme')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;
    sqlx::query("INSERT INTO users (id, email, name) VALUES ($1, 'user@kanbrio.io', 'User Admin')")
        .bind(user_id)
        .execute(&pool)
        .await?;
    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
    )
    .bind(workspace_id)
    .bind(user_id)
    .execute(&pool)
    .await?;

    // Set WIP limit of 1 on the column
    sqlx::query("INSERT INTO columns (id, workspace_id, title, position, wip_limit) VALUES ($1, $2, 'To Do', 1, 1)")
        .bind(col_id).bind(workspace_id).execute(&pool).await?;
    sqlx::query("INSERT INTO swimlanes (id, workspace_id, title, position) VALUES ($1, $2, 'Swimlane 1', 1)").bind(lane_id).bind(workspace_id).execute(&pool).await?;

    // 2. Create first card (Should succeed)
    let card1 = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Task 1".to_string(),
            current_column_id: col_id,
            current_swimlane_id: lane_id,
        },
    )
    .await?;
    assert_eq!(card1.title, "Task 1");

    // 3. Create second card in same column (Should fail due to WIP Limit of 1)
    let card2_res = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Task 2".to_string(),
            current_column_id: col_id,
            current_swimlane_id: lane_id,
        },
    )
    .await;

    assert!(card2_res.is_err());
    match card2_res.unwrap_err() {
        AppError::WipLimitExceeded { entity, limit } => {
            assert_eq!(entity, "column");
            assert_eq!(limit, 1);
        }
        _ => panic!("Expected WipLimitExceeded error"),
    }

    Ok(())
}
