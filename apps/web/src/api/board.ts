export interface CardData {
  id: string;
  parent_id: string | null;
  workspace_id: string;
  title: string;
  current_column_id: string;
  current_swimlane_id: string;
  is_blocked: boolean;
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
}

export interface SwimlaneData {
  id: string;
  workspace_id: string;
  title: string;
  position: number;
}

export interface BoardState {
  columns: ColumnData[];
  swimlanes: SwimlaneData[];
  cards: CardData[];
}

const API_BASE_URL = 'http://localhost:3000/api';

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
  toSwimlaneId: string
): Promise<CardData> => {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/cards/${cardId}/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to_column_id: toColumnId,
      to_swimlane_id: toSwimlaneId,
    }),
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('WIP_LIMIT_EXCEEDED');
    }
    throw new Error('Failed to move card');
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
