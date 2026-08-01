use chrono::{DateTime, NaiveDate, TimeDelta, Utc};
use rand::Rng;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct CycleTimePoint {
    pub card_id: Uuid,
    pub title: String,
    pub completed_at: DateTime<Utc>,
    pub cycle_time_hours: f64,
    pub assignee_id: Option<Uuid>,
    pub assignee_name: Option<String>,
    pub swimlane: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CycleTimeResponse {
    pub data_points: Vec<CycleTimePoint>,
    pub percentiles: Percentiles,
}

#[derive(Debug, Serialize)]
pub struct Percentiles {
    pub p50: f64,
    pub p85: f64,
    pub p95: f64,
}

#[derive(Debug, Serialize)]
pub struct FlowEfficiencyResponse {
    pub efficiency_pct: f64,
    pub active_hours: f64,
    pub wait_hours: f64,
    pub total_cards: i64,
    pub by_column: Vec<ColumnWaitBreakdown>,
}

#[derive(Debug, Serialize)]
pub struct ColumnWaitBreakdown {
    pub column_id: Uuid,
    pub title: String,
    pub wait_hours: f64,
    pub card_count: i64,
}

#[derive(Debug, Serialize)]
pub struct AgingWipCard {
    pub card_id: Uuid,
    pub title: String,
    pub column_title: String,
    pub assignee_name: Option<String>,
    pub idle_hours: f64,
    pub idle_days: i64,
    pub entered_column_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AgingWipResponse {
    pub stagnant_cards: Vec<AgingWipCard>,
    pub stagnant_count: i64,
    pub threshold_days: i32,
    pub total_cards_in_active_columns: i64,
}

pub struct BoardAnalytics;

impl BoardAnalytics {
    pub async fn cycle_times(
        pool: &PgPool,
        workspace_id: Uuid,
        days: i32,
    ) -> Result<CycleTimeResponse, crate::AppError> {
        let rows = sqlx::query_as!(
            CycleTimeRow,
            r#"
            SELECT
                c.id AS card_id,
                c.title,
                fd.done_at AS completed_at,
                (EXTRACT(EPOCH FROM (fd.done_at - c.created_at)) / 3600.0)::float8 AS cycle_time_hours,
                c.assigned_user_id AS assignee_id,
                u.name AS assignee_name,
                sl.title AS swimlane
            FROM cards c
            INNER JOIN LATERAL (
                SELECT ct.occurred_at AS done_at
                FROM card_transitions ct
                INNER JOIN columns col ON col.id = ct.to_column_id
                WHERE ct.card_id = c.id
                  AND col.is_done = TRUE
                  AND col.workspace_id = $1
                ORDER BY ct.occurred_at ASC
                LIMIT 1
            ) fd ON TRUE
            LEFT JOIN users u ON u.id = c.assigned_user_id
            LEFT JOIN swimlanes sl ON sl.id = c.current_swimlane_id
            WHERE c.workspace_id = $1
              AND c.deleted_at IS NULL
              AND fd.done_at >= NOW() - ($2::text || ' days')::INTERVAL
            ORDER BY fd.done_at ASC
            "#,
            workspace_id,
            days.to_string(),
        )
        .fetch_all(pool)
        .await?;

        let data_points: Vec<CycleTimePoint> = rows
            .into_iter()
            .filter_map(|r| {
                Some(CycleTimePoint {
                    card_id: r.card_id,
                    title: r.title,
                    completed_at: r.completed_at?,
                    cycle_time_hours: r.cycle_time_hours.unwrap_or(0.0),
                    assignee_id: r.assignee_id,
                    assignee_name: r.assignee_name,
                    swimlane: r.swimlane,
                })
            })
            .collect();

        let percentiles = Self::compute_percentiles(&data_points);

        Ok(CycleTimeResponse {
            data_points,
            percentiles,
        })
    }

    fn compute_percentiles(points: &[CycleTimePoint]) -> Percentiles {
        if points.is_empty() {
            return Percentiles {
                p50: 0.0,
                p85: 0.0,
                p95: 0.0,
            };
        }
        let mut values: Vec<f64> = points.iter().map(|p| p.cycle_time_hours).collect();
        values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        Percentiles {
            p50: Self::percentile(&values, 50.0),
            p85: Self::percentile(&values, 85.0),
            p95: Self::percentile(&values, 95.0),
        }
    }

    fn percentile(sorted: &[f64], p: f64) -> f64 {
        if sorted.is_empty() {
            return 0.0;
        }
        let idx = ((p / 100.0) * (sorted.len() as f64 - 1.0)).round() as usize;
        sorted[idx.clamp(0, sorted.len() - 1)]
    }

    pub async fn flow_efficiency(
        pool: &PgPool,
        workspace_id: Uuid,
    ) -> Result<FlowEfficiencyResponse, crate::AppError> {
        let rows = sqlx::query_as!(
            FlowEfficiencyRow,
            r#"
            SELECT
                col.id AS column_id,
                col.title,
                COUNT(DISTINCT c.id)::int8 AS card_count,
                COALESCE(SUM(
                    (EXTRACT(EPOCH FROM (NOW() - COALESCE(
                        (SELECT ct.occurred_at FROM card_transitions ct
                         WHERE ct.card_id = c.id AND ct.to_column_id = c.current_column_id
                         ORDER BY ct.occurred_at DESC LIMIT 1),
                        c.created_at
                    ))) / 3600.0)::float8
                ), 0.0) AS total_wait_hours
            FROM cards c
            INNER JOIN columns col ON col.id = c.current_column_id
            WHERE c.workspace_id = $1
              AND c.deleted_at IS NULL
              AND c.is_archived = FALSE
              AND col.is_done = FALSE
            GROUP BY col.id, col.title
            ORDER BY total_wait_hours DESC
            "#,
            workspace_id,
        )
        .fetch_all(pool)
        .await?;

        let mut by_column = Vec::new();
        let mut total_wait = 0.0_f64;
        let mut total_cards: i64 = 0;

        for r in rows {
            let wait = r.total_wait_hours.unwrap_or(0.0);
            total_wait += wait;
            total_cards += r.card_count.unwrap_or(0);
            by_column.push(ColumnWaitBreakdown {
                column_id: r.column_id,
                title: r.title,
                wait_hours: (wait * 100.0).round() / 100.0,
                card_count: r.card_count.unwrap_or(0),
            });
        }

        let total_age_hours = sqlx::query_scalar!(
            r#"
            SELECT COALESCE(SUM(
                (EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 3600.0)::float8
            ), 0.0)::float8
            FROM cards c
            INNER JOIN columns col ON col.id = c.current_column_id
            WHERE c.workspace_id = $1
              AND c.deleted_at IS NULL
              AND c.is_archived = FALSE
              AND col.is_done = FALSE
            "#,
            workspace_id,
        )
        .fetch_one(pool)
        .await?;

        let total_age_hours = total_age_hours.unwrap_or(0.0);
        let active_hours = (total_age_hours - total_wait).max(0.0);
        let total = active_hours + total_wait;
        let efficiency_pct = if total > 0.0 {
            (active_hours / total * 100.0 * 100.0).round() / 100.0
        } else {
            100.0
        };

        Ok(FlowEfficiencyResponse {
            efficiency_pct,
            active_hours: (active_hours * 100.0).round() / 100.0,
            wait_hours: (total_wait * 100.0).round() / 100.0,
            total_cards,
            by_column,
        })
    }

    pub async fn aging_wip(
        pool: &PgPool,
        workspace_id: Uuid,
        threshold_days: i32,
    ) -> Result<AgingWipResponse, crate::AppError> {
        let total = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::int8
            FROM cards c
            INNER JOIN columns col ON col.id = c.current_column_id
            WHERE c.workspace_id = $1
              AND c.deleted_at IS NULL
              AND c.is_archived = FALSE
              AND col.is_done = FALSE
            "#,
            workspace_id,
        )
        .fetch_one(pool)
        .await?
        .unwrap_or(0);

        let rows = sqlx::query_as!(
            AgingWipRow,
            r#"
            SELECT
                c.id AS card_id,
                c.title,
                col.title AS column_title,
                u.name AS assignee_name,
                (EXTRACT(EPOCH FROM (NOW() - COALESCE(
                    (SELECT ct.occurred_at FROM card_transitions ct
                     WHERE ct.card_id = c.id AND ct.to_column_id = c.current_column_id
                     ORDER BY ct.occurred_at DESC LIMIT 1),
                    c.created_at
                ))) / 3600.0)::float8 AS idle_hours,
                COALESCE(
                    (SELECT ct.occurred_at FROM card_transitions ct
                     WHERE ct.card_id = c.id AND ct.to_column_id = c.current_column_id
                     ORDER BY ct.occurred_at DESC LIMIT 1),
                    c.created_at
                ) AS entered_column_at
            FROM cards c
            INNER JOIN columns col ON col.id = c.current_column_id
            LEFT JOIN users u ON u.id = c.assigned_user_id
            WHERE c.workspace_id = $1
              AND c.deleted_at IS NULL
              AND c.is_archived = FALSE
              AND col.is_done = FALSE
              AND (EXTRACT(EPOCH FROM (NOW() - COALESCE(
                    (SELECT ct.occurred_at FROM card_transitions ct
                     WHERE ct.card_id = c.id AND ct.to_column_id = c.current_column_id
                     ORDER BY ct.occurred_at DESC LIMIT 1),
                    c.created_at
                ))) / 3600.0)::float8 > ($2 * 24)::float8
            ORDER BY idle_hours DESC
            "#,
            workspace_id,
            threshold_days as i64,
        )
        .fetch_all(pool)
        .await?;

        let stagnant_cards: Vec<AgingWipCard> = rows
            .into_iter()
            .filter_map(|r| {
                let idle_hours = r.idle_hours?;
                Some(AgingWipCard {
                    card_id: r.card_id,
                    title: r.title,
                    column_title: r.column_title,
                    assignee_name: r.assignee_name,
                    idle_hours: (idle_hours * 100.0).round() / 100.0,
                    idle_days: (idle_hours / 24.0).round() as i64,
                    entered_column_at: r.entered_column_at?,
                })
            })
            .collect();

        Ok(AgingWipResponse {
            stagnant_count: stagnant_cards.len() as i64,
            stagnant_cards,
            threshold_days,
            total_cards_in_active_columns: total,
        })
    }
}

#[derive(Debug, sqlx::FromRow)]
struct CycleTimeRow {
    card_id: Uuid,
    title: String,
    completed_at: Option<DateTime<Utc>>,
    cycle_time_hours: Option<f64>,
    assignee_id: Option<Uuid>,
    assignee_name: Option<String>,
    swimlane: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct FlowEfficiencyRow {
    column_id: Uuid,
    title: String,
    card_count: Option<i64>,
    total_wait_hours: Option<f64>,
}

#[derive(Debug, sqlx::FromRow)]
struct AgingWipRow {
    card_id: Uuid,
    title: String,
    column_title: String,
    assignee_name: Option<String>,
    idle_hours: Option<f64>,
    entered_column_at: Option<DateTime<Utc>>,
}

// --- CFD types ---

#[derive(Debug, Serialize)]
pub struct CFDColumn {
    pub id: Uuid,
    pub title: String,
    pub color: String,
}

#[derive(Debug, Serialize)]
pub struct CFDPoint {
    pub date: NaiveDate,
    pub counts: std::collections::HashMap<Uuid, i64>,
}

#[derive(Debug, Serialize)]
pub struct CFDResponse {
    pub columns: Vec<CFDColumn>,
    pub data_points: Vec<CFDPoint>,
}

// --- Monte Carlo types ---

#[derive(Debug, Serialize)]
pub struct MonteCarloBin {
    pub days: i64,
    pub probability: f64,
}

#[derive(Debug, Serialize)]
pub struct MonteCarloPercentiles {
    pub p50: i64,
    pub p75: i64,
    pub p85: i64,
    pub p95: i64,
}

#[derive(Debug, Serialize)]
pub struct MonteCarloSimulations {
    pub histogram: Vec<MonteCarloBin>,
    pub percentiles: MonteCarloPercentiles,
    pub total_cards: i64,
}

#[derive(Debug, Serialize)]
pub struct MonteCarloResponse {
    pub throughput_data: Vec<i64>,
    pub simulations: MonteCarloSimulations,
}

// --- BoardAnalytics impl extensions ---

impl BoardAnalytics {
    /// Compute Cumulative Flow Diagram data.
    /// Uses on-the-fly aggregation from card_transitions.
    pub async fn cfd(
        pool: &PgPool,
        workspace_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<CFDResponse, crate::AppError> {
        // Get columns for this workspace
        let col_rows = sqlx::query_as!(
            CFDColumnRow,
            r#"
            SELECT id, title, is_done
            FROM columns
            WHERE workspace_id = $1
            ORDER BY position ASC
            "#,
            workspace_id,
        )
        .fetch_all(pool)
        .await?;

        let columns: Vec<CFDColumn> = col_rows
            .into_iter()
            .map(|r| CFDColumn {
                id: r.id,
                title: r.title,
                color: if r.is_done { "#22C55E" } else { "#2563EB" }.to_string(),
            })
            .collect();

        if columns.is_empty() {
            return Ok(CFDResponse {
                columns: vec![],
                data_points: vec![],
            });
        }

        let column_ids: Vec<Uuid> = columns.iter().map(|c| c.id).collect();

        // Get all transitions that happened up to the "to" date
        // We'll rebuild card positions for each snapshot date
        let transitions = sqlx::query_as!(
            CFDTxRow,
            r#"
            SELECT card_id, occurred_at, to_column_id
            FROM card_transitions
            WHERE to_column_id = ANY($1)
              AND occurred_at::date <= $2
            ORDER BY card_id, occurred_at ASC
            "#,
            &column_ids,
            to,
        )
        .fetch_all(pool)
        .await?;

        // Build a map of date -> transitions for efficient lookup
        let mut transitions_by_date: std::collections::HashMap<NaiveDate, Vec<&CFDTxRow>> =
            std::collections::HashMap::new();
        for tx in &transitions {
            let tx_date = match tx.occurred_at {
                Some(dt) => dt.date_naive(),
                None => continue,
            };
            if tx_date >= from && tx_date <= to {
                transitions_by_date.entry(tx_date).or_default().push(tx);
            }
        }

        // For each date in range, carry forward previous state and apply new transitions
        let mut data_points = Vec::new();
        let mut current_date = from;
        // Track each card's current column position
        let mut card_columns: std::collections::HashMap<Uuid, Uuid> =
            std::collections::HashMap::new();
        // Track column counts (derived from card_columns)
        let mut column_counts: std::collections::HashMap<Uuid, i64> =
            std::collections::HashMap::new();
        for col in &columns {
            column_counts.insert(col.id, 0);
        }

        while current_date <= to {
            // Apply new transitions that happened on this date
            if let Some(day_transitions) = transitions_by_date.get(&current_date) {
                let mut seen_cards: std::collections::HashSet<Uuid> =
                    std::collections::HashSet::new();
                for tx in day_transitions {
                    let card_id = match tx.card_id {
                        Some(id) => id,
                        None => continue,
                    };
                    let col_id = match tx.to_column_id {
                        Some(id) => id,
                        None => continue,
                    };
                    if seen_cards.contains(&card_id) {
                        continue;
                    }
                    seen_cards.insert(card_id);
                    // Decrement old column if card was already tracked
                    if let Some(old_col_id) = card_columns.insert(card_id, col_id)
                        && let Some(count) = column_counts.get_mut(&old_col_id)
                    {
                        *count -= 1;
                    }
                    *column_counts.entry(col_id).or_insert(0) += 1;
                }
            }

            // Clone counts for this data point
            let mut counts = std::collections::HashMap::new();
            for col in &columns {
                counts.insert(col.id, *column_counts.get(&col.id).unwrap_or(&0));
            }

            data_points.push(CFDPoint {
                date: current_date,
                counts,
            });

            current_date = match current_date.checked_add_signed(TimeDelta::days(1)) {
                Some(d) => d,
                None => break,
            };
        }

        Ok(CFDResponse {
            columns,
            data_points,
        })
    }

    /// Monte Carlo simulation for delivery forecasting.
    pub async fn monte_carlo(
        pool: &PgPool,
        workspace_id: Uuid,
        days: i32,
        simulations: i32,
    ) -> Result<MonteCarloResponse, crate::AppError> {
        // Daily throughput: cards completed per day in the window
        let rows = sqlx::query_as!(
            ThroughputRow,
            r#"
            SELECT
                DATE(ct.occurred_at) AS "date",
                COUNT(*)::int8 AS "count"
            FROM card_transitions ct
            INNER JOIN columns col ON col.id = ct.to_column_id
            WHERE col.workspace_id = $1
              AND col.is_done = TRUE
              AND ct.occurred_at >= NOW() - ($2::text || ' days')::INTERVAL
            GROUP BY DATE(ct.occurred_at)
            ORDER BY date ASC
            "#,
            workspace_id,
            days.to_string(),
        )
        .fetch_all(pool)
        .await?;

        let throughput_data: Vec<i64> = rows.iter().filter_map(|r| r.count).collect();

        if throughput_data.is_empty() {
            return Ok(MonteCarloResponse {
                throughput_data: vec![],
                simulations: MonteCarloSimulations {
                    histogram: vec![],
                    percentiles: MonteCarloPercentiles {
                        p50: 0,
                        p75: 0,
                        p85: 0,
                        p95: 0,
                    },
                    total_cards: 0,
                },
            });
        }

        // Count cards currently in active (non-done) columns (backlog to simulate)
        let total_cards = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::int8
            FROM cards c
            INNER JOIN columns col ON col.id = c.current_column_id
            WHERE c.workspace_id = $1
              AND c.deleted_at IS NULL
              AND c.is_archived = FALSE
              AND col.is_done = FALSE
            "#,
            workspace_id,
        )
        .fetch_one(pool)
        .await?
        .unwrap_or(0);

        if total_cards == 0 {
            return Ok(MonteCarloResponse {
                throughput_data,
                simulations: MonteCarloSimulations {
                    histogram: vec![],
                    percentiles: MonteCarloPercentiles {
                        p50: 0,
                        p75: 0,
                        p85: 0,
                        p95: 0,
                    },
                    total_cards: 0,
                },
            });
        }

        // Run Monte Carlo simulations
        let mut rng = rand::thread_rng();
        let results: Vec<i64> = (0..simulations)
            .map(|_| {
                let mut remaining = total_cards;
                let mut elapsed = 0i64;
                while remaining > 0 {
                    let idx = rng.gen_range(0..throughput_data.len());
                    let completed = throughput_data[idx];
                    remaining -= completed;
                    elapsed += 1;
                }
                elapsed
            })
            .collect();

        // Build histogram
        let max_days = *results.iter().max().unwrap_or(&1);
        let min_days = *results.iter().min().unwrap_or(&0);
        let mut histogram = Vec::new();

        for day in min_days..=max_days {
            let count = results.iter().filter(|&&r| r == day).count() as f64;
            histogram.push(MonteCarloBin {
                days: day,
                probability: (count / simulations as f64 * 10000.0).round() / 100.0,
            });
        }

        // Compute percentiles
        let mut sorted = results.clone();
        sorted.sort();

        let p50 = Self::percentile_value(&sorted, 50.0);
        let p75 = Self::percentile_value(&sorted, 75.0);
        let p85 = Self::percentile_value(&sorted, 85.0);
        let p95 = Self::percentile_value(&sorted, 95.0);

        Ok(MonteCarloResponse {
            throughput_data,
            simulations: MonteCarloSimulations {
                histogram,
                percentiles: MonteCarloPercentiles { p50, p75, p85, p95 },
                total_cards,
            },
        })
    }

    fn percentile_value(sorted: &[i64], p: f64) -> i64 {
        if sorted.is_empty() {
            return 0;
        }
        let idx = ((p / 100.0) * (sorted.len() as f64 - 1.0)).round() as usize;
        sorted[idx.clamp(0, sorted.len() - 1)]
    }
}

#[derive(Debug, sqlx::FromRow)]
struct CFDTxRow {
    card_id: Option<Uuid>,
    occurred_at: Option<DateTime<Utc>>,
    to_column_id: Option<Uuid>,
}

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct ThroughputRow {
    date: Option<NaiveDate>,
    count: Option<i64>,
}

#[derive(Debug, sqlx::FromRow)]
struct CFDColumnRow {
    id: Uuid,
    title: String,
    is_done: bool,
}
