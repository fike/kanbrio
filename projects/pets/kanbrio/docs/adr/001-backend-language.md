# ADR 001: Backend Language Selection (Go vs. Rust)

**Date**: 2026-05-22
**Status**: Accepted
**Owner**: @architect

## Context
Kanbrio is designed to be an enterprise-grade, open-source Flow Management System. The backend must serve as a high-performance "Brain" capable of handling two distinct and demanding workloads:
1. **Real-time API & WebSockets**: Serving board updates instantly to multiple concurrent users and AI agents (The "Agent-First" API).
2. **Mathematical Processing**: Running thousands of Monte Carlo simulation trials quickly based on historical event logs.

We need to choose a primary backend language that balances development velocity, concurrency, and performance. The two primary candidates are **Go** and **Rust**.

## Options Considered

### Option 1: Go (Golang)
*   **Pros**:
    *   **Concurrency Model**: Goroutines make handling thousands of concurrent WebSocket connections and API requests trivial and resource-efficient.
    *   **Development Velocity**: Simpler syntax and faster compilation lead to quicker iterations.
    *   **Ecosystem**: Excellent standard library for web servers, JSON handling, and database drivers.
*   **Cons**:
    *   **Mathematical Tooling**: Less mature ecosystem for statistical simulations compared to Python or Rust.
    *   **Garbage Collection**: While fast, GC pauses can occasionally introduce latency spikes, though rarely impactful for this type of web workload.

### Option 2: Rust
*   **Pros**:
    *   **Absolute Performance**: Zero-cost abstractions and no garbage collector ensure predictable, ultra-low latency.
    *   **Memory Safety**: The borrow checker guarantees thread safety and prevents memory leaks, crucial for a long-running simulation engine.
    *   **Existing Expertise**: The project owner has established expertise in Rust (e.g., the Molock project).
*   **Cons**:
    *   **Development Velocity**: Steeper learning curve and longer compilation times can slow down rapid prototyping.
    *   **Web Framework Maturity**: Frameworks like Actix or Axum are highly performant but can be more complex to wire up for standard CRUD and WebSockets compared to Go.

## Decision
We will use **Rust** as the primary backend language.

## Rationale
While Go offers faster initial development velocity for the web API portion, Rust's guarantees align perfectly with Kanbrio's "Killer Features":
1. **The Monte Carlo Engine**: Running 10,000 to 1,000,000 trials per simulation request requires extreme CPU efficiency and memory management. Rust is the superior choice for this compute-heavy task.
2. **Agent-First Reliability**: As an AI-orchestrated tool, the API must be flawlessly reliable. Rust's strict compiler prevents entire classes of runtime errors, ensuring the system remains stable even when bombarded with rapid, concurrent agent requests.
3. **Synergy**: Leveraging the existing Rust ecosystem and developer expertise reduces the impact of the steeper learning curve.

## Consequences
- **Positive**: We secure a high-performance foundation capable of scaling to enterprise workloads without needing microservices immediately. The Monte Carlo simulations will run near-instantly.
- **Negative**: Feature velocity may initially be slower as we establish the boilerplate for the web framework (e.g., Axum) and database ORM/Query Builder (e.g., SQLx or SeaORM).
- **Mitigation**: We will mitigate velocity issues by strictly adhering to the "Red-Green-Refactor" TDD workflow to ensure correctness from the start, avoiding complex rewrites later.

## Critical Files
- `apps/api/` (Future location of the Rust backend)
- `AGENTS.md` (Update @developer instructions for Rust context)