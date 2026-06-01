use crate::config::{Feature, FeatureFlags};
use axum::{
    Json,
    body::Body,
    extract::{FromRef, State},
    http::{Request, Response, StatusCode},
    middleware::Next,
    response::IntoResponse,
};
use serde_json::json;

/// Returns a 403 Forbidden JSON response when a feature is disabled.
pub fn feature_disabled_response(feature: Feature) -> Response<Body> {
    let payload = json!({
        "error": "Feature disabled",
        "feature": feature.key(),
    });

    (StatusCode::FORBIDDEN, Json(payload)).into_response()
}

/// Async middleware handler that gates requests behind a feature flag.
///
/// Called via `from_fn_with_state` to check whether `feature` is enabled
/// before allowing the request to proceed.
///
/// # Example
///
/// ```rust,ignore
/// Router::new()
///     .route("/cards", post(create_card))
///     .layer(axum::middleware::from_fn_with_state(
///         state,
///         move |st: State<AppState>,
///               req: Request<Body>,
///               next: Next| async move {
///             feature_gate_handler(Feature::BoardCards, st, req, next).await
///         }
///     ))
/// ```
pub async fn feature_gate_handler<S>(
    feature: Feature,
    state: State<S>,
    req: Request<Body>,
    next: Next,
) -> Response<Body>
where
    S: Clone + Send + Sync + 'static,
    FeatureFlags: FromRef<S>,
{
    let flags = FeatureFlags::from_ref(&state.0);

    if !flags.is_enabled(feature) {
        return feature_disabled_response(feature);
    }

    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_return_403_for_disabled_board_cards_feature() {
        let response = feature_disabled_response(Feature::BoardCards);

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert_eq!(
            response.headers().get("content-type").unwrap(),
            "application/json"
        );
    }
}
