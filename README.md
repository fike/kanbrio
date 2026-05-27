# Kanbrio

Enterprise-grade open-source Kanban system inspired by Businessmap (Kanbanize).

## Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose
- [Rust](https://www.rust-lang.org/) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- [sqlx-cli](https://github.com/launchbadge/sqlx) (`cargo install sqlx-cli`)

## Quick Start

1. **Setup the environment:**
   This command starts the database, runs migrations, and populates sample data.
   ```bash
   make setup
   ```

2. **Start the development servers:**
   This will start both the backend API and the frontend web app.
   ```bash
   make dev
   ```

3. **Run tests:**
   ```bash
   make test
   ```

## Architecture
Kanbrio is a monorepo:
- `apps/api`: Rust (Axum) backend.
- `apps/web`: SolidJS frontend.
- `docs/adr`: Architectural Decision Records.

See [ORGANIZATION.md](./ORGANIZATION.md) for more details.
