use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    routing::get,
};
use kanbrio_api::config::{Feature, FeatureFlags};
use tower::ServiceExt;

#[tokio::test]
async fn feature_gate_should_return_403_when_feature_disabled() {
    use axum::{Router, extract::FromRef};

    #[derive(Clone)]
    struct AppState {
        flags: FeatureFlags,
    }

    impl FromRef<AppState> for FeatureFlags {
        fn from_ref(state: &AppState) -> Self {
            state.flags.clone()
        }
    }

    async fn handler_ok() -> &'static str {
        "OK"
    }

    let app = Router::new()
        .route("/test", get(handler_ok))
        .with_state(AppState {
            flags: FeatureFlags { board_cards: false },
        })
        .layer(axum::middleware::from_fn_with_state(
            AppState {
                flags: FeatureFlags { board_cards: false },
            },
            move |st: State<AppState>, req: Request<Body>, next: Next| async move {
                let flags = FeatureFlags::from_ref(&st.0);

                if !flags.is_enabled(Feature::BoardCards) {
                    return kanbrio_api::middleware::feature_gate::feature_disabled_response(
                        Feature::BoardCards,
                    );
                }

                next.run(req).await
            },
        ));

    let req = Request::builder().uri("/test").body(Body::empty()).unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);

    let body = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["error"], "Feature disabled");
    assert_eq!(json["feature"], "board_cards");
}

#[tokio::test]
async fn feature_gate_should_pass_through_when_feature_enabled() {
    use axum::{Router, extract::FromRef};

    #[derive(Clone)]
    struct AppState {
        flags: FeatureFlags,
    }

    impl FromRef<AppState> for FeatureFlags {
        fn from_ref(state: &AppState) -> Self {
            state.flags.clone()
        }
    }

    async fn handler_ok() -> &'static str {
        "OK"
    }

    let app = Router::new()
        .route("/test", get(handler_ok))
        .with_state(AppState {
            flags: FeatureFlags { board_cards: true },
        })
        .layer(axum::middleware::from_fn_with_state(
            AppState {
                flags: FeatureFlags { board_cards: true },
            },
            move |st: State<AppState>, req: Request<Body>, next: Next| async move {
                let flags = FeatureFlags::from_ref(&st.0);

                if !flags.is_enabled(Feature::BoardCards) {
                    return kanbrio_api::middleware::feature_gate::feature_disabled_response(
                        Feature::BoardCards,
                    );
                }

                next.run(req).await
            },
        ));

    let req = Request::builder().uri("/test").body(Body::empty()).unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}
