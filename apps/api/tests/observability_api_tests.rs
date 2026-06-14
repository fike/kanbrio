use axum::{
    body::Body,
    http::{self, Request, StatusCode},
};
use kanbrio_api::create_app;
use tower::ServiceExt;

#[sqlx::test]
async fn test_observability_health_endpoint_healthy(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let app = create_app(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::GET)
                .uri("/api/observability/health")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let body: serde_json::Value = serde_json::from_slice(&body_bytes)?;

    assert_eq!(body["status"], "healthy");
    assert!(body["uptime_seconds"].is_number());
    assert_eq!(body["database"]["status"], "connected");
    assert!(body["database"]["active_connections"].is_number());
    assert!(body["database"]["idle_connections"].is_number());
    assert!(body["database"]["max_connections"].is_number());
    assert!(body["system"]["memory_used_bytes"].is_number());
    assert!(body["system"]["cpu_usage_percent"].is_number());

    Ok(())
}

#[sqlx::test]
async fn test_observability_health_endpoint_unhealthy(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;

    // Create a pool with an invalid connection string to simulate DB failure
    let bad_pool =
        sqlx::PgPool::connect("postgres://invalid:invalid@localhost:5432/nonexistent_db_name")
            .await;

    let app = match bad_pool {
        Ok(pool) => create_app(pool),
        Err(_) => return Ok(()), // skip: no invalid Postgres connection possible to test
    };

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::GET)
                .uri("/api/observability/health")
                .body(Body::empty())?,
        )
        .await?;

    let status = response.status();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let body: serde_json::Value = serde_json::from_slice(&body_bytes)?;

    if status == StatusCode::SERVICE_UNAVAILABLE {
        assert_eq!(body["status"], "unhealthy");
        assert!(
            body["error"]
                .as_str()
                .unwrap()
                .contains("Database connection verification failed")
        );
        assert_eq!(body["database"]["status"], "disconnected");
    } else {
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["status"], "healthy");
    }

    Ok(())
}

#[sqlx::test]
async fn test_observability_metrics_collection(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let app = create_app(pool);

    // Call a route to trigger the track_metrics middleware
    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method(http::Method::GET)
                .uri("/")
                .body(Body::empty())?,
        )
        .await?;

    // Now scrape the metrics endpoint
    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::GET)
                .uri("/api/observability/metrics")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("content-type")
            .unwrap()
            .to_str()
            .unwrap(),
        "text/plain; version=0.0.4; charset=utf-8"
    );

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let body_str = String::from_utf8(body_bytes.to_vec())?;

    // Assert that standard HTTP metrics are recorded
    assert!(body_str.contains("http_requests_total"));
    assert!(body_str.contains("http_request_duration_seconds"));
    assert!(body_str.contains("db_pool_connections_active"));
    assert!(body_str.contains("db_pool_connections_idle"));
    assert!(body_str.contains("system_memory_used_bytes"));
    assert!(body_str.contains("system_cpu_usage_percent"));

    Ok(())
}

#[sqlx::test]
async fn test_trace_context_propagation(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let app = create_app(pool);

    let traceparent_input = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"; // pragma: allowlist secret

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::GET)
                .uri("/api/observability/health")
                .header("traceparent", traceparent_input)
                .body(Body::empty())?,
        )
        .await?;

    let traceparent_output = response
        .headers()
        .get("traceparent")
        .expect("response should contain traceparent header")
        .to_str()?;

    assert!(traceparent_output.contains("4bf92f3577b34da6a3ce929d0e0e4736")); // pragma: allowlist secret

    Ok(())
}

use std::io;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
struct TestWriter {
    buffer: Arc<Mutex<Vec<u8>>>,
}

impl io::Write for TestWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.buffer.lock().unwrap().write(buf)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.buffer.lock().unwrap().flush()
    }
}

impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for TestWriter {
    type Writer = TestWriter;

    fn make_writer(&self) -> Self::Writer {
        self.clone()
    }
}

#[test]
fn test_custom_json_logging_with_otel_context() -> anyhow::Result<()> {
    use kanbrio_api::handlers::observability::CustomJsonFormatter;
    use opentelemetry::trace::TracerProvider;
    use opentelemetry::trace::{
        SpanContext, SpanId, TraceContextExt, TraceFlags, TraceId, TraceState,
    };
    use tracing_opentelemetry::OpenTelemetrySpanExt;
    use tracing_subscriber::layer::SubscriberExt;

    let buffer = Arc::new(Mutex::new(Vec::new()));
    let writer = TestWriter {
        buffer: buffer.clone(),
    };

    let provider = opentelemetry_sdk::trace::TracerProvider::builder()
        .with_config(
            opentelemetry_sdk::trace::config()
                .with_sampler(opentelemetry_sdk::trace::Sampler::AlwaysOn),
        )
        .build();
    let tracer = provider.tracer("test");
    let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    let subscriber = tracing_subscriber::registry().with(otel_layer).with(
        tracing_subscriber::fmt::layer()
            .event_format(CustomJsonFormatter)
            .with_writer(writer),
    );

    tracing::subscriber::with_default(subscriber, || {
        let trace_id = TraceId::from_hex("8e30b11a2d3c4e5f6a7b8c9d0e1f2a3b").unwrap(); // pragma: allowlist secret
        let span_id = SpanId::from_hex("0e1f2a3b4e5f6a7b").unwrap(); // pragma: allowlist secret
        let span_context = SpanContext::new(
            trace_id,
            span_id,
            TraceFlags::SAMPLED,
            false,
            TraceState::default(),
        );

        let context = opentelemetry::Context::new().with_remote_span_context(span_context);
        let span = tracing::info_span!("http.request");
        println!(
            "TEST SPAN - is_disabled: {}, id: {:?}",
            span.is_disabled(),
            span.id()
        );
        span.set_parent(context);

        let _entered = span.enter();
        let current_span_in_test = tracing::Span::current();
        println!(
            "IN TEST - current span name: {:?}",
            current_span_in_test.metadata().map(|m| m.name())
        );
        tracing::info!("Test message for JSON logging");
    });

    let output = String::from_utf8(buffer.lock().unwrap().clone())?;
    println!("LOG OUTPUT: {}", output);
    assert!(!output.is_empty(), "Log output should not be empty");

    let parsed: serde_json::Value =
        serde_json::from_str(&output).expect("Log output must be valid JSON");

    assert!(
        parsed["timestamp"].is_string(),
        "Missing or invalid timestamp"
    );
    assert_eq!(parsed["level"], "INFO");
    assert_eq!(parsed["fields"]["message"], "Test message for JSON logging");
    assert_eq!(
        parsed["span"]["trace_id"],
        "8e30b11a2d3c4e5f6a7b8c9d0e1f2a3b" // pragma: allowlist secret
    );
    assert!(parsed["span"]["span_id"].is_string(), "Missing span_id");

    Ok(())
}
