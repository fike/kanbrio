/// Identifies a feature that can be toggled via environment variables.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Feature {
    BoardCards,
}

impl Feature {
    /// Returns the stable key for this feature (used in error responses).
    pub fn key(self) -> &'static str {
        match self {
            Feature::BoardCards => "board_cards",
        }
    }
}

/// Feature flag toggles for controlling which API features are available.
#[derive(Debug, Clone)]
pub struct FeatureFlags {
    /// Controls whether board card operations are enabled.
    pub board_cards: bool,
}

impl Default for FeatureFlags {
    fn default() -> Self {
        Self { board_cards: true }
    }
}

impl FeatureFlags {
    /// Parse feature flags from environment variables.
    ///
    /// Reads `KANBRIO_FEATURE_BOARD_CARDS` (default: `"true"`).
    pub fn from_env() -> Self {
        let board_cards = std::env::var("KANBRIO_FEATURE_BOARD_CARDS")
            .ok()
            .and_then(|v| parse_bool(&v))
            .unwrap_or(true);

        Self { board_cards }
    }

    /// Check whether the given feature is currently enabled.
    pub fn is_enabled(&self, feature: Feature) -> bool {
        match feature {
            Feature::BoardCards => self.board_cards,
        }
    }
}

/// Parse a string as a boolean.
/// Accepts "true", "false", "1", "0", "yes", "no" (case-insensitive).
fn parse_bool(value: &str) -> Option<bool> {
    match value.trim().to_lowercase().as_str() {
        "true" | "1" | "yes" => Some(true),
        "false" | "0" | "no" => Some(false),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    /// Helper to set an env var, run a closure, then restore the previous value.
    fn with_env_var(name: &str, value: &str, f: impl FnOnce()) {
        let previous = env::var(name).ok();
        unsafe { env::set_var(name, value) };
        f();
        match previous {
            Some(v) => unsafe { env::set_var(name, v) },
            None => unsafe { env::remove_var(name) },
        }
    }

    fn without_env_var(name: &str, f: impl FnOnce()) {
        let previous = env::var(name).ok();
        unsafe { env::remove_var(name) };
        f();
        if let Some(v) = previous {
            unsafe { env::set_var(name, v) };
        }
    }

    // -- Default behaviour --

    #[test]
    fn should_default_board_cards_to_true() {
        let flags = FeatureFlags::default();
        assert!(flags.board_cards);
    }

    // -- Environment parsing --

    #[test]
    fn should_parse_board_cards_enabled_when_env_not_set() {
        without_env_var("KANBRIO_FEATURE_BOARD_CARDS", || {
            let flags = FeatureFlags::from_env();
            assert!(flags.board_cards);
        });
    }

    #[test]
    fn should_parse_board_cards_enabled_when_env_true() {
        with_env_var("KANBRIO_FEATURE_BOARD_CARDS", "true", || {
            let flags = FeatureFlags::from_env();
            assert!(flags.board_cards);
        });
    }

    #[test]
    fn should_parse_board_cards_disabled_when_env_false() {
        with_env_var("KANBRIO_FEATURE_BOARD_CARDS", "false", || {
            let flags = FeatureFlags::from_env();
            assert!(!flags.board_cards);
        });
    }

    #[test]
    fn should_parse_board_cards_enabled_when_env_1() {
        with_env_var("KANBRIO_FEATURE_BOARD_CARDS", "1", || {
            let flags = FeatureFlags::from_env();
            assert!(flags.board_cards);
        });
    }

    #[test]
    fn should_parse_board_cards_disabled_when_env_0() {
        with_env_var("KANBRIO_FEATURE_BOARD_CARDS", "0", || {
            let flags = FeatureFlags::from_env();
            assert!(!flags.board_cards);
        });
    }

    #[test]
    fn should_parse_board_cards_case_insensitive() {
        with_env_var("KANBRIO_FEATURE_BOARD_CARDS", "FALSE", || {
            let flags = FeatureFlags::from_env();
            assert!(!flags.board_cards);
        });

        with_env_var("KANBRIO_FEATURE_BOARD_CARDS", "True", || {
            let flags = FeatureFlags::from_env();
            assert!(flags.board_cards);
        });
    }

    #[test]
    fn should_default_to_true_when_env_value_is_invalid() {
        with_env_var("KANBRIO_FEATURE_BOARD_CARDS", "invalid", || {
            let flags = FeatureFlags::from_env();
            assert!(flags.board_cards);
        });
    }

    // -- is_enabled --

    #[test]
    fn should_check_feature_enabled() {
        let flags = FeatureFlags { board_cards: true };
        assert!(flags.is_enabled(Feature::BoardCards));

        let flags = FeatureFlags { board_cards: false };
        assert!(!flags.is_enabled(Feature::BoardCards));
    }

    // -- Feature key --

    #[test]
    fn should_return_correct_feature_key() {
        assert_eq!(Feature::BoardCards.key(), "board_cards");
    }
}
