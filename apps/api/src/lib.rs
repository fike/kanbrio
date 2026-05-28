pub mod error;
pub mod handlers;
pub mod models;

pub use error::AppError;

use crate::handlers::board::{
    block_card, get_board_state, get_card_history, move_card, unblock_card,
};
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
        .route("/api/workspaces/:workspace_id/board", get(get_board_state))
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
            "/api/workspaces/:workspace_id/cards/:card_id/history",
            get(get_card_history),
        )
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(pool)
}
