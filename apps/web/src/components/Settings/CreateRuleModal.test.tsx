import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { CreateRuleModal } from './CreateRuleModal';
import type { BusinessRule } from '../../api/rules';
import * as rulesApi from '../../api/rules';
import * as boardApi from '../../api/board';

vi.mock('../../api/rules', () => ({
  createRule: vi.fn(),
  updateRule: vi.fn(),
  fetchWorkspaceMembers: vi.fn(),
}));

vi.mock('../../api/board', () => ({
  fetchBoardState: vi.fn(),
}));

function renderModal(props: Partial<{ workspaceId: string; onClose: () => void; onCreated: () => void }> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(() => (
    <QueryClientProvider client={queryClient}>
      <CreateRuleModal
        workspaceId={props.workspaceId || 'ws-1'}
        onClose={props.onClose || vi.fn()}
        onCreated={props.onCreated || vi.fn()}
      />
    </QueryClientProvider>
  ));
}

describe('CreateRuleModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(rulesApi.fetchWorkspaceMembers).mockResolvedValue([
      { id: 'u1', name: 'Alice', role: 'admin' },
      { id: 'u2', name: 'Bob', role: 'member' },
    ]);
    vi.mocked(boardApi.fetchBoardState).mockResolvedValue({
      columns: [
        { id: 'col-todo', title: 'To Do', position: 0, wip_limit: null, is_done: false, workspace_id: 'ws-1' },
        { id: 'col-wip', title: 'In Progress', position: 1, wip_limit: null, is_done: false, workspace_id: 'ws-1' },
        { id: 'col-done', title: 'Done', position: 2, wip_limit: null, is_done: true, workspace_id: 'ws-1' },
      ],
      swimlanes: [],
      cards: [],
      checklists: [],
      transition_rules: [],
    });
  });

  it('renders modal with title and form fields', () => {
    renderModal();
    expect(screen.getByTestId('create-rule-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('rule-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('trigger-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('action-type-select')).toBeInTheDocument();
  });

  it('shows trigger column selector when trigger is card_entered_column', async () => {
    renderModal();
    const triggerSelect = screen.getByTestId('trigger-type-select') as HTMLSelectElement;
    fireEvent.change(triggerSelect, { target: { value: 'card_entered_column' } });
    await waitFor(() => {
      expect(screen.getByTestId('trigger-column-select')).toBeInTheDocument();
    });
  });

  it('shows move parent card config when action is move_parent_card', () => {
    renderModal();
    const actionSelect = screen.getByTestId('action-type-select') as HTMLSelectElement;
    expect(actionSelect.value).toBe('move_parent_card');
    expect(screen.getByTestId('done-column-select')).toBeInTheDocument();
    expect(screen.getByTestId('inprogress-column-select')).toBeInTheDocument();
  });

  it('shows assign card config when action is assign_card', () => {
    renderModal();
    const actionSelect = screen.getByTestId('action-type-select');
    fireEvent.change(actionSelect, { target: { value: 'assign_card' } });
    expect(screen.getByTestId('assigned-user-select')).toBeInTheDocument();
    expect(screen.getByTestId('clear-assignee-checkbox')).toBeInTheDocument();
  });

  it('shows validation error when name is empty', async () => {
    renderModal();
    const submit = screen.getByTestId('create-rule-submit');
    fireEvent.click(submit);
    await waitFor(() => {
      expect(screen.getByText('Rule name is required')).toBeInTheDocument();
    });
  });

  it('calls createRule on valid submit', async () => {
    vi.mocked(rulesApi.createRule).mockResolvedValue({
      id: 'new-rule', workspace_id: 'ws-1', name: 'Test', trigger_type: 'child_status_changed',
      trigger_config: {}, action_type: 'move_parent_card', action_config: { done_column_id: 'col-done', in_progress_column_id: 'col-wip' },
      is_active: true, created_at: '', updated_at: '',
    });
    const onCreated = vi.fn();
    renderModal({ onCreated });
    const input = screen.getByTestId('rule-name-input');
    fireEvent.input(input, { target: { value: 'Test Rule' } });
    const submit = screen.getByTestId('create-rule-submit');
    fireEvent.click(submit);
    await waitFor(() => {
      expect(rulesApi.createRule).toHaveBeenCalledWith('ws-1', expect.objectContaining({ name: 'Test Rule' }));
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledOnce();
    });
  });

  it('shows error banner when createRule fails', async () => {
    vi.mocked(rulesApi.createRule).mockRejectedValue(new Error('Duplicate rule name'));
    renderModal();
    const input = screen.getByTestId('rule-name-input');
    fireEvent.input(input, { target: { value: 'Duplicate' } });
    const submit = screen.getByTestId('create-rule-submit');
    fireEvent.click(submit);
    await waitFor(() => {
      expect(screen.getByText('Duplicate rule name')).toBeInTheDocument();
    });
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(screen.getByTestId('create-rule-dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CreateRuleModal workspaceId="ws-1" onClose={onClose} onCreated={vi.fn()} />
      </QueryClientProvider>
    ));
    const backdrop = container.querySelector('.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancels on Cancel button click', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByTestId('create-rule-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('pre-fills fields in edit mode', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const editRule: BusinessRule = {
      id: 'rule-edit-1', workspace_id: 'ws-1', name: 'Edit Me',
      trigger_type: 'card_entered_column', trigger_config: { column_id: 'col-wip' },
      action_type: 'assign_card', action_config: { clear_assignee: true },
      is_active: true, created_at: '', updated_at: '',
    };
    render(() => (
      <QueryClientProvider client={queryClient}>
        <CreateRuleModal workspaceId="ws-1" onClose={vi.fn()} onCreated={vi.fn()} editRule={editRule} />
      </QueryClientProvider>
    ));
    const nameInput = screen.getByTestId('rule-name-input') as HTMLInputElement;
    expect(nameInput.value).toBe('Edit Me');
    expect(screen.getByText('Edit Rule')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByTestId('clear-assignee-checkbox')).toBeChecked();
  });

  it('calls updateRule instead of createRule in edit mode', async () => {
    vi.mocked(rulesApi.updateRule).mockResolvedValue({
      id: 'rule-edit-1', workspace_id: 'ws-1', name: 'Updated',
      trigger_type: 'child_status_changed', trigger_config: {},
      action_type: 'move_parent_card', action_config: {},
      is_active: true, created_at: '', updated_at: '',
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const editRule: BusinessRule = {
      id: 'rule-edit-1', workspace_id: 'ws-1', name: 'Old Name',
      trigger_type: 'child_status_changed', trigger_config: {},
      action_type: 'move_parent_card', action_config: {},
      is_active: true, created_at: '', updated_at: '',
    };
    const onCreated = vi.fn();
    render(() => (
      <QueryClientProvider client={queryClient}>
        <CreateRuleModal workspaceId="ws-1" onClose={vi.fn()} onCreated={onCreated} editRule={editRule} />
      </QueryClientProvider>
    ));
    fireEvent.click(screen.getByTestId('create-rule-submit'));
    await waitFor(() => {
      expect(rulesApi.updateRule).toHaveBeenCalledWith('ws-1', 'rule-edit-1', expect.objectContaining({ name: 'Old Name' }));
      expect(onCreated).toHaveBeenCalledOnce();
    });
  });
});
