pub mod config;
pub mod error;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod services;
pub mod websocket;

pub use config::{Feature, FeatureFlags};
pub use error::AppError;
pub use websocket::WorkspaceHub;

use crate::handlers::auth::{
    create_workspace, login, logout, me, oauth_callback, oauth_redirect, register, workspaces,
};
use crate::handlers::board::{
    assign_card, block_card, create_block_comment, create_card, create_checklist_item,
    delete_checklist_item, get_block_comments, get_board_state, get_card_history, move_card,
    set_user_wip_limit, unblock_card, update_checklist_item,
};
use crate::handlers::health::health;
use crate::handlers::observability::{
    init_metrics, init_start_time, init_tracing, observability_health, observability_metrics,
    trace_context, track_metrics,
};
use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use std::sync::Arc;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use websocket::ws_upgrade;

/// Application state shared across all handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub feature_flags: FeatureFlags,
    pub ws_hub: Arc<WorkspaceHub>,
}

impl FromRef<AppState> for sqlx::PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.pool.clone()
    }
}

impl FromRef<AppState> for FeatureFlags {
    fn from_ref(state: &AppState) -> Self {
        state.feature_flags.clone()
    }
}

impl FromRef<AppState> for Arc<WorkspaceHub> {
    fn from_ref(state: &AppState) -> Self {
        state.ws_hub.clone()
    }
}

/// Build the application router with all routes and middleware.
pub fn create_app(pool: sqlx::PgPool) -> Router {
    // Initialize observability startup stats
    init_tracing();
    init_start_time();
    let _ = init_metrics();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let ws_hub = Arc::new(WorkspaceHub::new());

    // Start the background sweep task for stale WS channels
    let sweep_hub = ws_hub.clone();
    tokio::task::spawn(async move {
        sweep_hub.spawn_cleanup_loop(5).await;
    });

    let state = AppState {
        pool,
        feature_flags: FeatureFlags::from_env(),
        ws_hub,
    };

    Router::new()
        .route("/", get(|| async { "Kanbrio API" }))
        .route("/health", get(health))
        .route("/api/observability/health", get(observability_health))
        .route("/api/observability/metrics", get(observability_metrics))
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
        // WebSocket endpoint
        .route("/ws/workspaces/:workspace_id", get(ws_upgrade))
        .route_layer(axum::middleware::from_fn(track_metrics))
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(trace_context))
        .layer(cors)
        .with_state(state)
}
