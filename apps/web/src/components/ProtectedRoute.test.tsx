/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from './AuthProvider';

// Mock useAuth
vi.mock('./AuthProvider', () => ({
  useAuth: vi.fn(),
}));

// Mock useNavigate and useParams from @solidjs/router
const mockNavigate = vi.fn();
let mockParams: Record<string, string> = {};

vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    mockParams = {};
  });

  it('should render loading state when auth provider is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: () => null,
      activeWorkspace: () => null,
      workspaces: () => [],
      loading: () => true,
    } as any);

    render(() => (
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    ));

    expect(screen.getByTestId('workspace-switching-shimmer')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should redirect to /login if user is not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: () => null,
      activeWorkspace: () => null,
      workspaces: () => [],
      loading: () => false,
    } as any);

    render(() => (
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    ));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should restrict access and redirect to fallback if user is not a member of the path workspace', async () => {
    mockParams = { workspace_id: 'w_restricted' };

    vi.mocked(useAuth).mockReturnValue({
      currentUser: () => ({ id: 'u1', name: 'John' }),
      activeWorkspace: () => ({ id: 'w1', name: 'W1' }),
      workspaces: () => [{ id: 'w1', name: 'W1', role: 'Member' }],
      loading: () => false,
    } as any);

    render(() => (
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    ));

    await waitFor(() => {
      // Should redirect to user's first available workspace or home/login
      expect(mockNavigate).toHaveBeenCalledWith('/w/w1');
    });
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render protected content if authenticated and user is a member of the workspace', async () => {
    mockParams = { workspace_id: 'w1' };

    vi.mocked(useAuth).mockReturnValue({
      currentUser: () => ({ id: 'u1', name: 'John' }),
      activeWorkspace: () => ({ id: 'w1', name: 'W1' }),
      workspaces: () => [{ id: 'w1', name: 'W1', role: 'Member' }],
      loading: () => false,
    } as any);

    render(() => (
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
