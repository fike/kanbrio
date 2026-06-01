pub mod error;
pub mod handlers;
pub mod models;
pub mod services;

pub use error::AppError;

use crate::handlers::auth::{
    create_workspace, login, logout, me, oauth_callback, oauth_redirect, register, workspaces,
};
use crate::handlers::board::{
    assign_card, block_card, create_block_comment, create_card, create_checklist_item,
    delete_checklist_item, get_block_comments, get_board_state, get_card_history, move_card,
    set_user_wip_limit, unblock_card, update_checklist_item,
};
use crate::handlers::health::health;
use axum::{
    Router,
    routing::{get, post},
};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

pub fn create_app(pool: sqlx::PgPool) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/", get(|| async { "Kanbrio API" }))
        .route("/health", get(health))
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/me", get(me))
        .route("/api/auth/login/:provider", get(oauth_redirect))
        .route("/api/auth/callback/:provider", get(oauth_callback))
        .route("/api/workspaces", get(workspaces).post(create_workspace))
        .route("/api/workspaces/:workspace_id/board", get(get_board_state))
        .route("/api/workspaces/:workspace_id/cards", post(create_card))
        .route(
            "/api/workspaces/:workspace_id/cards/:card_id/move",
            post(move_card),
        )
        .route(
            "/api/workspaces/:workspace_id/cards/:card_id/block",
            post(block_card),
        )
        .route(
            "/api/workspaces/:workspace_id/cards/:card_id/unblock",
            post(unblock_card),
        )
        .route(
            "/api/workspaces/:workspace_id/cards/:card_id/block/comments",
            get(get_block_comments).post(create_block_comment),
        )
        .route(
            "/api/workspaces/:workspace_id/cards/:card_id/history",
            get(get_card_history),
        )
        .route(
            "/api/workspaces/:workspace_id/members/:user_id/wip-limit",
            axum::routing::put(set_user_wip_limit),
        )
        .route(
            "/api/workspaces/:workspace_id/cards/:card_id/assign",
            post(assign_card),
        )
        .route(
            "/api/workspaces/:workspace_id/cards/:card_id/checklists",
            post(create_checklist_item),
        )
        .route(
            "/api/workspaces/:workspace_id/cards/:card_id/checklists/:checklist_id",
            axum::routing::patch(update_checklist_item),
        )
        .route(
            "/api/workspaces/:workspace_id/cards/:card_id/checklists/:checklist_id",
            axum::routing::delete(delete_checklist_item),
        )
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(pool)
}
