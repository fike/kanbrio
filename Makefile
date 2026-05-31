# Kanbrio - Local Development Makefile

.PHONY: db-up db-down db-migrate db-seed setup dev test help docker-up docker-down docker-logs docker-build

export DATABASE_URL ?= postgres://postgres:password@localhost:5432/kanbrio # pragma: allowlist secret

# --- Infrastructure ---

db-up: ## Start the PostgreSQL database
	docker-compose up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker exec kanbrio-postgres pg_isready -U postgres; do sleep 1; done

db-down: ## Stop the PostgreSQL database
	docker-compose down

docker-up: ## Start the entire container stack (web, api, postgres)
	docker-compose up -d --build
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker exec kanbrio-postgres pg_isready -U postgres; do sleep 1; done
	@echo "Kanbrio is up! Access the web app at http://localhost:5173"

docker-down: ## Stop the entire container stack and remove networks
	docker-compose down

docker-logs: ## Tail logs from all active containers
	docker-compose logs -f

docker-build: ## Rebuild container images for api and web
	docker-compose build

db-migrate: ## Run database migrations
	@echo "Running migrations in apps/api..."
	cd apps/api && cargo sqlx migrate run
	@sleep 1

db-seed: ## Seed the database with sample data
	@echo "Seeding database 'kanbrio'..."
	docker exec -i kanbrio-postgres psql -U postgres -d kanbrio -v ON_ERROR_STOP=1 < scripts/seed.sql

setup: db-up db-migrate db-seed ## Initial project setup (DB + Migrations + Seed)
	@echo "Setup complete. Run 'make dev' to start."

# --- Development ---

check: ## Run all local quality gates (lint, tsc, build, clippy, fmt)
	@echo "Checking frontend types..."
	cd apps/web && npx tsc --noEmit
	@echo "Linting frontend..."
	npm run lint -w apps/web
	@echo "Building frontend..."
	npm run build -w apps/web
	@echo "Checking backend formatting..."
	cd apps/api && cargo fmt --check
	@echo "Running backend clippy..."
	cd apps/api && cargo clippy -- -D warnings

dev: ## Start backend and frontend concurrently
	npx concurrently -n "api,web" -c "cyan,magenta" \
		"cd apps/api && cargo run" \
		"npm run dev -w apps/web"

test: ## Run all tests (backend and frontend)
	@echo "Running Backend Tests..."
	cd apps/api && cargo test
	@echo "Running Frontend Tests..."
	npm test -w apps/web

test-e2e: ## Run End-to-End tests
	npm run test -w apps/e2e

# --- Help ---

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
