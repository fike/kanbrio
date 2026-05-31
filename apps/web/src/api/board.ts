export interface ChecklistItem {
  id: string;
  card_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransitionRule {
  id: string;
  workspace_id: string;
  column_id: string;
  rule_type: 'arrival' | 'departure';
  criteria_type: 'assignee_required' | 'checklist_completed' | 'subtasks_completed';
  created_at: string;
  updated_at: string;
}

export interface CardData {
  id: string;
  parent_id: string | null;
  workspace_id: string;
  title: string;
  current_column_id: string;
  current_swimlane_id: string;
  assigned_user_id: string | null;
  is_blocked: boolean;
  blocked_by?: string | null;
  blocked_at?: string | null;
  blocked_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardTransition {
  id: string;
  card_id: string;
  user_id: string | null;
  transition_type: string;
  from_column_id: string | null;
  to_column_id: string | null;
  from_swimlane_id: string | null;
  to_swimlane_id: string | null;
  payload: unknown;
  occurred_at: string;
}

export interface ColumnData {
  id: string;
  workspace_id: string;
  title: string;
  position: number;
  wip_limit: number | null;
  is_done: boolean;
}

export interface SwimlaneData {
  id: string;
  workspace_id: string;
  title: string;
  position: number;
  wip_limit: number | null;
}

export interface BoardState {
  columns: ColumnData[];
  swimlanes: SwimlaneData[];
  cards: CardData[];
  checklists: ChecklistItem[];
  transition_rules: TransitionRule[];
}

const API_BASE_URL = '/api';

export const fetchBoardState = async (workspaceId: string): Promise<BoardState> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/board`);
  if (!response.ok) {
    throw new Error('Failed to fetch board state');
  }
  return response.json();
};

export const moveCard = async (
  workspaceId: string,
  cardId: string,
  toColumnId: string,
  toSwimlaneId: string,
  userId?: string | null,
  overrideRules?: boolean,
  overrideReason?: string
): Promise<CardData> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/cards/${cardId}/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to_column_id: toColumnId,
      to_swimlane_id: toSwimlaneId,
      user_id: userId || null,
      override_rules: overrideRules || false,
      override_reason: overrideReason || null,
    }),
  });

  if (!response.ok) {
    if (response.status === 409) {
      let wipMessage = 'WIP_LIMIT_EXCEEDED';
      try {
        const errData = await response.json();
        if (errData.error) wipMessage = errData.error;
      } catch {
        // use default
      }
      throw new Error(wipMessage);
    }
    if (response.status === 422) {
      let ruleMessage = 'RULE_VIOLATION';
      try {
        const errData = await response.json();
        if (errData.error) {
          if (errData.code === 'CARD_IS_BLOCKED') {
            ruleMessage = 'CARD_IS_BLOCKED';
          } else {
            ruleMessage = `Rule violation: ${errData.error}`;
          }
        }
      } catch {
        // use default
      }
      throw new Error(ruleMessage);
    }
    throw new Error('Failed to move card');
  }

  return response.json();
};

export interface BlockComment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const fetchBlockComments = async (
  workspaceId: string,
  cardId: string
): Promise<BlockComment[]> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/cards/${cardId}/block/comments`);
  if (!response.ok) {
    throw new Error('Failed to fetch block comments');
  }
  return response.json();
};

export const createBlockComment = async (
  workspaceId: string,
  cardId: string,
  content: string
): Promise<BlockComment> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/cards/${cardId}/block/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw new Error('Failed to create block comment');
  }
  return response.json();
};

export const blockCard = async (
  workspaceId: string,
  cardId: string,
  reason: string
): Promise<CardData> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/cards/${cardId}/block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error('Failed to block card');
  }

  return response.json();
};

export const unblockCard = async (
  workspaceId: string,
  cardId: string
): Promise<CardData> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/cards/${cardId}/unblock`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to unblock card');
  }

  return response.json();
};

export const getCardHistory = async (
  workspaceId: string,
  cardId: string
): Promise<CardTransition[]> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/cards/${cardId}/history`);
  if (!response.ok) {
    throw new Error('Failed to fetch card history');
  }
  return response.json();
};

export const createChecklistItem = async (
  workspaceId: string,
  cardId: string,
  title: string,
  position: number
): Promise<ChecklistItem> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/cards/${cardId}/checklists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, position }),
  });

  if (!response.ok) {
    throw new Error('Failed to create checklist item');
  }

  return response.json();
};

export const updateChecklistItem = async (
  workspaceId: string,
  cardId: string,
  checklistId: string,
  updates: {
    title?: string;
    is_completed?: boolean;
    position?: number;
    completed_by?: string | null;
  }
): Promise<ChecklistItem> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/cards/${cardId}/checklists/${checklistId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update checklist item');
  }

  return response.json();
};

export const deleteChecklistItem = async (
  workspaceId: string,
  cardId: string,
  checklistId: string
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/cards/${cardId}/checklists/${checklistId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete checklist item');
  }
};
