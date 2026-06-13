use axum::{
    Json,
    body::Body,
    extract::{MatchedPath, State},
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use metrics::{counter, gauge, histogram};
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};
use serde::Serialize;
use sqlx::PgPool;
use std::sync::OnceLock;
use std::time::Instant;
use sysinfo::{System, get_current_pid};

static START_TIME: OnceLock<Instant> = OnceLock::new();
static METRICS_HANDLE: OnceLock<PrometheusHandle> = OnceLock::new();

/// Initialize the start time of the server.
pub fn init_start_time() {
    let _ = START_TIME.set(Instant::now());
}

/// Initialize the Prometheus recorder.
pub fn init_metrics() -> &'static PrometheusHandle {
    METRICS_HANDLE.get_or_init(|| {
        PrometheusBuilder::new()
            .install_recorder()
            .expect("failed to install Prometheus recorder")
    })
}

#[derive(Serialize)]
pub struct DeepHealthResponse {
    pub status: String,
    pub uptime_seconds: u64,
    pub database: DatabaseInfo,
    pub system: SystemInfo,
}

#[derive(Serialize)]
pub struct DatabaseInfo {
    pub status: String,
    pub active_connections: u32,
    pub idle_connections: u32,
    pub max_connections: u32,
}

#[derive(Serialize)]
pub struct SystemInfo {
    pub memory_used_bytes: u64,
    pub cpu_usage_percent: f32,
}

#[derive(Serialize)]
pub struct DeepHealthErrorResponse {
    pub status: String,
    pub error: String,
    pub database: DatabaseErrorInfo,
}

#[derive(Serialize)]
pub struct DatabaseErrorInfo {
    pub status: String,
}

/// Handler for deep health check: GET /api/observability/health
pub async fn observability_health(State(pool): State<PgPool>) -> impl IntoResponse {
    let uptime_seconds = START_TIME.get().map(|t| t.elapsed().as_secs()).unwrap_or(0);

    // Verify database connectivity
    match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&pool)
        .await
    {
        Ok(_) => {
            let total_connections = pool.size();
            let idle_connections = pool.num_idle();
            let active_connections = total_connections.saturating_sub(idle_connections as u32);
            let max_connections = pool.options().get_max_connections();

            // Retrieve system memory and CPU stats
            let mut memory_used_bytes = 0;
            let mut cpu_usage_percent = 0.0;

            let mut sys = System::new();
            if let Ok(pid) = get_current_pid() {
                sys.refresh_process(pid);
                if let Some(process) = sys.process(pid) {
                    memory_used_bytes = process.memory() * 1024; // KB to bytes
                    cpu_usage_percent = process.cpu_usage();
                }
            }

            (
                StatusCode::OK,
                Json(DeepHealthResponse {
                    status: "healthy".to_string(),
                    uptime_seconds,
                    database: DatabaseInfo {
                        status: "connected".to_string(),
                        active_connections,
                        idle_connections: idle_connections as u32,
                        max_connections,
                    },
                    system: SystemInfo {
                        memory_used_bytes,
                        cpu_usage_percent,
                    },
                }),
            )
                .into_response()
        }
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(DeepHealthErrorResponse {
                status: "unhealthy".to_string(),
                error: format!("Database connection verification failed: {}", e),
                database: DatabaseErrorInfo {
                    status: "disconnected".to_string(),
                },
            }),
        )
            .into_response(),
    }
}

/// Handler for Prometheus metrics: GET /api/observability/metrics
pub async fn observability_metrics(State(pool): State<PgPool>) -> impl IntoResponse {
    let handle = init_metrics();

    // Refresh and set DB pool metrics
    let size = pool.size();
    let idle = pool.num_idle();
    let active = size.saturating_sub(idle as u32);

    gauge!("db_pool_connections_active").set(active as f64);
    gauge!("db_pool_connections_idle").set(idle as f64);

    // Refresh and set system metrics
    let mut sys = System::new();
    if let Ok(pid) = get_current_pid() {
        sys.refresh_process(pid);
        if let Some(process) = sys.process(pid) {
            let memory_used_bytes = process.memory() * 1024;
            gauge!("system_memory_used_bytes").set(memory_used_bytes as f64);
        }
    }

    (
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        handle.render(),
    )
}

/// Middleware to track request latency and count.
pub async fn track_metrics(req: Request<Body>, next: Next) -> Response {
    let start = Instant::now();
    let path = req
        .extensions()
        .get::<MatchedPath>()
        .map(|matched| matched.as_str().to_string())
        .unwrap_or_else(|| req.uri().path().to_string());
    let method = req.method().to_string();

    let response = next.run(req).await;

    let latency = start.elapsed().as_secs_f64();
    let status = response.status().as_u16().to_string();

    counter!(
        "http_requests_total",
        "method" => method.clone(),
        "route" => path.clone(),
        "status" => status.clone()
    )
    .increment(1);

    histogram!(
        "http_request_duration_seconds",
        "method" => method,
        "route" => path,
        "status" => status
    )
    .record(latency);

    response
}
