# Project Kanbrio: Product Discovery

This document captures the strategic discovery and user-centric research for Kanbrio, an enterprise-grade Flow Management System.

---

## 👥 User Personas

We target three key roles that "hire" Kanbrio to solve specific systemic problems.

### 1. The Agile Coach (The "Flow Optimizer")
- **Core Value**: Systematic continuous improvement (Kaizen).
- **Big Problem**: "I can't prove my optimizations are working without hard, clean data. Teams are 'busy' but not 'productive'."
- **Desired Outcome**: A clear view of Flow Efficiency and Blocker Clusters to remove systemic waste.

### 2. The Project Manager (The "Predictability Expert")
- **Core Value**: Reliable delivery and risk management.
- **Big Problem**: "I rely on gut feel for deadlines. I spend 20% of my week manually chasing status updates and updating Gantt charts."
- **Desired Outcome**: Probabilistic forecasting (Monte Carlo) and automated status roll-ups from tasks to initiatives.

### 3. The CTO (The "Strategic Visionary")
- **Core Value**: R&D ROI and Strategic Alignment.
- **Big Problem**: "I have 50 teams but no 'single pane of glass' to see if their work actually supports our OKRs. I don't know where our capacity is leaking."
- **Desired Outcome**: A Portfolio Dashboard that aggregates real-time data from every team board into strategic initiatives.

---

## 🎯 Jobs-to-be-Done (JTBD)

| Situation | Motivation | Expected Outcome |
| :--- | :--- | :--- |
| **When** we have complex cross-team dependencies... | **I want** to see the links and blockers in real-time... | **So I can** prevent delays before they hit the customer. |
| **When** stakeholders ask 'When will it be done?'... | **I want** to use historical throughput data (Monte Carlo)... | **So I can** give a date with 85% confidence instead of a guess. |
| **When** a developer finishes a subtask... | **I want** the parent initiative's progress to update automatically... | **So I can** eliminate manual status reporting. |
| **When** an AI agent joins the team... | **I want** a system that is natively designed for machine orchestration... | **So I can** automate triaging and flow management. |

---

## ⚠️ The "Big Problem" Kanbrio Solves

Modern teams are using **Task Trackers** (Trello, Jira) when they actually need **Flow Management Systems** (Businessmap).

- **The Gap**: Most open-source tools show *what* is happening (State), but not *why* it's taking so long (Flow).
- **The Solution**: Kanbrio is built "Flow-First". Every transition is an event, and every event is data for the Monte Carlo engine. It's a "Cérebro" (Brain) for the Kanban board, not just a list of cards.

---

## 🚀 Vision for v0.1 (The Skeleton)

**Problem Statement**: "I can't visualize my hierarchical work (Initiatives -> Tasks) across multiple categories (Swimlanes) in an open-source tool without manual sync."

**Discovery Focus**:
1. How do we make the Parent-Child relationship "natural" and not a chore?
2. How do we ensure Swimlanes clarify context instead of adding clutter?
3. How do we record the first 'Event' (Created/Moved) to start the historical data set?
