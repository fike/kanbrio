/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { Register } from './Register';
import { useAuth } from '../AuthProvider';
import * as authApi from '../../api/auth';

// Mock useAuth
vi.mock('../AuthProvider', () => ({
  useAuth: vi.fn(),
}));

// Mock API adapters
vi.mock('../../api/auth', () => ({
  register: vi.fn(),
  getWorkspaces: vi.fn(),
}));

// Mock @solidjs/router
const mockNavigate = vi.fn();
vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
  A: (props: any) => <a href={props.href} data-testid={props['data-testid']}>{props.children}</a>,
}));

describe('Register Component', () => {
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

  it('should render all required visual elements and inputs', () => {
    render(() => <Register />);

    expect(screen.getByTestId('register-view')).toBeInTheDocument();
    expect(screen.getByTestId('register-credentials-form')).toBeInTheDocument();
    expect(screen.getByTestId('register-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('register-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('register-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('register-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('login-link')).toBeInTheDocument();
  });

  it('should have standard autocomplete DOM attributes on input elements', () => {
    render(() => <Register />);

    expect(screen.getByTestId('register-name-input')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByTestId('register-email-input')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByTestId('register-password-input')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('should display client-side validation error for weak passwords', async () => {
    render(() => <Register />);

    const nameInput = screen.getByTestId('register-name-input');
    const emailInput = screen.getByTestId('register-email-input');
    const passwordInput = screen.getByTestId('register-password-input');
    const submitBtn = screen.getByTestId('register-submit-button');

    fireEvent.input(nameInput, { target: { value: 'John Doe' } });
    fireEvent.input(emailInput, { target: { value: 'john@example.com' } });

    // Test password too short (e.g. "short")
    fireEvent.input(passwordInput, { target: { value: 'short' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters long and contain at least one letter and one number')).toBeInTheDocument();
    });

    // Test password with no numbers (e.g. "noNumbers")
    fireEvent.input(passwordInput, { target: { value: 'noNumbers' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters long and contain at least one letter and one number')).toBeInTheDocument();
    });
  });

  it('should display client-side validation errors when submitting empty fields', async () => {
    render(() => <Register />);

    const submitBtn = screen.getByTestId('register-submit-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId('register-name-input');
    expect(nameInput).toHaveClass('border-status-blocked');
  });

  it('should show form-level error banner when registration API fails', async () => {
    vi.mocked(authApi.register).mockRejectedValueOnce(new Error('Email already in use'));

    render(() => <Register />);

    const nameInput = screen.getByTestId('register-name-input');
    const emailInput = screen.getByTestId('register-email-input');
    const passwordInput = screen.getByTestId('register-password-input');
    const submitBtn = screen.getByTestId('register-submit-button');

    fireEvent.input(nameInput, { target: { value: 'John Doe' } });
    fireEvent.input(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('register-error-message')).toBeInTheDocument();
      expect(screen.getByTestId('register-error-message')).toHaveTextContent('Email already in use');
    });
  });

  it('should display loading spinner and disable fields during form submission', async () => {
    let resolveRegister: any;
    const registerPromise = new Promise((resolve) => {
      resolveRegister = resolve;
    });
    vi.mocked(authApi.register).mockReturnValueOnce(registerPromise as any);

    render(() => <Register />);

    const nameInput = screen.getByTestId('register-name-input');
    const emailInput = screen.getByTestId('register-email-input');
    const passwordInput = screen.getByTestId('register-password-input');
    const submitBtn = screen.getByTestId('register-submit-button');

    fireEvent.input(nameInput, { target: { value: 'John Doe' } });
    fireEvent.input(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.input(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
      expect(nameInput).toBeDisabled();
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitBtn).toHaveTextContent('Signing up...');
      expect(screen.getByTestId('register-submit-button').querySelector('.animate-spin')).toBeInTheDocument();
    });

    resolveRegister({ id: 'u1', name: 'John Doe', email: 'john@example.com' });
  });

  it('should successfully register and redirect to home', async () => {
    const mockUser = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
    const mockWorkspaces = [{ id: 'w1', name: 'My Workspace', role: 'Admin' as const }];

    vi.mocked(authApi.register).mockResolvedValueOnce(mockUser);
    vi.mocked(authApi.getWorkspaces).mockResolvedValueOnce(mockWorkspaces);

    render(() => <Register />);

    const nameInput = screen.getByTestId('register-name-input');
    const emailInput = screen.getByTestId('register-email-input');
    const passwordInput = screen.getByTestId('register-password-input');
    const submitBtn = screen.getByTestId('register-submit-button');

    fireEvent.input(nameInput, { target: { value: 'John Doe' } });
    fireEvent.input(emailInput, { target: { value: 'john@example.com' } });
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
