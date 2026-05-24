# ADR 002: Web Framework Selection (Axum)

**Date**: 2026-05-22
**Status**: Proposed
**Owner**: @architect

## Context
As decided in [ADR-001](001-backend-language.md), Kanbrio's backend will be built using Rust. We now need to select a specific web framework to handle:
1. **Agent-First REST/gRPC API**: Providing high-concurrency access for AI agents and users.
2. **Real-time Synchronization**: Managing many persistent WebSocket connections for live board updates.
3. **Internal Processing**: Orchestrating async Monte Carlo simulation trials.

We considered three primary candidates: **Axum**, **Actix-web**, and **Rocket**.

## Options Considered

### Option 1: Axum
*   **Pros**:
    *   **Tokio/Tower Native**: Built by the Tokio team, ensuring the best integration with the standard Rust async ecosystem.
    *   **Resource Efficiency**: Superior memory density and efficiency under spiky loads, critical for high-concurrency agent interactions.
    *   **Modularity**: Uses Tower middleware, allowing us to leverage a massive ecosystem of standard components for auth, tracing, and rate-limiting.
    *   **Type Safety**: Leverage's Rust's type system for "Extractors," reducing boilerplate and runtime errors.
*   **Cons**:
    *   **Evolution**: Still pre-1.0 (v0.8+), so major version shifts may require occasional refactoring.

### Option 2: Actix-web
*   **Pros**:
    *   **Raw Throughput**: Historically the fastest for raw I/O throughput.
    *   **Stability**: Highly mature and battle-tested in massive production environments.
*   **Cons**:
    *   **Architecture**: Uses a custom runtime and an internal actor-like model which can be more complex to learn and integrate with generic Tokio libraries.
    *   **Memory**: Slightly higher memory overhead per connection compared to Axum.

### Option 3: Rocket
*   **Pros**:
    *   **Developer Experience**: Simplest to get started with due to its heavy use of macros and "batteries-included" approach.
*   **Cons**:
    *   **Performance**: Less optimized for the extreme high-concurrency and CPU-bound simulation workloads required by Kanbrio compared to Axum or Actix.

## Decision
We will use **Axum** as the primary web framework.

## Rationale
Axum is the most "future-proof" choice for an enterprise-grade AI-orchestrated system:
1. **Agentic Scalability**: Its superior memory efficiency allows more concurrent agents and users to be served on the same hardware.
2. **Mathematical Synergy**: Axum showed a slight performance lead in CPU-bound benchmarks (relevant for Monte Carlo) and its clean integration with the Tokio runtime makes managing simulation tasks more predictable.
3. **Ecosystem Standard**: The use of **Tower** middleware is a strategic advantage, as it allows us to share code and logic between our REST API and any future gRPC (Tonic) services.

## Consequences
- **Positive**: We align with the industry standard for modern Rust web development. We gain access to high-quality middleware for observability (tracing) and security.
- **Negative**: We must monitor for version updates in the Axum/Tower ecosystem and perform occasional migrations as the framework matures toward 1.0.

## Critical Files
- `apps/api/Cargo.toml` (Initial dependencies)
- `docs/adr/001-backend-language.md` (Referenced)
