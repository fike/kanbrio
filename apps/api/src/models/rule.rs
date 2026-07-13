use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

use super::card::Card;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct BusinessRule {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub trigger_type: String,
    pub trigger_config: serde_json::Value,
    pub action_type: String,
    pub action_config: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct TriggerContext {
    pub card_id: Uuid,
    pub workspace_id: Uuid,
    pub from_column_id: Option<Uuid>,
    pub to_column_id: Uuid,
    pub parent_id: Option<Uuid>,
}

/// An action performed by the rule engine that should be broadcast via WS.
#[derive(Debug, Clone)]
pub struct RuleAction {
    /// "moved" or "assigned"
    pub action: String,
    /// The card that was modified
    pub card: Card,
    /// The rule that triggered this action
    pub rule_id: Uuid,
}

struct PendingTrigger {
    trigger_type: String,
    context: TriggerContext,
    depth: u32,
}

pub struct RuleEngine;

impl RuleEngine {
    const MAX_RECURSION_DEPTH: u32 = 5;

    #[tracing::instrument(skip(tx))]
    pub async fn evaluate(
        tx: &mut Transaction<'_, Postgres>,
        workspace_id: Uuid,
        initial_trigger: &str,
        initial_context: &TriggerContext,
        _depth: u32,
    ) -> Result<Vec<RuleAction>, crate::AppError> {
        let mut actions = Vec::new();
        let mut stack = vec![PendingTrigger {
            trigger_type: initial_trigger.to_string(),
            context: initial_context.clone(),
            depth: 0,
        }];

        while let Some(current) = stack.pop() {
            if current.depth >= Self::MAX_RECURSION_DEPTH {
                tracing::warn!(
                    workspace_id = ?workspace_id,
                    trigger_type = ?current.trigger_type,
                    depth = current.depth,
                    "Rule engine recursion limit exceeded"
                );
                return Err(crate::AppError::RecursionLimitExceeded);
            }

            let rules = sqlx::query_as!(
                BusinessRule,
                r#"
                SELECT id, workspace_id, name, trigger_type, trigger_config, action_type, action_config,
                       is_active, created_at, updated_at
                FROM business_rules
                WHERE workspace_id = $1 AND trigger_type = $2 AND is_active = TRUE
                "#,
                workspace_id,
                current.trigger_type
            )
            .fetch_all(&mut **tx)
            .await?;

            for rule in &rules {
                if !Self::matches_trigger(rule, &current.context) {
                    continue;
                }

                match rule.action_type.as_str() {
                    "move_parent_card" => {
                        let (new_triggers, moved_card) =
                            Self::execute_move_parent(tx, rule, &current.context).await?;
                        if let Some(card) = moved_card {
                            actions.push(RuleAction {
                                action: "moved".to_string(),
                                card,
                                rule_id: rule.id,
                            });
                        }
                        for t in new_triggers {
                            stack.push(PendingTrigger {
                                trigger_type: t.0,
                                context: t.1,
                                depth: current.depth + 1,
                            });
                        }
                    }
                    "assign_card" => {
                        if let Some(assigned_card) =
                            Self::execute_assign_card(tx, rule, &current.context).await?
                        {
                            actions.push(RuleAction {
                                action: "assigned".to_string(),
                                card: assigned_card,
                                rule_id: rule.id,
                            });
                        }
                    }
                    _ => {
                        tracing::warn!(
                            action_type = ?rule.action_type,
                            "Unknown action type in business rule"
                        );
                    }
                }
            }
        }

        Ok(actions)
    }

    fn matches_trigger(rule: &BusinessRule, context: &TriggerContext) -> bool {
        match rule.trigger_type.as_str() {
            "child_status_changed" => context.parent_id.is_some(),
            "card_entered_column" => {
                if let Some(target_column_id) = rule
                    .trigger_config
                    .get("column_id")
                    .and_then(|v| v.as_str())
                {
                    let target: Result<Uuid, _> = target_column_id.parse();
                    if let Ok(target_uuid) = target {
                        return context.to_column_id == target_uuid;
                    }
                }
                false
            }
            _ => false,
        }
    }

    async fn execute_move_parent(
        tx: &mut Transaction<'_, Postgres>,
        rule: &BusinessRule,
        context: &TriggerContext,
    ) -> Result<(Vec<(String, TriggerContext)>, Option<Card>), crate::AppError> {
        let mut new_triggers = Vec::new();

        let parent_id = match context.parent_id {
            Some(id) => id,
            None => return Ok((new_triggers, None)),
        };

        let parent = sqlx::query_as!(
            super::card::Card,
            "SELECT * FROM cards WHERE id = $1 FOR UPDATE",
            parent_id
        )
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => crate::AppError::NotFound,
            _ => crate::AppError::Database(e),
        })?;

        let done_column_id: Option<Uuid> = rule
            .action_config
            .get("done_column_id")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok());

        let in_progress_column_id: Option<Uuid> = rule
            .action_config
            .get("in_progress_column_id")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok());

        let source_is_backlog = {
            let row = sqlx::query!(
                "SELECT is_done FROM columns WHERE id = $1",
                context.from_column_id
            )
            .fetch_one(&mut **tx)
            .await?;
            !row.is_done
        };

        let target_is_done = {
            let row = sqlx::query!(
                "SELECT is_done FROM columns WHERE id = $1",
                context.to_column_id
            )
            .fetch_one(&mut **tx)
            .await?;
            row.is_done
        };

        let parent_in_backlog = {
            let row = sqlx::query!(
                "SELECT is_done FROM columns WHERE id = $1",
                parent.current_column_id
            )
            .fetch_one(&mut **tx)
            .await?;
            !row.is_done
        };

        let parent_in_done = {
            let row = sqlx::query!(
                "SELECT is_done FROM columns WHERE id = $1",
                parent.current_column_id
            )
            .fetch_one(&mut **tx)
            .await?;
            row.is_done
        };

        let mut parent_moved = false;
        let mut target_column_id = parent.current_column_id;

        if source_is_backlog
            && parent_in_backlog
            && let Some(ip_col) = in_progress_column_id
        {
            target_column_id = ip_col;
            parent_moved = true;
        }

        if target_is_done && !parent_in_done {
            let all_children_done = {
                let row = sqlx::query!(
                    r#"
                    SELECT COUNT(*) = 0 AS all_done
                    FROM cards c
                    INNER JOIN columns col ON c.current_column_id = col.id
                    WHERE c.parent_id = $1 AND c.deleted_at IS NULL AND col.is_done = FALSE
                    "#,
                    parent_id
                )
                .fetch_one(&mut **tx)
                .await?;
                row.all_done.unwrap_or(false)
            };

            if all_children_done && let Some(done_col) = done_column_id {
                target_column_id = done_col;
                parent_moved = true;
            }
        }

        if parent_moved && target_column_id != parent.current_column_id {
            let updated_parent = sqlx::query_as!(
                super::card::Card,
                r#"
                UPDATE cards
                SET current_column_id = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING *
                "#,
                target_column_id,
                parent_id
            )
            .fetch_one(&mut **tx)
            .await?;

            sqlx::query!(
                r#"
                INSERT INTO card_transitions (
                    card_id, transition_type,
                    from_column_id, to_column_id,
                    payload
                )
                VALUES ($1, 'system_auto_move', $2, $3, $4)
                "#,
                parent_id,
                parent.current_column_id,
                target_column_id,
                serde_json::json!({
                    "triggering_rule_id": rule.id,
                    "triggered_by_card_id": context.card_id,
                    "from_column_id": parent.current_column_id,
                    "to_column_id": target_column_id,
                })
            )
            .execute(&mut **tx)
            .await?;

            let child_context = TriggerContext {
                card_id: parent_id,
                workspace_id: context.workspace_id,
                from_column_id: Some(parent.current_column_id),
                to_column_id: target_column_id,
                parent_id: updated_parent.parent_id,
            };

            new_triggers.push(("child_status_changed".to_string(), child_context.clone()));
            new_triggers.push(("card_entered_column".to_string(), child_context));
            return Ok((new_triggers, Some(updated_parent)));
        }

        Ok((new_triggers, None))
    }

    async fn execute_assign_card(
        tx: &mut Transaction<'_, Postgres>,
        rule: &BusinessRule,
        context: &TriggerContext,
    ) -> Result<Option<Card>, crate::AppError> {
        let assignee_id: Option<Uuid> = if rule
            .action_config
            .get("clear_assignee")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            None
        } else {
            rule.action_config
                .get("assigned_user_id")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
        };

        if let Some(uid) = assignee_id {
            let member = sqlx::query_as!(
                super::user::WorkspaceMember,
                "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 FOR UPDATE",
                context.workspace_id,
                uid
            )
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => crate::AppError::BadRequest(
                    "Target assignee is not a workspace member".into(),
                ),
                _ => crate::AppError::Database(e),
            })?;

            let target_is_active = {
                let row = sqlx::query!(
                    "SELECT is_done FROM columns WHERE id = $1",
                    context.to_column_id
                )
                .fetch_one(&mut **tx)
                .await?;
                !row.is_done
            };

            if let Some(limit) = member.wip_limit
                && target_is_active
            {
                let active_count_row = sqlx::query!(
                    r#"
                        SELECT COUNT(*)
                        FROM cards c
                        INNER JOIN columns col ON c.current_column_id = col.id
                        WHERE c.assigned_user_id = $1
                          AND c.workspace_id = $2
                          AND col.is_done = FALSE
                          AND c.is_archived = FALSE
                          AND c.deleted_at IS NULL
                          AND c.id != $3
                        "#,
                    uid,
                    context.workspace_id,
                    context.card_id
                )
                .fetch_one(&mut **tx)
                .await?;

                let active_count = active_count_row.count.unwrap_or(0);
                if active_count >= limit as i64 {
                    tracing::warn!(
                        user_id = ?uid,
                        workspace_id = ?context.workspace_id,
                        limit = limit,
                        active_count = active_count,
                        "Automation rule rejected: user WIP limit exceeded"
                    );
                    return Err(crate::AppError::WipLimitExceeded {
                        entity: "user".to_string(),
                        limit,
                    });
                }
            }
        }

        let updated_card = sqlx::query_as!(
            Card,
            r#"
            UPDATE cards
            SET assigned_user_id = $1, updated_at = NOW()
            WHERE id = $2 AND workspace_id = $3
            RETURNING *
            "#,
            assignee_id,
            context.card_id,
            context.workspace_id
        )
        .fetch_one(&mut **tx)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO card_transitions (card_id, user_id, transition_type, payload)
            VALUES ($1, NULL, 'system_auto_assign', $2)
            "#,
            context.card_id,
            serde_json::json!({
                "triggering_rule_id": rule.id,
                "new_assignee": assignee_id,
            })
        )
        .execute(&mut **tx)
        .await?;

        Ok(Some(updated_card))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_matches_trigger_child_status_changed() {
        let rule = BusinessRule {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            name: "Test".into(),
            trigger_type: "child_status_changed".into(),
            trigger_config: json!({}),
            action_type: "move_parent_card".into(),
            action_config: json!({}),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let ctx_with_parent = TriggerContext {
            card_id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            from_column_id: None,
            to_column_id: Uuid::new_v4(),
            parent_id: Some(Uuid::new_v4()),
        };

        let ctx_without_parent = TriggerContext {
            card_id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            from_column_id: None,
            to_column_id: Uuid::new_v4(),
            parent_id: None,
        };

        assert!(RuleEngine::matches_trigger(&rule, &ctx_with_parent));
        assert!(!RuleEngine::matches_trigger(&rule, &ctx_without_parent));
    }

    #[test]
    fn test_matches_trigger_card_entered_column() {
        let target_col = Uuid::new_v4();
        let other_col = Uuid::new_v4();

        let rule = BusinessRule {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            name: "Test".into(),
            trigger_type: "card_entered_column".into(),
            trigger_config: json!({ "column_id": target_col.to_string() }),
            action_type: "assign_card".into(),
            action_config: json!({}),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let ctx_matching = TriggerContext {
            card_id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            from_column_id: None,
            to_column_id: target_col,
            parent_id: None,
        };

        let ctx_non_matching = TriggerContext {
            card_id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            from_column_id: None,
            to_column_id: other_col,
            parent_id: None,
        };

        assert!(RuleEngine::matches_trigger(&rule, &ctx_matching));
        assert!(!RuleEngine::matches_trigger(&rule, &ctx_non_matching));
    }

    #[test]
    #[allow(clippy::assertions_on_constants)]
    fn test_recursion_depth_limit() {
        assert!(RuleEngine::MAX_RECURSION_DEPTH >= 5);
    }
}
