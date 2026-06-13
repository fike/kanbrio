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
use opentelemetry::global;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::trace::{self, Sampler};
use serde::Serialize;
use sqlx::PgPool;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::time::Instant;
use sysinfo::{System, get_current_pid};
use tracing::Instrument;
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::prelude::*;

static TRACING_INIT: std::sync::Once = std::sync::Once::new();

/// Initialize the OpenTelemetry tracer and tracing subscriber.
pub fn init_tracing() {
    TRACING_INIT.call_once(|| {
        global::set_text_map_propagator(opentelemetry_sdk::propagation::TraceContextPropagator::new());

        let endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
            .unwrap_or_else(|_| {
                if std::path::Path::new("/.dockerenv").exists() {
                    "http://kanbrio-jaeger:4317".to_string()
                } else {
                    "http://localhost:4317".to_string()
                }
            });

        let tracer_res = opentelemetry_otlp::new_pipeline()
            .tracing()
            .with_exporter(
                opentelemetry_otlp::new_exporter()
                    .tonic()
                    .with_endpoint(&endpoint),
            )
            .with_trace_config(
                trace::config()
                    .with_sampler(Sampler::AlwaysOn)
                    .with_resource(opentelemetry_sdk::Resource::new(vec![
                        opentelemetry::KeyValue::new("service.name", "kanbrio-api"),
                    ])),
            )
            .install_batch(opentelemetry_sdk::runtime::Tokio);

        let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

        let use_json = std::env::var("KANBRIO_LOG_FORMAT")
            .map(|v| v.to_lowercase() == "json")
            .unwrap_or_else(|_| std::path::Path::new("/.dockerenv").exists());

        let registry = tracing_subscriber::registry().with(env_filter);

        match tracer_res {
            Ok(tracer) => {
                if use_json {
                    let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);
                    let fmt_layer = tracing_subscriber::fmt::layer().json();
                    let _ = registry.with(fmt_layer).with(otel_layer).try_init();
                } else {
                    let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);
                    let fmt_layer = tracing_subscriber::fmt::layer();
                    let _ = registry.with(fmt_layer).with(otel_layer).try_init();
                }
            }
            Err(err) => {
                eprintln!(
                    "Failed to initialize OpenTelemetry OTLP exporter: {}, falling back to standard tracing",
                    err
                );
                if use_json {
                    let fmt_layer = tracing_subscriber::fmt::layer().json();
                    let _ = registry.with(fmt_layer).try_init();
                } else {
                    let fmt_layer = tracing_subscriber::fmt::layer();
                    let _ = registry.with(fmt_layer).try_init();
                }
            }
        }
    });
}

struct HeaderExtractor<'a>(&'a axum::http::HeaderMap);

impl<'a> opentelemetry::propagation::Extractor for HeaderExtractor<'a> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|value| value.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.0.keys().map(|key| key.as_str()).collect()
    }
}

struct HeaderInjector<'a>(&'a mut axum::http::HeaderMap);

impl<'a> opentelemetry::propagation::Injector for HeaderInjector<'a> {
    fn set(&mut self, key: &str, value: String) {
        if let (Ok(name), Ok(val)) = (
            axum::http::HeaderName::from_bytes(key.as_bytes()),
            axum::http::HeaderValue::from_str(&value),
        ) {
            self.0.insert(name, val);
        }
    }
}

/// Middleware to extract trace context from incoming requests, propagate it, and inject it into response headers.
pub async fn trace_context(req: Request<Body>, next: Next) -> Response {
    let parent_cx = global::get_text_map_propagator(|propagator| {
        propagator.extract(&HeaderExtractor(req.headers()))
    });

    let span = tracing::info_span!(
        "http.request",
        method = %req.method(),
        uri = %req.uri().path(),
        status_code = tracing::field::Empty,
    );
    span.set_parent(parent_cx);

    let mut response = async move { next.run(req).await }
        .instrument(span.clone())
        .await;

    let context = span.context();
    let mut headers = axum::http::HeaderMap::new();
    global::get_text_map_propagator(|propagator| {
        propagator.inject_context(&context, &mut HeaderInjector(&mut headers));
    });

    response.headers_mut().extend(headers);
    span.record("status_code", response.status().as_u16());

    response
}

static START_TIME: OnceLock<Instant> = OnceLock::new();
static METRICS_HANDLE: OnceLock<PrometheusHandle> = OnceLock::new();
static MEMORY_USED_BYTES: AtomicU64 = AtomicU64::new(0);
static CPU_USAGE_PERCENT: AtomicU32 = AtomicU32::new(0);

/// Initialize the start time of the server.
pub fn init_start_time() {
    let _ = START_TIME.set(Instant::now());
}

/// Initialize the Prometheus recorder.
pub fn init_metrics() -> &'static PrometheusHandle {
    METRICS_HANDLE.get_or_init(|| {
        // Spawn background task to periodically update system metrics
        tokio::spawn(async {
            let mut sys = System::new();
            if let Ok(pid) = get_current_pid() {
                loop {
                    sys.refresh_process(pid);
                    if let Some(process) = sys.process(pid) {
                        let mem = process.memory(); // sysinfo >=0.26 returns bytes directly
                        let cpu = process.cpu_usage();
                        MEMORY_USED_BYTES.store(mem, Ordering::Relaxed);
                        CPU_USAGE_PERCENT.store(cpu.to_bits(), Ordering::Relaxed);
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(15)).await;
                }
            }
        });

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

            // Retrieve cached system memory and CPU stats
            let memory_used_bytes = MEMORY_USED_BYTES.load(Ordering::Relaxed);
            let cpu_usage_percent = f32::from_bits(CPU_USAGE_PERCENT.load(Ordering::Relaxed));

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
        Err(e) => {
            tracing::error!("Observability database health check failed: {:?}", e);
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(DeepHealthErrorResponse {
                    status: "unhealthy".to_string(),
                    error: "Database connection verification failed".to_string(),
                    database: DatabaseErrorInfo {
                        status: "disconnected".to_string(),
                    },
                }),
            )
                .into_response()
        }
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

    // Set cached system metrics
    let memory_used_bytes = MEMORY_USED_BYTES.load(Ordering::Relaxed);
    gauge!("system_memory_used_bytes").set(memory_used_bytes as f64);

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
        .unwrap_or_else(|| "unmatched".to_string());
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
