export interface CardData {
  id: string;
  parent_id: string | null;
  workspace_id: string;
  title: string;
  current_column_id: string;
  current_swimlane_id: string;
  created_at: string;
  updated_at: string;
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
