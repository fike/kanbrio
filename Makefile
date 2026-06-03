# Makefile — Kanbrio project targets

# Docker Compose CLI (v2 — space, not hyphen)
COMPOSE := docker compose

# PostgreSQL connection (override via .env or shell)
export DATABASE_URL ?= postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:5432/$(POSTGRES_DB)

.PHONY: all setup test clean docker-up docker-down docker-logs \
        compose compose-down compose-test compose-logs compose-observability

all: setup

# ── Development ──────────────────────────────────────────────────────

setup:
	@echo "Setting up development environment..."
	@cp -f .env.example .env 2>/dev/null || true
	$(COMPOSE) up -d --build postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 5
	@cargo test --package kanbrio-api -- --test-threads=1 || true
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
	cargo test --workspace

test-api:
	cargo test --package kanbrio-api

test-workspace:
	cargo test --workspace

# ── Build ────────────────────────────────────────────────────────────

build:
	cargo build --workspace --release

# ── Clean ────────────────────────────────────────────────────────────

clean:
	cargo clean --workspace
	rm -rf apps/web/node_modules
	rm -rf apps/web/dist
