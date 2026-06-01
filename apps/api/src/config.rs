#[derive(Debug, Clone)]
pub struct DatabaseUrl(String);

impl DatabaseUrl {
    pub fn new(url: &str) -> Result<Self, ConfigError> {
        if !url.starts_with("postgres://") && !url.starts_with("postgresql://") {
            return Err(ConfigError::InvalidDatabaseUrl(
                "Database URL must start with 'postgres://' or 'postgresql://'".to_string(),
            ));
        }
        Ok(Self(url.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub database_url: DatabaseUrl,
    pub host: String,
    pub port: u16,
    pub log_level: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            database_url: DatabaseUrl::new(
                "postgres://postgres:password@localhost:5432/kanbrio", // pragma: allowlist secret
            )
            .expect("default database URL should be valid"),
            host: "0.0.0.0".to_string(),
            port: 3000,
            log_level: "info".to_string(),
        }
    }
}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/kanbrio".to_string()); // pragma: allowlist secret
        let database_url = DatabaseUrl::new(&database_url)?;

        let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = std::env::var("PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(3000);
        let log_level = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());

        Ok(Self {
            database_url,
            host,
            port,
            log_level,
        })
    }

    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

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

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Invalid database URL: {0}")]
    InvalidDatabaseUrl(String),

    #[error("Invalid port value: {0}")]
    InvalidPort(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::Mutex;

    /// Global mutex to serialize tests that manipulate environment variables.
    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    /// Helper to set an env var, run a closure, then restore the previous value.
    fn with_env_var(name: &str, value: &str, f: impl FnOnce()) {
        let _guard = ENV_MUTEX.lock().unwrap();
        let previous = env::var(name).ok();
        unsafe { env::set_var(name, value) };
        f();
        match previous {
            Some(v) => unsafe { env::set_var(name, v) },
            None => unsafe { env::remove_var(name) },
        }
    }

    fn without_env_var(name: &str, f: impl FnOnce()) {
        let _guard = ENV_MUTEX.lock().unwrap();
        let previous = env::var(name).ok();
        unsafe { env::remove_var(name) };
        f();
        if let Some(v) = previous {
            unsafe { env::set_var(name, v) };
        }
    }

    // -- DatabaseUrl tests --

    #[test]
    fn database_url_should_accept_valid_postgres_url() {
        let url = DatabaseUrl::new("postgres://user:pass@localhost/db"); // pragma: allowlist secret
        assert!(url.is_ok());
    }

    #[test]
    fn database_url_should_accept_valid_postgresql_url() {
        let url = DatabaseUrl::new("postgresql://user:pass@localhost/db"); // pragma: allowlist secret
        assert!(url.is_ok());
    }

    #[test]
    fn database_url_should_reject_invalid_scheme() {
        let url = DatabaseUrl::new("mysql://user:pass@localhost/db"); // pragma: allowlist secret
        assert!(url.is_err());
    }

    #[test]
    fn database_url_should_reject_empty_string() {
        let url = DatabaseUrl::new("");
        assert!(url.is_err());
    }

    #[test]
    fn database_url_as_str_returns_inner_value() {
        let url = DatabaseUrl::new("postgres://user:pass@localhost/db") // pragma: allowlist secret
            .expect("valid URL");
        assert_eq!(url.as_str(), "postgres://user:pass@localhost/db"); // pragma: allowlist secret
    }

    // -- AppConfig tests --

    #[test]
    fn app_config_default_has_expected_values() {
        let config = AppConfig::default();
        assert_eq!(config.host, "0.0.0.0");
        assert_eq!(config.port, 3000);
        assert_eq!(config.log_level, "info");
    }

    #[test]
    fn app_config_from_env_uses_defaults_when_not_set() {
        without_env_var("DATABASE_URL", || {
            without_env_var("HOST", || {
                without_env_var("PORT", || {
                    without_env_var("LOG_LEVEL", || {
                        let config = AppConfig::from_env().expect("should use defaults");
                        assert_eq!(config.host, "0.0.0.0");
                        assert_eq!(config.port, 3000);
                        assert_eq!(config.log_level, "info");
                    })
                })
            })
        });
    }

    #[test]
    fn app_config_from_env_reads_port_from_env() {
        with_env_var("PORT", "8080", || {
            let config = AppConfig::from_env().expect("should parse port");
            assert_eq!(config.port, 8080);
        });
    }

    #[test]
    fn app_config_from_env_rejects_invalid_database_url() {
        with_env_var("DATABASE_URL", "mysql://invalid", || {
            let config = AppConfig::from_env();
            assert!(config.is_err());
        });
    }

    #[test]
    fn app_config_bind_address_formats_correctly() {
        let config = AppConfig::default();
        assert_eq!(config.bind_address(), "0.0.0.0:3000");
    }

    // -- Feature Flags tests --

    #[test]
    fn should_default_board_cards_to_true() {
        let flags = FeatureFlags::default();
        assert!(flags.board_cards);
    }

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

    #[test]
    fn should_check_feature_enabled() {
        let flags = FeatureFlags { board_cards: true };
        assert!(flags.is_enabled(Feature::BoardCards));

        let flags = FeatureFlags { board_cards: false };
        assert!(!flags.is_enabled(Feature::BoardCards));
    }

    #[test]
    fn should_return_correct_feature_key() {
        assert_eq!(Feature::BoardCards.key(), "board_cards");
    }
}
