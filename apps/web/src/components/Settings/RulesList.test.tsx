import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { RulesList } from './RulesList';
import type { BusinessRule } from '../../api/rules';

function createRule(id: string, overrides: Partial<BusinessRule> = {}): BusinessRule {
  return {
    id,
    workspace_id: 'ws-1',
    name: `Rule ${id}`,
    trigger_type: 'child_status_changed',
    trigger_config: {},
    action_type: 'move_parent_card',
    action_config: {},
    is_active: true,
    created_at: '2026-07-12T00:00:00Z',
    updated_at: '2026-07-12T00:00:00Z',
    ...overrides,
  };
}

const NOOP = { onToggle: vi.fn(), onDelete: vi.fn(), onEdit: vi.fn(), onCreateClick: vi.fn() };

describe('RulesList', () => {
  it('renders shimmer skeleton while loading', () => {
    const { container } = render(() => (
      <RulesList rules={undefined} loading={true} error={null} togglingId={null} {...NOOP} />
    ));
    const shimmers = container.querySelectorAll('.animate-pulse');
    expect(shimmers.length).toBe(3);
  });

  it('renders error state', () => {
    render(() => (
      <RulesList rules={undefined} loading={false} error={new Error('Failed')} togglingId={null} {...NOOP} />
    ));
    expect(screen.getByText('Failed to load rules. Please try again.')).toBeInTheDocument();
  });

  it('renders empty state with create button', () => {
    render(() => (
      <RulesList rules={[]} loading={false} error={null} togglingId={null} {...NOOP} />
    ));
    expect(screen.getByText('No automation rules')).toBeInTheDocument();
    expect(screen.getByTestId('create-first-rule-button')).toBeInTheDocument();
  });

  it('calls onCreateClick from empty state button', () => {
    const onCreateClick = vi.fn();
    render(() => (
      <RulesList rules={[]} loading={false} error={null} togglingId={null} {...NOOP} onCreateClick={onCreateClick} />
    ));
    fireEvent.click(screen.getByTestId('create-first-rule-button'));
    expect(onCreateClick).toHaveBeenCalledOnce();
  });

  it('renders list of rules', () => {
    const rules = [createRule('r1', { name: 'Rule One' }), createRule('r2', { name: 'Rule Two' })];
    render(() => (
      <RulesList rules={rules} loading={false} error={null} togglingId={null} {...NOOP} />
    ));
    expect(screen.getByText('Rule One')).toBeInTheDocument();
    expect(screen.getByText('Rule Two')).toBeInTheDocument();
  });

  it('passes togglingId to disable toggle on specific rule', () => {
    const rules = [createRule('r1'), createRule('r2')];
    render(() => (
      <RulesList rules={rules} loading={false} error={null} togglingId="r1" {...NOOP} />
    ));
    expect(screen.getByTestId('rule-toggle-r1')).toBeDisabled();
    expect(screen.getByTestId('rule-toggle-r2')).not.toBeDisabled();
  });

  it('passes toggle callback to RuleRow', () => {
    const onToggle = vi.fn();
    render(() => (
      <RulesList rules={[createRule('r1')]} loading={false} error={null} togglingId={null} {...NOOP} onToggle={onToggle} />
    ));
    fireEvent.click(screen.getByTestId('rule-toggle-r1'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('passes edit callback to RuleRow', () => {
    const onEdit = vi.fn();
    render(() => (
      <RulesList rules={[createRule('r1')]} loading={false} error={null} togglingId={null} {...NOOP} onEdit={onEdit} />
    ));
    fireEvent.click(screen.getByTestId('rule-edit-r1'));
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
