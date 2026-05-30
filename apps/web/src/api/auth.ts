export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface Workspace {
  id: string;
  name: string;
  role: 'Admin' | 'Member' | 'Viewer';
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password?: string;
}

const API_BASE_URL = '/api';

export const getMe = async (): Promise<User> => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }
  return response.json();
};

export const getWorkspaces = async (): Promise<Workspace[]> => {
  const response = await fetch(`${API_BASE_URL}/workspaces`, {
    credentials: 'include',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch workspaces');
  }
  return response.json();
};

export const login = async (credentials: LoginCredentials): Promise<User> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(credentials),
    credentials: 'include',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to login';
    try {
      const errData = await response.json();
      errorMessage = errData.error || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json();
};

export const register = async (data: RegisterData): Promise<User> => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(data),
    credentials: 'include',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to register';
    try {
      const errData = await response.json();
      errorMessage = errData.error || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json();
};

export const logout = async (): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
    credentials: 'include',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error('Failed to logout');
  }
};

export interface CreatedWorkspace {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export const createWorkspace = async (name: string): Promise<CreatedWorkspace> => {
  const response = await fetch(`${API_BASE_URL}/workspaces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ name }),
    credentials: 'include',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to create workspace';
    try {
      const errData = await response.json();
      errorMessage = errData.error || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json();
};
