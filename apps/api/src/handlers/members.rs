use crate::AppError;
use crate::handlers::board::authenticate_member;
use axum::{
    Json,
    extract::{Path, State},
};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct WorkspaceMemberDto {
    pub id: Uuid,
    pub name: String,
    pub role: String,
}

#[tracing::instrument(skip(pool, headers))]
pub async fn list_members(
    State(pool): State<PgPool>,
    headers: axum::http::header::HeaderMap,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<WorkspaceMemberDto>>, AppError> {
    let _ = authenticate_member(&pool, &headers, workspace_id).await?;

    let members = sqlx::query_as!(
        WorkspaceMemberDto,
        r#"
        SELECT
            u.id,
            u.name,
            wm.role
        FROM workspace_members wm
        INNER JOIN users u ON u.id = wm.user_id
        WHERE wm.workspace_id = $1
        ORDER BY u.name ASC
        "#,
        workspace_id
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(members))
}
