---
name: postgres-sqlx-patterns
description: Secure and idiomatic PostgreSQL development using SQLx in Rust.
---

# PostgreSQL & SQLx Patterns Skill

This skill provides standards for database interactions in the Kanbrio backend.

## 1. Security & Integrity

- **SQL Injection**: NEVER use string interpolation for queries. Always use SQLx parameter binding (e.g., `$1`, `$2`).
- **Transactions**: Complex state changes (like moving a card and logging an event) MUST be wrapped in a database transaction.
- **Type Safety**: Use SQLx macros like `query_as!` and `query!` to ensure compile-time check against the database schema.

## 2. Hierarchical Queries

- Leverage **Recursive CTEs** (`WITH RECURSIVE`) for parent-child tree navigation.
- Ensure indexes exist on `parent_id` columns to maintain performance at depth.

## 3. Schema Migrations

- Manage schema changes strictly through SQLx migrations in `apps/api/migrations/`.
- Migrations must be reversible (provide both up and down paths if possible).

## 4. Modern PostgreSQL Features

- Use `UUID` for primary keys to facilitate distributed generation and security.
- Use `JSONB` for flexible metadata and event payloads.
- Use `TIMESTAMPTZ` for all date/time fields to handle timezones correctly.
