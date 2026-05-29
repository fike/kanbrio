import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { Router } from '@solidjs/router';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import App, { AppRoutes } from './App';
import * as authApi from './api/auth';

// Mock the API calls
vi.mock('./api/auth', () => ({
  getMe: vi.fn(),
  getWorkspaces: vi.fn(),
  logout: vi.fn(),
}));

describe('App Routing Integration', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should redirect wildcard path to home (IntelligentRedirect) when authenticated', async () => {
    const mockUser = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
    const mockWorkspaces = [{ id: 'w1', name: 'Acme Corp', role: 'Admin' as const }];

    vi.mocked(authApi.getMe).mockResolvedValue(mockUser);
    vi.mocked(authApi.getWorkspaces).mockResolvedValue(mockWorkspaces);

    render(() => (
      <QueryClientProvider client={queryClient}>
        <Router root={App} url="/some-random-unknown-route">
          <AppRoutes />
        </Router>
      </QueryClientProvider>
    ));

    await waitFor(() => {
      expect(screen.getByText('Kanbrio')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  it('should redirect wildcard path to login when not authenticated', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('Unauthorized'));
    vi.mocked(authApi.getWorkspaces).mockResolvedValue([]);

    render(() => (
      <QueryClientProvider client={queryClient}>
        <Router root={App} url="/another-random-path">
          <AppRoutes />
        </Router>
      </QueryClientProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId('login-view')).toBeInTheDocument();
      expect(screen.getByText('Sign in to your Kanbrio account')).toBeInTheDocument();
    });
  });
});
