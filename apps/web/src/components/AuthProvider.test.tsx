import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { AuthProvider, useAuth } from './AuthProvider';
import * as authApi from '../api/auth';

// Mock the API adapter
vi.mock('../api/auth', () => ({
  getMe: vi.fn(),
  getWorkspaces: vi.fn(),
  logout: vi.fn(),
}));

// Mock useNavigate from @solidjs/router
const mockNavigate = vi.fn();
vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
}));

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
  });

  const TestConsumer = () => {
    const auth = useAuth();
    return (
      <div>
        <div data-testid="user-name">{auth.currentUser()?.name || 'Guest'}</div>
        <div data-testid="workspace-name">{auth.activeWorkspace()?.name || 'None'}</div>
        <div data-testid="loading-state">{auth.loading() ? 'Loading' : 'Idle'}</div>
        <button data-testid="btn-logout" onClick={auth.logout}>Logout</button>
        <button data-testid="btn-switch" onClick={() => auth.switchWorkspace('w2')}>Switch to W2</button>
        <button data-testid="btn-switch-fail" onClick={() => auth.switchWorkspace('w3')}>Switch to W3 Fail</button>
      </div>
    );
  };

  it('should load initial user profile and workspaces on mount', async () => {
    const mockUser = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
    const mockWorkspaces = [
      { id: 'w1', name: 'Acme Corp', role: 'Admin' as const },
      { id: 'w2', name: 'Beta Projects', role: 'Member' as const },
    ];

    vi.mocked(authApi.getMe).mockResolvedValue(mockUser);
    vi.mocked(authApi.getWorkspaces).mockResolvedValue(mockWorkspaces);

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ));

    // Initially should be in loading state
    expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading');

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
      expect(screen.getByTestId('workspace-name')).toHaveTextContent('Acme Corp');
      expect(screen.getByTestId('loading-state')).toHaveTextContent('Idle');
    });

    expect(authApi.getMe).toHaveBeenCalled();
    expect(authApi.getWorkspaces).toHaveBeenCalled();
  });

  it('should handle unauthenticated user on mount', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('Unauthorized'));
    vi.mocked(authApi.getWorkspaces).mockResolvedValue([]);

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Guest');
      expect(screen.getByTestId('workspace-name')).toHaveTextContent('None');
      expect(screen.getByTestId('loading-state')).toHaveTextContent('Idle');
    });
  });

  it('should remain authenticated and retain user profile even if getWorkspaces fails', async () => {
    const mockUser = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(authApi.getMe).mockResolvedValue(mockUser);
    vi.mocked(authApi.getWorkspaces).mockRejectedValue(new Error('Workspaces load failed'));

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
      expect(screen.getByTestId('workspace-name')).toHaveTextContent('None');
      expect(screen.getByTestId('loading-state')).toHaveTextContent('Idle');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Workspaces load failed', expect.any(Error));
  });

  it('should call console.error on initial auth failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('Unauthorized'));
    vi.mocked(authApi.getWorkspaces).mockResolvedValue([]);

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('Idle');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Auth initialization failed', expect.any(Error));
  });

  it('should switch active workspace successfully and route user', async () => {
    const mockUser = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
    const mockWorkspaces = [
      { id: 'w1', name: 'Acme Corp', role: 'Admin' as const },
      { id: 'w2', name: 'Beta Projects', role: 'Member' as const },
    ];

    vi.mocked(authApi.getMe).mockResolvedValue(mockUser);
    vi.mocked(authApi.getWorkspaces).mockResolvedValue(mockWorkspaces);

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('workspace-name')).toHaveTextContent('Acme Corp');
    });

    // Perform switch workspace
    const switchBtn = screen.getByTestId('btn-switch');
    fireEvent.click(switchBtn);

    // Should show switching shimmer and backdrop navigation guard during switching
    expect(screen.getByTestId('workspace-switching-shimmer')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('workspace-name')).toHaveTextContent('Beta Projects');
      expect(mockNavigate).toHaveBeenCalledWith('/w/w2');
    });
  });

  it('should show error toast and revert workspace state on switch failure', async () => {
    const mockUser = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
    const mockWorkspaces = [
      { id: 'w1', name: 'Acme Corp', role: 'Admin' as const },
      { id: 'w2', name: 'Beta Projects', role: 'Member' as const },
    ];

    vi.mocked(authApi.getMe).mockResolvedValue(mockUser);
    vi.mocked(authApi.getWorkspaces).mockResolvedValue(mockWorkspaces);

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('workspace-name')).toHaveTextContent('Acme Corp');
    });

    // We switch to an invalid/restricted workspace w3 which fails
    const switchFailBtn = screen.getByTestId('btn-switch-fail');
    fireEvent.click(switchFailBtn);

    await waitFor(() => {
      expect(screen.getByTestId('workspace-switch-error-toast')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-switch-error-toast')).toHaveTextContent('Failed to switch workspace: access denied.');
      // Should remain Acme Corp
      expect(screen.getByTestId('workspace-name')).toHaveTextContent('Acme Corp');
    });
  });

  it('should reset user context on logout', async () => {
    const mockUser = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
    const mockWorkspaces = [
      { id: 'w1', name: 'Acme Corp', role: 'Admin' as const },
    ];

    vi.mocked(authApi.getMe).mockResolvedValue(mockUser);
    vi.mocked(authApi.getWorkspaces).mockResolvedValue(mockWorkspaces);
    vi.mocked(authApi.logout).mockResolvedValue(undefined);

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
    });

    const logoutBtn = screen.getByTestId('btn-logout');
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(authApi.logout).toHaveBeenCalled();
      expect(screen.getByTestId('user-name')).toHaveTextContent('Guest');
      expect(screen.getByTestId('workspace-name')).toHaveTextContent('None');
    });
  });
});
