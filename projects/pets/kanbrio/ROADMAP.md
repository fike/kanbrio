# Project Kanbrio: Comprehensive Roadmap

This document outlines the strategic development of Kanbrio, an enterprise-grade open-source Kanban system inspired by Businessmap (Kanbanize).

---

## 🌀 Cycle 1: Foundation & Data Core
*Goal: Build the robust relational infrastructure for a 2D workflow (Columns x Swimlanes) and multi-level portfolios.*

- [ ] **Unified Board Schema**:
    - **Vertical Columns**: Support for nested columns (e.g., `In Progress` -> `Development` | `Review`).
    - **Horizontal Swimlanes**: Support for multiple lanes (e.g., `Expedite`, `Standard`, `Internal`).
- [ ] **Recursive Node Architecture**:
    - **Hierarchical Tasks**: Infinite Parent-Child relationships using PostgreSQL Recursive CTEs.
    - **Linked Nodes**: Dependency types (Predecessor/Successor, Blocker/Blocked).
- [ ] **Advanced Metadata System**:
    - **Card Types & Templates**: Predefined fields for different work types (e.g., Bug, Feature, Service Request).
    - **Custom Fields**: Flexible schema for domain-specific data.
- [ ] **Audit & Event Engine**:
    - **Immutable Transition Log**: Every move records `CardID`, `From (Col/Lane)`, `To (Col/Lane)`, `UserID`, and `Timestamp`.
    - **Blocker Tracking**: Log `Blocked` and `Unblocked` events with mandatory `Reason` codes.

---

## 🌀 Cycle 2: Advanced Workflow & Automation
*Goal: Implement the "Actionable" board with real-time feedback and business logic.*

- [ ] **Work-in-Progress (WIP) Enforcement**:
    - **Column WIP**: Limit number of cards in a stage.
    - **Swimlane WIP**: Limit capacity for a specific category (e.g., max 1 Expedite).
    - **User WIP**: Prevent team member burnout by limiting assigned tasks.
- [ ] **Arrival & Departure Rules**:
    - **Checklists**: Mandatory tasks to be completed before a card can move.
    - **Field Validation**: Ensure required fields are filled upon exit/entry.
- [ ] **Business Rules Engine (IFTTT)**:
    - **Status Sync**: "If child moves to Done, and all siblings are Done -> Move Parent to Done."
    - **Auto-Assignment**: "If card enters QA lane -> Assign to User X."
- [ ] **Real-time Sync & Edge API**:
    - **Native WebSockets**: Instant updates across all clients.
    - **Agent-First SDK**: gRPC/REST interface for AI orchestrators to move cards.

---

## 🌀 Cycle 3: Lean Analytics & Prediction
*Goal: Turn the event log into strategic intelligence using statistical models.*

- [ ] **Visualization Suite**:
    - **Cumulative Flow Diagram (CFD)**: Real-time stability visualization.
    - **Cycle Time Scatter Plot**: Identify outliers and predictability.
    - **Blocker Clustering**: Heatmap of why work stops.
- [ ] **Monte Carlo Simulation Engine**:
    - **"When" Simulation**: Probabilistic forecast for a specific backlog (e.g., 85% confidence for Date X).
    - **"How Many" Simulation**: Predict throughput for a fixed time box.
- [ ] **Efficiency Metrics**:
    - **Flow Efficiency**: Automatic calculation of (Lead Time - Wait Time) / Lead Time.
    - **Aging WIP Radar**: Identify cards spending too much time in a single column.

---

## 🌀 Cycle 4: Portfolio & Strategic Management
*Goal: Connect execution to high-level business strategy and OKRs.*

- [ ] **Management Workspace**:
    - **Portfolio Boards**: A master board where each "card" represents a project or initiative from a child board.
    - **Automated Roll-ups**: Multi-level progress bars aggregating effort/count from bottom to top.
- [ ] **OKR Module**:
    - **Objectives & Key Results**: Link Initiatives directly to business goals.
    - **Strategic Alignment Views**: Visualize which work supports which strategic pillar.
- [ ] **Multi-tenancy & Security**:
    - **Enterprise Isolation**: Support for multiple organizations with separate data logs.
    - **Granular Permissions**: Role-based access control down to the swimlane level.

---

## 🛠️ Technology Stack

- **Backend**: **Rust** (High-performance parallel processing for simulations and agents).
- **Database**: **PostgreSQL** (Recursive hierarchy + JSONB for custom fields).
- **Frontend**: **SolidStart + TypeScript + Bun** (Fine-grained reactivity for zero-latency boards).
- **Real-time**: **WebSockets / Redis** (Instant sync across all clients and agents).
- **Analytics**: **Apache ECharts** (Canvas-based rendering for dense simulation data).
