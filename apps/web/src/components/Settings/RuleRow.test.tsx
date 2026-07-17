import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { RuleRow } from './RuleRow';
import type { BusinessRule } from '../../api/rules';

function createRule(overrides: Partial<BusinessRule> = {}): BusinessRule {
  return {
    id: 'rule-1',
    workspace_id: 'ws-1',
    name: 'Auto-close parent',
    trigger_type: 'child_status_changed',
    trigger_config: {},
    action_type: 'move_parent_card',
    action_config: { done_column_id: 'col-done', in_progress_column_id: 'col-wip' },
    is_active: true,
    created_at: '2026-07-12T00:00:00Z',
    updated_at: '2026-07-12T00:00:00Z',
    ...overrides,
  };
}

describe('RuleRow', () => {
  function renderRow(overrides: Partial<{
    rule: BusinessRule;
    onToggle: (rule: BusinessRule) => void;
    onDelete: (rule: BusinessRule) => void;
    onEdit: (rule: BusinessRule) => void;
    toggling: boolean;
  }> = {}) {
    return render(() => (
      <RuleRow
        rule={overrides.rule || createRule()}
        onToggle={overrides.onToggle || vi.fn()}
        onDelete={overrides.onDelete || vi.fn()}
        onEdit={overrides.onEdit || vi.fn()}
        toggling={overrides.toggling ?? false}
      />
    ));
  }

  it('renders rule name', () => {
    renderRow();
    expect(screen.getByText('Auto-close parent')).toBeInTheDocument();
  });

  it('renders trigger and action badges', () => {
    renderRow();
    expect(screen.getByText('Child status changed')).toBeInTheDocument();
    expect(screen.getByText('Move parent card')).toBeInTheDocument();
  });

  it('renders unknown trigger/action labels gracefully', () => {
    renderRow({ rule: createRule({
      trigger_type: 'card_entered_column' as const,
      action_type: 'assign_card' as const,
    }) });
    expect(screen.getByText('Card enters column')).toBeInTheDocument();
    expect(screen.getByText('Assign card')).toBeInTheDocument();
  });

  it('toggle switch reflects is_active state', () => {
    const { container } = renderRow({ rule: createRule({ is_active: true }) });
    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('toggle switch shows inactive when is_active is false', () => {
    const { container } = renderRow({ rule: createRule({ is_active: false }) });
    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onToggle when toggle is clicked', () => {
    const onToggle = vi.fn();
    const rule = createRule();
    renderRow({ rule, onToggle });
    fireEvent.click(screen.getByTestId('rule-toggle-rule-1'));
    expect(onToggle).toHaveBeenCalledWith(rule);
  });

  it('toggle is disabled while toggling', () => {
    renderRow({ toggling: true });
    expect(screen.getByTestId('rule-toggle-rule-1')).toBeDisabled();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    const rule = createRule();
    renderRow({ rule, onDelete });
    fireEvent.click(screen.getByTestId('rule-delete-rule-1'));
    expect(onDelete).toHaveBeenCalledWith(rule);
  });

  it('delete button has accessible label with rule name', () => {
    renderRow({ rule: createRule({ name: 'Test Rule' }) });
    expect(screen.getByLabelText('Delete rule Test Rule')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    const rule = createRule();
    renderRow({ rule, onEdit });
    fireEvent.click(screen.getByTestId('rule-edit-rule-1'));
    expect(onEdit).toHaveBeenCalledWith(rule);
  });

  it('edit button has accessible label with rule name', () => {
    renderRow({ rule: createRule({ name: 'Test Rule' }) });
    expect(screen.getByLabelText('Edit rule Test Rule')).toBeInTheDocument();
  });
});
