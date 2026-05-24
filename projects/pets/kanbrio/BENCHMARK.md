# Project Kanbrio: Detailed Competitive Analysis

This document provides in-depth comparative matrices of Kanban and Project Management solutions to identify technical gaps and strategic opportunities for Kanbrio.

---

## 🏗️ Comparative Matrix: Portfolio & Hierarchy

| Feature | **Businessmap** | **Jira (Plans)** | **Plane** | **Taiga** | **Kanbrio (Target)** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hierarchy Depth** | Unlimited | Unlimited | 4 Levels (Fixed) | 2 Levels (Epic/Story) | **Unlimited (Recursive)** |
| **Status Roll-ups** | Automatic (Event) | Manual/Trigger | Progress Bar | Manual | **Automatic (Event)** |
| **AI Agent Support** | **None** | **High (Rovo)** | **High (Native)** | **None** | **Native Orchestration** |
| **Progress Logic** | Time/Size/Count | Story Points | Issue Count | Story Points | **Hybrid (Audit-based)** |

---

## 📈 Comparative Matrix: Lean Analytics & Forecasting

| Feature | **Businessmap** | **Kanboard** | **Linear** | **Monday.com** | **Kanbrio (Target)** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Monte Carlo (When)** | Yes (Native) | No | No | No | **Yes (High Performance)** |
| **Monte Carlo (How Many)**| Yes | No | No | No | **Yes (High Performance)** |
| **AI Agent Support** | **None** | **None** | **Medium** | **Medium** | **AI-Driven Forecasting** |
| **Flow Efficiency** | Yes | No | No | No | **Yes (Native calculation)** |
| **Aging WIP Analysis** | Yes | No | No | No | **Yes (Real-time Alerter)** |

---

## 💻 Comparative Matrix: Technical Stack & Deployment

| Feature | **Plane** | **Kanboard** | **Leantime** | **Linear** | **Kanbrio (Target)** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend Language** | Python (Django) | PHP | PHP | Node.js | **Rust** |
| **Real-time** | WebSockets | Polling | Limited | Pusher | **WebSockets (Native)** |
| **Agent API Speed** | Moderate | Low | Low | **High** | **Extreme (gRPC/Native)** |
| **Deployment** | Self-host/Cloud | Self-host | Self-host/Cloud | Cloud only | **Self-host / Edge-ready** |

---

## 🤖 AI Agent & Automation Maturity

| Tool | AI Capability Type | Agentic Features |
| :--- | :--- | :--- |
| **Plane** | **Agentic Native** | ADK (Agent Dev Kit), autonomous background agents. |
| **Linear** | **Agent-Friendly** | High-speed API for external agents (Cursor, Gemini CLI). |
| **Jira** | **Enterprise Agents** | Atlassian Rovo: specialized agents for code, docs, tasks. |
| **Leantime** | **Assistive AI** | Focused on neurodiversity and summary generation. |
| **Businessmap** | **None** | Focuses exclusively on deterministic Lean mathematics. |
| **Kanbrio** | **Agent-First** | **Built-in OODA Orchestrator for board management.** |

---

## 🚀 Kanbrio's "Killer Features"

1. **Native Probabilistic Engine**: Fast Monte Carlo written in Rust.
2. **Recursive Hierarchical Roll-ups**: Infinite nesting via PostgreSQL Recursive CTEs.
3. **Agentic Architecture**: Designed to be managed by AI Agents (like the `ooda-orchestrator`) natively, combining Lean math with AI reasoning.
