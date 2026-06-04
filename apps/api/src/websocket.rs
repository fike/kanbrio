use axum::extract::ws::{Message, WebSocket};
use axum::{
    extract::{Path, State, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, mpsc};
use tokio::time::interval;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::models::card::{BlockComment, Card, ChecklistItem};

// ---------------------------------------------------------------------------
// BoardEvent – the single type that flows over WS
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BoardEvent {
    CardCreated { card: Card },
    CardMoved { card: Card },
    CardBlocked { card: Card },
    CardUnblocked { card: Card },
    CardAssigned { card: Card },
    ChecklistItemAdded { item: ChecklistItem },
    ChecklistItemUpdated { item: ChecklistItem },
    ChecklistItemDeleted { card_id: Uuid, checklist_id: Uuid },
    BlockCommentAdded { comment: BlockComment },
    UserJoined { user_id: Uuid, username: String },
    UserLeft { user_id: Uuid },
}

// ---------------------------------------------------------------------------
// WorkspaceHub – one fan-out per workspace
// ---------------------------------------------------------------------------

/// Each subscriber gets an mpsc sender; the hub holds senders in a HashMap.
/// On publish, the hub iterates senders and dispatches each event.
const SUBSCRIBER_CHANNEL_CAPACITY: usize = 64;
/// Interval (in seconds) for the dead-subscriber sweep background task.
#[allow(dead_code)]
const SWEEP_INTERVAL_SECS: u64 = 5;

/// The inner data structure protected by a tokio Mutex.
struct HubInner {
    /// workspace_id -> list of subscriber senders
    channels: HashMap<Uuid, Vec<mpsc::Sender<BoardEvent>>>,
}

/// Cloneable hub that routes board events to all subscribers of a workspace.
#[derive(Clone)]
pub struct WorkspaceHub {
    inner: Arc<Mutex<HubInner>>,
}

impl Default for WorkspaceHub {
    fn default() -> Self {
        Self::new()
    }
}

impl WorkspaceHub {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HubInner {
                channels: HashMap::new(),
            })),
        }
    }

    /// Subscribe to events for a workspace. Returns a receiver.
    /// Creates the workspace channel if it doesn't exist.
    pub async fn subscribe(&self, workspace_id: Uuid) -> mpsc::Receiver<BoardEvent> {
        let (tx, rx) = mpsc::channel(SUBSCRIBER_CHANNEL_CAPACITY);
        let mut inner = self.inner.lock().await;
        inner.channels.entry(workspace_id).or_default().push(tx);
        rx
    }

    /// Remove a subscriber by dropping its sender (the receiver side will close naturally).
    /// We use cleanup() to sweep dead senders.
    pub async fn unsubscribe(&self, _workspace_id: Uuid, rx: &mut mpsc::Receiver<BoardEvent>) {
        // Dropping the receiver is sufficient. Call cleanup to remove dead senders.
        rx.close();
        self.cleanup().await;
    }

    /// Publish an event to all subscribers of the given workspace.
    /// Dead senders are collected and removed during the sweep.
    pub async fn publish(&self, workspace_id: Uuid, event: BoardEvent) {
        let mut inner = self.inner.lock().await;
        if let Some(subscribers) = inner.channels.get_mut(&workspace_id) {
            // Send to all subscribers, collect indices of dead ones
            let mut dead = Vec::new();
            for (i, tx) in subscribers.iter_mut().enumerate() {
                if tx.try_send(event.clone()).is_err() {
                    dead.push(i);
                }
            }
            // Remove dead subscribers in reverse order to preserve indices
            for i in dead.into_iter().rev() {
                subscribers.remove(i);
            }
            // Remove workspace entry if no subscribers left
            if subscribers.is_empty() {
                inner.channels.remove(&workspace_id);
            }
        }
    }

    /// Number of workspaces with active subscribers.
    pub async fn len(&self) -> usize {
        let inner = self.inner.lock().await;
        inner.channels.len()
    }

    /// Returns true if no workspaces have active subscribers.
    pub async fn is_empty(&self) -> bool {
        self.len().await == 0
    }

    /// Remove dead subscriber senders across all workspaces.
    pub async fn cleanup(&self) {
        let mut inner = self.inner.lock().await;
        inner.channels.retain(|_, subscribers| {
            subscribers.retain(|tx| !tx.is_closed());
            !subscribers.is_empty()
        });
    }

    /// Spawn a background task that sweeps dead subscribers at a fixed interval.
    pub async fn spawn_cleanup_loop(&self, interval_secs: u64) {
        let hub = self.clone();
        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(interval_secs));
            loop {
                ticker.tick().await;
                hub.cleanup().await;
            }
        });
    }
}

// ---------------------------------------------------------------------------
// WebSocket upgrade handler
// ---------------------------------------------------------------------------

/// Upgrade handler: authenticates the request and establishes the WS connection.
pub async fn ws_upgrade(
    ws: WebSocketUpgrade,
    headers: axum::http::header::HeaderMap,
    ws_hub: State<Arc<WorkspaceHub>>,
    pool: State<sqlx::PgPool>,
    Path(workspace_id): Path<Uuid>,
) -> impl IntoResponse {
    // Authenticate via cookie
    match authenticate_ws(&pool.0, &headers, workspace_id).await {
        Ok((user, true)) => {
            let hub = ws_hub.0.clone();
            let username = user.name.clone();
            ws.on_upgrade(move |socket| {
                handle_ws_connection(socket, hub, workspace_id, user, username)
            })
        }
        Ok((_, false)) => StatusCode::FORBIDDEN.into_response(),
        Err(_) => StatusCode::UNAUTHORIZED.into_response(),
    }
}

/// Background task: broadcast board events to the client.
async fn handle_ws_connection(
    mut socket: WebSocket,
    hub: Arc<WorkspaceHub>,
    workspace_id: Uuid,
    user: crate::models::user::User,
    username: String,
) {
    info!(
        user_id = %user.id,
        workspace_id = %workspace_id,
        "WebSocket connection established"
    );

    // Announce user joined
    let _ = hub
        .publish(
            workspace_id,
            BoardEvent::UserJoined {
                user_id: user.id,
                username: username.clone(),
            },
        )
        .await;

    // Subscribe to the workspace's event stream
    let mut rx = hub.subscribe(workspace_id).await;

    // Heartbeat timer — send ping every 25s
    let mut heartbeat = interval(Duration::from_secs(25));

    loop {
        tokio::select! {
            // Heartbeat ping
            _ = heartbeat.tick() => {
                if let Err(e) = socket.send(Message::Ping(vec![])).await {
                    error!("Failed to send WS ping: {}", e);
                    break;
                }
            }

            // Incoming messages from the client
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(payload))) => {
                        info!("Client sent close frame");
                        let _ = socket.send(Message::Close(payload)).await;
                        break;
                    }
                    Some(Ok(Message::Pong(_))) => {
                        // Client responded to our ping — connection is alive
                    }
                    Some(Ok(Message::Ping(payload))) => {
                        let _ = socket.send(Message::Pong(payload)).await;
                    }
                    Some(Ok(Message::Text(_))) => {
                        // Future: client-to-server messages (e.g. presence updates)
                    }
                    Some(Ok(Message::Binary(_))) => {
                        // Ignore binary messages
                    }
                    Some(Err(e)) => {
                        warn!("WebSocket receive error: {}", e);
                        break;
                    }
                    None => {
                        // Client disconnected
                        break;
                    }
                }
            }

            // Outgoing board events from the hub
            event = rx.recv() => {
                match event {
                    Some(event) => {
                        let payload = match serde_json::to_string(&event) {
                            Ok(s) => s,
                            Err(e) => {
                                error!("Failed to serialize board event: {}", e);
                                continue;
                            }
                        };
                        if let Err(e) = socket.send(Message::Text(payload)).await {
                            error!("Failed to send WS message: {}", e);
                            break;
                        }
                    }
                    None => {
                        // Channel closed — hub cleaned up the subscriber
                        info!("Subscriber channel closed for workspace {}", workspace_id);
                        break;
                    }
                }
            }
        }
    }

    // Announce user left
    info!(
        user_id = %user.id,
        workspace_id = %workspace_id,
        "WebSocket connection closed"
    );

    let _ = hub
        .publish(workspace_id, BoardEvent::UserLeft { user_id: user.id })
        .await;
}

// ---------------------------------------------------------------------------
// Auth helpers (mirrors the cookie extraction from handlers/auth.rs)
// ---------------------------------------------------------------------------

async fn authenticate_ws(
    pool: &sqlx::PgPool,
    headers: &axum::http::header::HeaderMap,
    workspace_id: Uuid,
) -> Result<(crate::models::user::User, bool), StatusCode> {
    let cookie_hdr = headers
        .get(axum::http::header::COOKIE)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let cookie_str = cookie_hdr.to_str().map_err(|_| StatusCode::UNAUTHORIZED)?;

    let token = extract_cookie_value(cookie_str, "__Host-sid").ok_or(StatusCode::UNAUTHORIZED)?;

    let user = crate::services::session_service::SessionService::validate_session(pool, &token)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Check workspace membership
    let member: (bool,) = sqlx::query_as(
        "SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)",
    )
    .bind(workspace_id)
    .bind(user.id)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::FORBIDDEN)?;

    Ok((user, member.0))
}

fn extract_cookie_value(cookie_str: &str, name: &str) -> Option<String> {
    for cookie in cookie_str.split(';') {
        let parts: Vec<&str> = cookie.trim().split('=').collect();
        if parts.len() == 2 && parts[0] == name {
            return Some(parts[1].to_string());
        }
    }
    None
}
