const API_BASE_URL = '/api';

export interface CycleTimePoint {
  card_id: string;
  title: string;
  completed_at: string;
  cycle_time_hours: number;
  assignee_id: string | null;
  assignee_name: string | null;
  swimlane: string | null;
}

export interface Percentiles {
  p50: number;
  p85: number;
  p95: number;
}

export interface CycleTimeResponse {
  data_points: CycleTimePoint[];
  percentiles: Percentiles;
}

export interface ColumnWaitBreakdown {
  column_id: string;
  title: string;
  wait_hours: number;
  card_count: number;
}

export interface FlowEfficiencyResponse {
  efficiency_pct: number;
  active_hours: number;
  wait_hours: number;
  total_cards: number;
  by_column: ColumnWaitBreakdown[];
}

export interface AgingWipCard {
  card_id: string;
  title: string;
  column_title: string;
  assignee_name: string | null;
  idle_hours: number;
  idle_days: number;
  entered_column_at: string;
}

export interface AgingWipResponse {
  stagnant_cards: AgingWipCard[];
  stagnant_count: number;
  threshold_days: number;
  total_cards_in_active_columns: number;
}

export const fetchCycleTimes = async (
  workspaceId: string,
  days = 90
): Promise<CycleTimeResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/analytics/cycle-times?days=${days}`,
    { credentials: 'include', signal: AbortSignal.timeout(5000) }
  );
  if (!response.ok) throw new Error('Failed to fetch cycle times');
  return response.json();
};

export const fetchFlowEfficiency = async (
  workspaceId: string
): Promise<FlowEfficiencyResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/analytics/flow-efficiency`,
    { credentials: 'include', signal: AbortSignal.timeout(5000) }
  );
  if (!response.ok) throw new Error('Failed to fetch flow efficiency');
  return response.json();
};

export const fetchAgingWip = async (
  workspaceId: string,
  thresholdDays = 3
): Promise<AgingWipResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/analytics/aging-wip?threshold_days=${thresholdDays}`,
    { credentials: 'include', signal: AbortSignal.timeout(5000) }
  );
  if (!response.ok) throw new Error('Failed to fetch aging WIP');
  return response.json();
};

// --- CFD types ---

export interface CFDColumn {
  id: string;
  title: string;
  color: string;
}

export interface CFDPoint {
  date: string;
  counts: Record<string, number>;
}

export interface CFDResponse {
  columns: CFDColumn[];
  data_points: CFDPoint[];
}

// --- Monte Carlo types ---

export interface MonteCarloBin {
  days: number;
  probability: number;
}

export interface MonteCarloPercentiles {
  p50: number;
  p75: number;
  p85: number;
  p95: number;
}

export interface MonteCarloSimulations {
  histogram: MonteCarloBin[];
  percentiles: MonteCarloPercentiles;
  total_cards: number;
}

export interface MonteCarloResponse {
  throughput_data: number[];
  simulations: MonteCarloSimulations;
}

export const fetchCFD = async (
  workspaceId: string,
  from?: string,
  to?: string
): Promise<CFDResponse> => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/analytics/cfd?${params}`,
    { credentials: 'include', signal: AbortSignal.timeout(5000) }
  );
  if (!response.ok) throw new Error('Failed to fetch CFD data');
  return response.json();
};

export const fetchMonteCarlo = async (
  workspaceId: string,
  days = 90,
  simulations = 1000
): Promise<MonteCarloResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/analytics/monte-carlo?days=${days}&simulations=${simulations}`,
    { credentials: 'include', signal: AbortSignal.timeout(5000) }
  );
  if (!response.ok) throw new Error('Failed to fetch Monte Carlo data');
  return response.json();
};
