const API_BASE_URL = '/api';

export interface BusinessRule {
  id: string;
  workspace_id: string;
  name: string;
  trigger_type: 'child_status_changed' | 'card_entered_column';
  trigger_config: Record<string, unknown>;
  action_type: 'move_parent_card' | 'assign_card';
  action_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRulePayload {
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active?: boolean;
}

export interface UpdateRulePayload {
  name?: string;
  is_active?: boolean;
  trigger_config?: Record<string, unknown>;
  action_config?: Record<string, unknown>;
}

export interface WorkspaceMember {
  id: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
}

export const fetchRules = async (workspaceId: string): Promise<BusinessRule[]> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/rules`, {
    credentials: 'include',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    if (response.status === 403) throw new Error('Forbidden');
    throw new Error('Failed to fetch rules');
  }

  return response.json();
};

export const createRule = async (
  workspaceId: string,
  payload: CreateRulePayload
): Promise<BusinessRule> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    if (response.status === 403) throw new Error('Forbidden');
    if (response.status === 400) {
      const err = await response.json().catch(() => ({ error: 'Bad request' }));
      throw new Error(err.error || 'Bad request');
    }
    throw new Error('Failed to create rule');
  }

  return response.json();
};

export const updateRule = async (
  workspaceId: string,
  ruleId: string,
  payload: UpdateRulePayload
): Promise<BusinessRule> => {
  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/rules/${ruleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!response.ok) {
    if (response.status === 403) throw new Error('Forbidden');
    if (response.status === 400) {
      const err = await response.json().catch(() => ({ error: 'Bad request' }));
      throw new Error(err.error || 'Bad request');
    }
    if (response.status === 404) throw new Error('Not found');
    throw new Error('Failed to update rule');
  }

  return response.json();
};

export const deleteRule = async (
  workspaceId: string,
  ruleId: string
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/rules/${ruleId}`,
    {
      method: 'DELETE',
      credentials: 'include',
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!response.ok) {
    if (response.status === 403) throw new Error('Forbidden');
    if (response.status === 404) throw new Error('Not found');
    throw new Error('Failed to delete rule');
  }
};

export const fetchWorkspaceMembers = async (
  workspaceId: string
): Promise<WorkspaceMember[]> => {
  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/members`,
    {
      credentials: 'include',
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!response.ok) {
    if (response.status === 403) throw new Error('Forbidden');
    throw new Error('Failed to fetch workspace members');
  }

  return response.json();
};
