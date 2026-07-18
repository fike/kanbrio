# Makefile — Kanbrio project targets

# Docker Compose CLI (v2 — space, not hyphen)
COMPOSE := docker compose

# Export DATABASE_URL for SQLx compile-time validation (reads from .env)
-include .env
export DATABASE_URL := $(DATABASE_URL)

.PHONY: all setup test clean docker-up docker-down docker-logs \
        compose compose-down compose-test compose-logs compose-observability \
        build seed demo

all: setup

# ── Development ──────────────────────────────────────────────────────

setup:
	@echo "Setting up development environment..."
	@cp -f .env.example .env 2>/dev/null || true
	$(COMPOSE) up -d --build postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 5
	@cd apps/api && cargo test || true
	@echo "Setup complete."

# ── Legacy Docker targets (deprecated — use compose-* instead) ───────

docker-up:
	$(COMPOSE) up -d --build

docker-down:
	$(COMPOSE) down

docker-logs:
	$(COMPOSE) logs -f

# ── Compose v2 targets ───────────────────────────────────────────────

compose:
	$(COMPOSE) up -d --build

compose-down:
	$(COMPOSE) down

compose-test:
	$(COMPOSE) -f docker-compose.yml -f docker-compose-test.yml up -d --build

compose-logs:
	$(COMPOSE) logs -f

compose-observability:
	@echo "Starting observability stack..."
	$(COMPOSE) up -d jaeger loki promtail prometheus grafana otel-collector

# ── Testing ──────────────────────────────────────────────────────────

test:
	cd apps/api && cargo test

test-api:
	cd apps/api && cargo test

test-workspace:
	cd apps/api && cargo test

# ── Build ────────────────────────────────────────────────────────────

build:
	cd apps/api && cargo build --release

# ── Database Seed ────────────────────────────────────────────────────

seed:
	@echo "Running seed data..."
	$(COMPOSE) exec -T postgres psql -U postgres -d kanbrio < scripts/seed.sql

demo:
	@echo "Running full demo data (resets all tables)..."
	$(COMPOSE) exec -T postgres psql -U postgres -d kanbrio < scripts/demo.sql

# ── Clean ────────────────────────────────────────────────────────────

clean:
	cd apps/api && cargo clean
	rm -rf apps/web/node_modules
	rm -rf apps/web/dist
