use kanbrio_api::models::card::{Card, CreateCard};
use uuid::Uuid;

#[sqlx::test]
async fn test_card_hierarchy(pool: sqlx::PgPool) -> anyhow::Result<()> {
    // 1. Manually run migrations (as established in Issue #1 tests)
    sqlx::migrate!("./migrations").run(&pool).await?;

    let workspace_id = Uuid::new_v4();

    // Insert workspace to satisfy FK
    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    // 2. Create valid board structure to satisfy foreign keys
    let column: (Uuid,) = sqlx::query_as(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Test Col', 0) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let swimlane: (Uuid,) = sqlx::query_as(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Test Lane', 0) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let column_id = column.0;
    let swimlane_id = swimlane.0;

    // 3. Create root card
    let root_data = CreateCard {
        parent_id: None,
        workspace_id,
        title: "Root Card".to_string(),
        current_column_id: column_id,
        current_swimlane_id: swimlane_id,
    };
    let root_card = Card::create(&pool, root_data).await?;
    assert_eq!(root_card.title, "Root Card");
    assert_eq!(root_card.parent_id, None);

    // 2. Create child card
    let child_data = CreateCard {
        parent_id: Some(root_card.id),
        workspace_id,
        title: "Child Card".to_string(),
        current_column_id: column_id,
        current_swimlane_id: swimlane_id,
    };
    let child_card = Card::create(&pool, child_data).await?;
    assert_eq!(child_card.title, "Child Card");
    assert_eq!(child_card.parent_id, Some(root_card.id));

    // 3. Create grandchild card
    let grandchild_data = CreateCard {
        parent_id: Some(child_card.id),
        workspace_id,
        title: "Grandchild Card".to_string(),
        current_column_id: column_id,
        current_swimlane_id: swimlane_id,
    };
    let grandchild_card = Card::create(&pool, grandchild_data).await?;
    assert_eq!(grandchild_card.parent_id, Some(child_card.id));

    // 4. Fetch hierarchy
    let hierarchy = Card::get_hierarchy(&pool, root_card.id).await?;

    assert_eq!(hierarchy.card.id, root_card.id);
    assert_eq!(hierarchy.children.len(), 1);

    let child_node = &hierarchy.children[0];
    assert_eq!(child_node.card.id, child_card.id);
    assert_eq!(child_node.children.len(), 1);

    let grandchild_node = &child_node.children[0];
    assert_eq!(grandchild_node.card.id, grandchild_card.id);
    assert_eq!(grandchild_node.children.len(), 0);

    Ok(())
}

#[sqlx::test]
async fn test_get_hierarchy_not_found(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let result = Card::get_hierarchy(&pool, Uuid::new_v4()).await;
    assert!(result.is_err());
    Ok(())
}

#[sqlx::test]
async fn test_auto_propagation_basic(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;

    let workspace_id = Uuid::new_v4();

    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let backlog_col_id: Uuid = sqlx::query_scalar(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Backlog', 0) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let active_col_id: Uuid = sqlx::query_scalar(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Active', 1) RETURNING id",
    )
    .bind(workspace_id)
    .fetch_one(&pool)
    .await?;

    let swimlane_id: Uuid = sqlx::query_scalar(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Test Lane', 0) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let parent = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Parent Card".to_string(),
            current_column_id: backlog_col_id,
            current_swimlane_id: swimlane_id,
        },
    )
    .await?;

    let child = Card::create(
        &pool,
        CreateCard {
            parent_id: Some(parent.id),
            workspace_id,
            title: "Child Card".to_string(),
            current_column_id: backlog_col_id,
            current_swimlane_id: swimlane_id,
        },
    )
    .await?;

    use kanbrio_api::models::card::MoveCard;
    let updated_child = Card::move_to(
        &pool,
        MoveCard {
            card_id: child.id,
            workspace_id,
            to_column_id: active_col_id,
            to_swimlane_id: swimlane_id,
            user_id: None,
            override_rules: None,
            override_reason: None,
        },
    )
    .await?;

    assert_eq!(updated_child.current_column_id, active_col_id);

    let parent_updated = sqlx::query_as::<_, Card>("SELECT * FROM cards WHERE id = $1")
        .bind(parent.id)
        .fetch_one(&pool)
        .await?;
    assert_eq!(parent_updated.current_column_id, active_col_id);

    let transition_type: String = sqlx::query_scalar(
        "SELECT transition_type FROM card_transitions WHERE card_id = $1 AND transition_type = 'system_auto_move'"
    )
    .bind(parent.id)
    .fetch_one(&pool)
    .await?;
    assert_eq!(transition_type, "system_auto_move");

    Ok(())
}

#[sqlx::test]
async fn test_auto_propagation_wip_safety(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;

    let workspace_id = Uuid::new_v4();

    sqlx::query("INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')")
        .bind(workspace_id)
        .execute(&pool)
        .await?;

    let backlog_col_id: Uuid = sqlx::query_scalar(
        "INSERT INTO columns (workspace_id, title, position) VALUES ($1, 'Backlog', 0) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let active_col_id: Uuid = sqlx::query_scalar(
        "INSERT INTO columns (workspace_id, title, position, wip_limit) VALUES ($1, 'Active', 1, 1) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let swimlane_id: Uuid = sqlx::query_scalar(
        "INSERT INTO swimlanes (workspace_id, title, position) VALUES ($1, 'Test Lane', 0) RETURNING id"
    ).bind(workspace_id).fetch_one(&pool).await?;

    let parent = Card::create(
        &pool,
        CreateCard {
            parent_id: None,
            workspace_id,
            title: "Parent Card".to_string(),
            current_column_id: backlog_col_id,
            current_swimlane_id: swimlane_id,
        },
    )
    .await?;

    let child = Card::create(
        &pool,
        CreateCard {
            parent_id: Some(parent.id),
            workspace_id,
            title: "Child Card".to_string(),
            current_column_id: backlog_col_id,
            current_swimlane_id: swimlane_id,
        },
    )
    .await?;

    use kanbrio_api::models::card::MoveCard;
    let updated_child = Card::move_to(
        &pool,
        MoveCard {
            card_id: child.id,
            workspace_id,
            to_column_id: active_col_id,
            to_swimlane_id: swimlane_id,
            user_id: None,
            override_rules: None,
            override_reason: None,
        },
    )
    .await?;

    assert_eq!(updated_child.current_column_id, active_col_id);

    let parent_updated = sqlx::query_as::<_, Card>("SELECT * FROM cards WHERE id = $1")
        .bind(parent.id)
        .fetch_one(&pool)
        .await?;
    assert_eq!(parent_updated.current_column_id, backlog_col_id);

    Ok(())
}
