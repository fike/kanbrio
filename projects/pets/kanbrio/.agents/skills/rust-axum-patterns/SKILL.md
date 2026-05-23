---
name: rust-axum-patterns
description: Idiomatic Rust/Axum development (Result/Option, extractors, error types).
---

# Rust & Axum Patterns Skill

This skill ensures that backend code is written using idiomatic Rust and Axum framework best practices.

## 1. Safety First: Forbid Panic

- **CRITICAL**: NEVER use `unwrap()` or `expect()` in production/library code.
- **Action**: Always use `Result` and `Option`. Propagate errors using the `?` operator.
- **Exception**: `unwrap()` is acceptable in tests only.

## 2. Error Handling Strategy

- Use a centralized error enum (e.g., `AppError`).
- Use the `thiserror` crate for defining errors in libraries.
- Use `anyhow` or `eyre` for application-level error context if appropriate.
- Map internal errors to Axum HTTP responses (e.g., `IntoResponse`).

## 3. Axum Best Practices

- **Extractors**: Leverage Axum's type-safe extractors (`Json<T>`, `Path<T>`, `Query<T>`, `State<S>`).
- **Handlers**: Keep handlers lean. Delegate business logic to dedicated services/modules.
- **State**: Use `axum::extract::State` for dependency injection (DB pools, configuration).

## 4. Modern Rust Idioms (Edition 2024)

- Use `std::sync::Arc` for shared, thread-safe state.
- Prefer `impl Trait` for return types where appropriate.
- Strictly adhere to `cargo clippy` suggestions.
