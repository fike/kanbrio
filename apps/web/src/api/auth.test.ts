import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMe, getWorkspaces, login, register, logout } from './auth';

describe('Auth API Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMe', () => {
    it('should successfully fetch the current user profile', async () => {
      const mockUser = { id: 'u1', name: 'John Doe', email: 'john@example.com', avatar_url: 'https://avatar.com/john' };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as Response);

      const result = await getMe();

      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/me', {
        credentials: 'include',
        signal: expect.any(AbortSignal),
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw an error if fetching profile fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(getMe()).rejects.toThrow('Failed to fetch user profile');
    });
  });

  describe('getWorkspaces', () => {
    it('should successfully fetch the user workspaces list', async () => {
      const mockWorkspaces = [
        { id: 'w1', name: 'Acme Corp', role: 'Admin' },
        { id: 'w2', name: 'Beta Projects', role: 'Member' },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkspaces,
      } as Response);

      const result = await getWorkspaces();

      expect(fetchSpy).toHaveBeenCalledWith('/api/workspaces', {
        credentials: 'include',
        signal: expect.any(AbortSignal),
      });
      expect(result).toEqual(mockWorkspaces);
    });

    it('should throw an error if workspaces fetch fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(getWorkspaces()).rejects.toThrow('Failed to fetch workspaces');
    });
  });

  describe('login', () => {
    it('should submit credentials and return user profile with CSRF and timeout', async () => {
      const mockUser = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
      const credentials = { email: 'john@example.com', password: 'password123' }; // pragma: allowlist secret

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as Response);

      const result = await login(credentials);

      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(credentials),
        credentials: 'include',
        signal: expect.any(AbortSignal),
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw an error with API message if login fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid credentials' }),
      } as Response);

      await expect(login({ email: 'john@example.com', password: 'wrong' })).rejects.toThrow('Invalid credentials'); // pragma: allowlist secret
    });
  });

  describe('register', () => {
    it('should submit registration info and return user profile with CSRF and timeout', async () => {
      const mockUser = { id: 'u1', name: 'John Doe', email: 'john@example.com' };
      const data = { name: 'John Doe', email: 'john@example.com', password: 'password123' }; // pragma: allowlist secret

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as Response);

      const result = await register(data);

      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(data),
        credentials: 'include',
        signal: expect.any(AbortSignal),
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw an error with API message if registration fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Email already in use' }),
      } as Response);

      await expect(register({ name: 'John', email: 'john@example.com', password: 'pass' })).rejects.toThrow('Email already in use'); // pragma: allowlist secret
    });
  });

  describe('logout', () => {
    it('should post to logout endpoint successfully with CSRF and timeout', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
      } as Response);

      await logout();

      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        signal: expect.any(AbortSignal),
      });
    });

    it('should throw an error if logout fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(logout()).rejects.toThrow('Failed to logout');
    });
  });
});
