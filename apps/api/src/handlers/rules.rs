use crate::AppError;
use crate::models::rule::BusinessRule;
use axum::{
    Json,
    extract::{Path, State},
};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, serde::Deserialize)]
pub struct CreateRulePayload {
    pub name: String,
    pub trigger_type: String,
    pub trigger_config: serde_json::Value,
    pub action_type: String,
    pub action_config: serde_json::Value,
    pub is_active: Option<bool>,
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateRulePayload {
    pub name: Option<String>,
    pub is_active: Option<bool>,
    pub trigger_config: Option<serde_json::Value>,
    pub action_config: Option<serde_json::Value>,
}

async fn authenticate_admin(
    pool: &PgPool,
    headers: &axum::http::header::HeaderMap,
    workspace_id: Uuid,
) -> Result<crate::models::user::User, AppError> {
    let (user, role) =
        crate::handlers::board::authenticate_member(pool, headers, workspace_id).await?;
    if role != "admin" {
        return Err(AppError::Forbidden);
    }
    Ok(user)
}

#[tracing::instrument(skip(pool, headers))]
pub async fn list_rules(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<BusinessRule>>, AppError> {
    let _ = authenticate_admin(&pool, &headers, workspace_id).await?;

    let rules = sqlx::query_as!(
        BusinessRule,
        r#"
        SELECT id, workspace_id, name, trigger_type, trigger_config, action_type, action_config,
               is_active, created_at, updated_at
        FROM business_rules
        WHERE workspace_id = $1
        ORDER BY created_at ASC
        "#,
        workspace_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(rules))
}

#[tracing::instrument(skip(pool, headers))]
pub async fn create_rule(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<CreateRulePayload>,
) -> Result<(axum::http::StatusCode, Json<BusinessRule>), AppError> {
    let _ = authenticate_admin(&pool, &headers, workspace_id).await?;

    let trimmed_name = payload.name.trim();
    if trimmed_name.is_empty() || trimmed_name.len() > 255 {
        return Err(AppError::BadRequest(
            "Rule name must be between 1 and 255 characters".to_string(),
        ));
    }

    let valid_triggers = ["child_status_changed", "card_entered_column"];
    if !valid_triggers.contains(&payload.trigger_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid trigger_type '{}'. Must be one of: {:?}",
            payload.trigger_type, valid_triggers
        )));
    }

    let valid_actions = ["move_parent_card", "assign_card"];
    if !valid_actions.contains(&payload.action_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid action_type '{}'. Must be one of: {:?}",
            payload.action_type, valid_actions
        )));
    }

    let rule = sqlx::query_as!(
        BusinessRule,
        r#"
        INSERT INTO business_rules (workspace_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, workspace_id, name, trigger_type, trigger_config, action_type, action_config, is_active, created_at, updated_at
        "#,
        workspace_id,
        trimmed_name,
        payload.trigger_type,
        payload.trigger_config,
        payload.action_type,
        payload.action_config,
        payload.is_active.unwrap_or(true),
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e
            && let Some(constraint) = db_err.constraint()
            && constraint == "idx_business_rules_workspace_name"
        {
            return AppError::BadRequest(format!(
                "A business rule with the name '{}' already exists in this workspace",
                trimmed_name
            ));
        }
        AppError::Database(e)
    })?;

    Ok((axum::http::StatusCode::CREATED, Json(rule)))
}

#[tracing::instrument(skip(pool, headers))]
pub async fn update_rule(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path((workspace_id, rule_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateRulePayload>,
) -> Result<Json<BusinessRule>, AppError> {
    let _ = authenticate_admin(&pool, &headers, workspace_id).await?;

    let existing = sqlx::query_as!(
        BusinessRule,
        r#"
        SELECT id, workspace_id, name, trigger_type, trigger_config, action_type, action_config,
               is_active, created_at, updated_at
        FROM business_rules
        WHERE id = $1 AND workspace_id = $2
        "#,
        rule_id,
        workspace_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound,
        _ => AppError::Database(e),
    })?;

    let name = payload.name.unwrap_or(existing.name);
    let is_active = payload.is_active.unwrap_or(existing.is_active);
    let trigger_config = payload.trigger_config.unwrap_or(existing.trigger_config);
    let action_config = payload.action_config.unwrap_or(existing.action_config);

    let updated = sqlx::query_as!(
        BusinessRule,
        r#"
        UPDATE business_rules
        SET name = $1, is_active = $2, trigger_config = $3, action_config = $4, updated_at = NOW()
        WHERE id = $5 AND workspace_id = $6
        RETURNING id, workspace_id, name, trigger_type, trigger_config, action_type, action_config, is_active, created_at, updated_at
        "#,
        name,
        is_active,
        trigger_config,
        action_config,
        rule_id,
        workspace_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e
            && let Some(constraint) = db_err.constraint()
            && constraint == "idx_business_rules_workspace_name"
        {
            return AppError::BadRequest(format!(
                "A business rule with the name '{}' already exists in this workspace",
                name
            ));
        }
        AppError::Database(e)
    })?;

    Ok(Json(updated))
}

#[tracing::instrument(skip(pool, headers))]
pub async fn delete_rule(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path((workspace_id, rule_id)): Path<(Uuid, Uuid)>,
) -> Result<axum::http::StatusCode, AppError> {
    let _ = authenticate_admin(&pool, &headers, workspace_id).await?;

    let result = sqlx::query!(
        "DELETE FROM business_rules WHERE id = $1 AND workspace_id = $2",
        rule_id,
        workspace_id
    )
    .execute(&pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(axum::http::StatusCode::NO_CONTENT)
}
