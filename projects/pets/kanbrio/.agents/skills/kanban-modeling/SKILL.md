---
name: kanban-modeling
description: Procedures for database schema design for hierarchical tasks and event auditing.
---

# Kanban Data Modeling Skill

This skill provides the architectural blueprints for a Business Map-inspired Kanban system.

## 1. Core Entities

- **Workspaces**: Organizational containers.
- **Boards**: Workflows with specific columns and swimlanes.
- **Cards (Nodes)**: The unit of work. Supports Parent-Child relationships.
- **Events (Audit)**: The immutable log of every transition.

## 2. Hierarchical Logic

Use recursive CTEs to calculate parent progress:
```sql
WITH RECURSIVE subordinates AS (
    SELECT id, parent_id, status FROM cards WHERE id = ?
    UNION ALL
    SELECT c.id, c.parent_id, c.status FROM cards c
    INNER JOIN subordinates s ON s.id = c.parent_id
)
SELECT status, count(*) FROM subordinates GROUP BY status;
```

## 3. Workflow Constraints

Ensure the system enforces:
- **WIP Limits**: Column-level validation before move.
- **Exit Criteria**: Checklists or required fields per column.
- **Automation Triggers**: Hook points for business rules.
