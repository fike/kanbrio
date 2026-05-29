/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { WorkspaceSelector } from './WorkspaceSelector';
import { useAuth } from '../AuthProvider';

// Mock useAuth
vi.mock('../AuthProvider', () => ({
  useAuth: vi.fn(),
}));

describe('WorkspaceSelector', () => {
  const mockSwitchWorkspace = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockSwitchWorkspace.mockClear();
  });

  it('should render 0-workspaces empty state when workspaces list is empty', () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: () => ({ id: 'u1', name: 'John' }),
      activeWorkspace: () => null,
      workspaces: () => [],
      switchWorkspace: mockSwitchWorkspace,
    } as any);

    render(() => <WorkspaceSelector />);

    expect(screen.getByTestId('workspace-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('create-workspace-button')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-selector-trigger')).not.toBeInTheDocument();
  });

  it('should render trigger button and default states correctly', () => {
    const mockActive = { id: 'w1', name: 'Acme Corp', role: 'Admin' as const };
    vi.mocked(useAuth).mockReturnValue({
      currentUser: () => ({ id: 'u1', name: 'John' }),
      activeWorkspace: () => mockActive,
      workspaces: () => [mockActive],
      switchWorkspace: mockSwitchWorkspace,
    } as any);

    render(() => <WorkspaceSelector />);

    const trigger = screen.getByTestId('workspace-selector-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('role', 'button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('should open dropdown, auto-focus search box, filter workspaces and select option', async () => {
    const w1 = { id: 'w1', name: 'Acme Corp', role: 'Admin' as const };
    const w2 = { id: 'w2', name: 'Beta Projects', role: 'Member' as const };

    vi.mocked(useAuth).mockReturnValue({
      currentUser: () => ({ id: 'u1', name: 'John' }),
      activeWorkspace: () => w1,
      workspaces: () => [w1, w2],
      switchWorkspace: mockSwitchWorkspace,
    } as any);

    render(() => <WorkspaceSelector />);

    const trigger = screen.getByTestId('workspace-selector-trigger');
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dropdown = screen.getByTestId('workspace-selector-dropdown');
    expect(dropdown).toBeInTheDocument();

    const searchInput = screen.getByTestId('workspace-search-input');
    expect(searchInput).toBeInTheDocument();
    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
    });

    // Verify option elements and role badges
    const option1 = screen.getByTestId('workspace-option-w1');
    const option2 = screen.getByTestId('workspace-option-w2');
    expect(option1).toBeInTheDocument();
    expect(option2).toBeInTheDocument();
    expect(screen.getByTestId('role-badge-Admin')).toBeInTheDocument();
    expect(screen.getByTestId('role-badge-Member')).toBeInTheDocument();

    // Verify selected indicator
    expect(option1).toHaveAttribute('aria-selected', 'true');
    expect(option2).toHaveAttribute('aria-selected', 'false');

    // Filter workspaces
    fireEvent.input(searchInput, { target: { value: 'Beta' } });
    expect(screen.queryByTestId('workspace-option-w1')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-option-w2')).toBeInTheDocument();

    // Click option to switch workspace
    fireEvent.click(screen.getByTestId('workspace-option-w2'));
    expect(mockSwitchWorkspace).toHaveBeenCalledWith('w2');

    // Dropdown should be closed after selection
    await waitFor(() => {
      expect(screen.queryByTestId('workspace-selector-dropdown')).not.toBeInTheDocument();
    });
  });

  it('should support keyboard navigation: Escape key closes and focus is returned to trigger', async () => {
    const w1 = { id: 'w1', name: 'Acme Corp', role: 'Admin' as const };
    vi.mocked(useAuth).mockReturnValue({
      currentUser: () => ({ id: 'u1', name: 'John' }),
      activeWorkspace: () => w1,
      workspaces: () => [w1],
      switchWorkspace: mockSwitchWorkspace,
    } as any);

    render(() => <WorkspaceSelector />);

    const trigger = screen.getByTestId('workspace-selector-trigger');
    fireEvent.click(trigger);

    const searchInput = screen.getByTestId('workspace-search-input');
    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
    });

    fireEvent.keyDown(searchInput, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('workspace-selector-dropdown')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(trigger);
    });
  });
});
