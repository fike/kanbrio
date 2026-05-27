# Kanbrio - Local Development Makefile

.PHONY: db-up db-down db-migrate db-seed setup dev test help

# --- Infrastructure ---

db-up: ## Start the PostgreSQL database
	docker-compose up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker exec kanbrio-postgres pg_isready -U postgres; do sleep 1; done

db-down: ## Stop the PostgreSQL database
	docker-compose down

db-migrate: ## Run database migrations
	cd apps/api && cargo sqlx migrate run

db-seed: ## Seed the database with sample data
	@echo "Seeding database..."
	docker exec -i kanbrio-postgres psql -U postgres -d kanbrio < scripts/seed.sql

setup: db-up db-migrate db-seed ## Initial project setup (DB + Migrations + Seed)
	@echo "Setup complete. Run 'make dev' to start."

# --- Development ---

dev: ## Start backend and frontend concurrently
	npx concurrently -n "api,web" -c "cyan,magenta" \
		"cd apps/api && cargo run" \
		"npm run dev -w apps/web"

test: ## Run all tests (backend and frontend)
	@echo "Running Backend Tests..."
	cd apps/api && cargo test
	@echo "Running Frontend Tests..."
	npm test -w apps/web

# --- Help ---

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
