/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { Login } from './Login';
import { useAuth } from '../AuthProvider';
import * as authApi from '../../api/auth';

// Mock useAuth
vi.mock('../AuthProvider', () => ({
  useAuth: vi.fn(),
}));

// Mock API adapters
vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  getWorkspaces: vi.fn(),
}));

// Mock @solidjs/router
const mockNavigate = vi.fn();
vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
  A: (props: any) => <a href={props.href} data-testid={props['data-testid']}>{props.children}</a>,
}));

describe('Login Component', () => {
  const mockSetCurrentUser = vi.fn();
  const mockSetWorkspaces = vi.fn();
  const mockSetActiveWorkspace = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    mockSetCurrentUser.mockClear();
    mockSetWorkspaces.mockClear();
    mockSetActiveWorkspace.mockClear();

    vi.mocked(useAuth).mockReturnValue({
      setCurrentUser: mockSetCurrentUser,
      setWorkspaces: mockSetWorkspaces,
      setActiveWorkspace: mockSetActiveWorkspace,
    } as any);
  });

  it('should render all required visual elements and social OAuth buttons', () => {
    render(() => <Login />);

    expect(screen.getByTestId('login-view')).toBeInTheDocument();
    expect(screen.getByTestId('oauth-google-button')).toBeInTheDocument();
    expect(screen.getByTestId('oauth-github-button')).toBeInTheDocument();
    expect(screen.getByTestId('login-credentials-form')).toBeInTheDocument();
    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('register-link')).toBeInTheDocument();

    // Check OAuth links point to the correct endpoints
    expect(screen.getByTestId('oauth-google-button')).toHaveAttribute('href', '/api/auth/login/google');
    expect(screen.getByTestId('oauth-github-button')).toHaveAttribute('href', '/api/auth/login/github');
  });

  it('should have standard autocomplete DOM attributes on input elements', () => {
    render(() => <Login />);

    expect(screen.getByTestId('login-email-input')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByTestId('login-password-input')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('should display client-side validation errors when submitting empty fields', async () => {
    render(() => <Login />);

    const submitBtn = screen.getByTestId('login-submit-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    // Check custom border/text error classes and role alert
    const emailInput = screen.getByTestId('login-email-input');
    expect(emailInput).toHaveClass('border-status-blocked');
  });

  it('should show form-level error banner when login API fails', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Invalid email or password'));

    render(() => <Login />);

    const emailInput = screen.getByTestId('login-email-input');
    const passwordInput = screen.getByTestId('login-password-input');
    const submitBtn = screen.getByTestId('login-submit-button');

    fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('login-error-message')).toBeInTheDocument();
      expect(screen.getByTestId('login-error-message')).toHaveTextContent('Invalid email or password');
    });
  });

  it('should display loading spinner and disable fields during form submission', async () => {
    let resolveLogin: any;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    vi.mocked(authApi.login).mockReturnValueOnce(loginPromise as any);

    render(() => <Login />);

    const emailInput = screen.getByTestId('login-email-input');
    const passwordInput = screen.getByTestId('login-password-input');
    const submitBtn = screen.getByTestId('login-submit-button');

    fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitBtn).toHaveTextContent('Signing in...');
      expect(screen.getByTestId('login-submit-button').querySelector('.animate-spin')).toBeInTheDocument();
    });

    // Finish request
    resolveLogin({ id: 'u1', name: 'John Doe', email: 'test@example.com' });
  });

  it('should successfully login and redirect to default workspace', async () => {
    const mockUser = { id: 'u1', name: 'John Doe', email: 'test@example.com' };
    const mockWorkspaces = [{ id: 'w1', name: 'My Workspace', role: 'Admin' as const }];

    vi.mocked(authApi.login).mockResolvedValueOnce(mockUser);
    vi.mocked(authApi.getWorkspaces).mockResolvedValueOnce(mockWorkspaces);

    render(() => <Login />);

    const emailInput = screen.getByTestId('login-email-input');
    const passwordInput = screen.getByTestId('login-password-input');
    const submitBtn = screen.getByTestId('login-submit-button');

    fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSetCurrentUser).toHaveBeenCalledWith(mockUser);
      expect(mockSetWorkspaces).toHaveBeenCalledWith(mockWorkspaces);
      expect(mockSetActiveWorkspace).toHaveBeenCalledWith(mockWorkspaces[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/w/w1');
    });
  });
});
