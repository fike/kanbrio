import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { RulesPage } from './RulesPage';
import * as rulesApi from '../../api/rules';

vi.mock('../../api/rules', () => ({
  fetchRules: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  fetchWorkspaceMembers: vi.fn(),
}));

function createMockRule(id: string, overrides: Partial<rulesApi.BusinessRule> = {}): rulesApi.BusinessRule {
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(() => (
    <QueryClientProvider client={queryClient}>
      <RulesPage workspaceId="ws-1" />
    </QueryClientProvider>
  ));
}

describe('RulesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders page title and create button', () => {
    vi.mocked(rulesApi.fetchRules).mockResolvedValue([]);
    renderPage();
    expect(screen.getByText('Automation Rules')).toBeInTheDocument();
    expect(screen.getByTestId('create-rule-button')).toBeInTheDocument();
  });

  it('opens create modal when Create Rule is clicked', async () => {
    vi.mocked(rulesApi.fetchRules).mockResolvedValue([]);
    renderPage();
    fireEvent.click(screen.getByTestId('create-rule-button'));
    await waitFor(() => {
      expect(screen.getByTestId('create-rule-dialog')).toBeInTheDocument();
    });
  });

  it('toggles rule active state via mutation', async () => {
    const rules = [createMockRule('r1', { is_active: false })];
    vi.mocked(rulesApi.fetchRules).mockResolvedValue(rules);
    vi.mocked(rulesApi.updateRule).mockResolvedValue({ ...rules[0], is_active: true });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Rule r1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('rule-toggle-r1'));
    await waitFor(() => {
      expect(rulesApi.updateRule).toHaveBeenCalledWith('ws-1', 'r1', { is_active: true });
    });
  });

  it('shows delete confirmation banner on first delete click', async () => {
    const rules = [createMockRule('r1')];
    vi.mocked(rulesApi.fetchRules).mockResolvedValue(rules);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Rule r1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('rule-delete-r1'));
    expect(screen.getByTestId('delete-confirm-banner')).toBeInTheDocument();
  });

  it('deletes rule on confirm delete click', async () => {
    const rules = [createMockRule('r1')];
    vi.mocked(rulesApi.fetchRules).mockResolvedValue(rules);
    vi.mocked(rulesApi.deleteRule).mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Rule r1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('rule-delete-r1'));
    expect(screen.getByTestId('delete-confirm-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete-button'));
    await waitFor(() => {
      expect(rulesApi.deleteRule).toHaveBeenCalledWith('ws-1', 'r1');
    });
  });

  it('cancels delete on Cancel button', async () => {
    const rules = [createMockRule('r1')];
    vi.mocked(rulesApi.fetchRules).mockResolvedValue(rules);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Rule r1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('rule-delete-r1'));
    expect(screen.getByTestId('delete-confirm-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('delete-confirm-banner')).not.toBeInTheDocument();
    });
  });

  it('opens edit modal with pre-filled data when edit button is clicked', async () => {
    const rules = [createMockRule('r1', {
      name: 'My Rule',
      trigger_type: 'card_entered_column',
      action_type: 'assign_card',
    })];
    vi.mocked(rulesApi.fetchRules).mockResolvedValue(rules);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('My Rule')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('rule-edit-r1'));
    await waitFor(() => {
      expect(screen.getByTestId('create-rule-dialog')).toBeInTheDocument();
    });
    const nameInput = screen.getByTestId('rule-name-input') as HTMLInputElement;
    expect(nameInput.value).toBe('My Rule');
    expect(screen.getByText('Edit Rule')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });
});
