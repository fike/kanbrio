// File: apps/api/tests/auth_tests.rs
use axum::{
    body::Body,
    http::{self, Request, StatusCode},
};
use kanbrio_api::create_app;
use serde_json::json;
use tower::ServiceExt;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[sqlx::test]
async fn test_local_registration_and_login_flow(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let app = create_app(pool.clone());

    // 1. Register a new user
    let register_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/api/auth/register")
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "name": "Jane Doe",
                        "email": "jane@example.com",
                        "password": "securepassword123" // pragma: allowlist secret
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(register_response.status(), StatusCode::CREATED);

    // Extract session cookie from header
    let cookie_header = register_response
        .headers()
        .get(http::header::SET_COOKIE)
        .expect("Should set session cookie");
    assert!(cookie_header.to_str()?.contains("__Host-sid"));

    // 2. Perform Login with registered credentials
    let login_response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/api/auth/login")
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "email": "jane@example.com",
                        "password": "securepassword123" // pragma: allowlist secret
                    })
                    .to_string(),
                ))?,
        )
        .await?;

    assert_eq!(login_response.status(), StatusCode::OK);
    Ok(())
}

#[sqlx::test]
async fn test_oauth_callback_provisions_user_with_mock_provider(
    pool: sqlx::PgPool,
) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;

    // Start wiremock to simulate Google/GitHub identity APIs
    let mock_provider = MockServer::start().await;
    unsafe {
        std::env::set_var("GITHUB_API_URL", mock_provider.uri());
        std::env::set_var("GITHUB_AUTH_URL", mock_provider.uri());
    }

    // Mock token exchange API response
    Mock::given(method("POST"))
        .and(path("/login/oauth/access_token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "access_token": "mock_access_token"
        })))
        .mount(&mock_provider)
        .await;

    // Mock user profile API response
    let profile_payload = json!({
        "id": "12345678",
        "email": "oauth_user@example.com",
        "name": "OAuth User",
        "avatar_url": "https://avatars.com/u/1234"
    });

    Mock::given(method("GET"))
        .and(path("/user"))
        .respond_with(ResponseTemplate::new(200).set_body_json(profile_payload))
        .mount(&mock_provider)
        .await;

    // Inside the application configuration, mock providers point to `mock_provider.uri()`
    // We invoke the callback directly simulating OAuth callback redirection
    let app = create_app(pool.clone());

    let callback_response = app
        .oneshot(
            Request::builder()
                .method(http::Method::GET)
                .uri("/api/auth/callback/github?code=mock_code&state=mock_state")
                .header(
                    http::header::COOKIE,
                    "oauth_state=mock_state; Path=/; HttpOnly; Secure",
                )
                .body(Body::empty())?,
        )
        .await?;

    // Asserts successful login session creation
    assert_eq!(callback_response.status(), StatusCode::OK);

    // Assert user row exists in database
    let user_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE email = 'oauth_user@example.com')",
    )
    .bind("oauth_user@example.com")
    .fetch_one(&pool)
    .await?;

    assert!(user_exists);
    Ok(())
}

#[sqlx::test]
async fn test_input_validation_bounds(pool: sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(&pool).await?;
    let app = create_app(pool.clone());

    // 1. Password too short (5 chars)
    let res_short_pw = app
        .clone()
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/api/auth/register")
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "name": "Jane Doe",
                        "email": "jane@example.com",
                        "password": "short" // pragma: allowlist secret
                    })
                    .to_string(),
                ))?,
        )
        .await?;
    assert_eq!(res_short_pw.status(), StatusCode::BAD_REQUEST);

    // 2. Password too long (73 chars)
    let long_pw = "a".repeat(73);
    let res_long_pw = app
        .clone()
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/api/auth/register")
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "name": "Jane Doe",
                        "email": "jane@example.com",
                        "password": long_pw
                    })
                    .to_string(),
                ))?,
        )
        .await?;
    assert_eq!(res_long_pw.status(), StatusCode::BAD_REQUEST);

    // 3. Email too long (>254 chars)
    let long_email = format!("{}@example.com", "a".repeat(250));
    let res_long_email = app
        .clone()
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/api/auth/register")
                .header(http::header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "name": "Jane Doe",
                        "email": long_email,
                        "password": "securepassword123" // pragma: allowlist secret
                    })
                    .to_string(),
                ))?,
        )
        .await?;
    assert_eq!(res_long_email.status(), StatusCode::BAD_REQUEST);

    Ok(())
}
