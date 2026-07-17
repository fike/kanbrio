import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { AnalyticsPage } from './AnalyticsPage';
import * as analyticsApi from '../../api/analytics';

vi.mock('../../api/analytics', () => ({
  fetchCycleTimes: vi.fn(),
  fetchFlowEfficiency: vi.fn(),
  fetchAgingWip: vi.fn(),
  fetchCFD: vi.fn(),
  fetchMonteCarlo: vi.fn(),
}));

const mockEmptyCycleTimes = { data_points: [], percentiles: { p50: 0, p85: 0, p95: 0 } };
const mockEmptyAgingWip = { stagnant_cards: [], stagnant_count: 0, threshold_days: 3, total_cards_in_active_columns: 0 };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(() => (
    <QueryClientProvider client={queryClient}>
      <AnalyticsPage workspaceId="ws-1" />
    </QueryClientProvider>
  ));
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(analyticsApi.fetchCFD).mockResolvedValue({ columns: [], data_points: [] });
    vi.mocked(analyticsApi.fetchCycleTimes).mockResolvedValue(mockEmptyCycleTimes);
    vi.mocked(analyticsApi.fetchFlowEfficiency).mockResolvedValue({ efficiency_pct: 0, active_hours: 0, wait_hours: 0, total_cards: 0, by_column: [] });
    vi.mocked(analyticsApi.fetchAgingWip).mockResolvedValue(mockEmptyAgingWip);
    vi.mocked(analyticsApi.fetchMonteCarlo).mockResolvedValue({ throughput_data: [], simulations: { histogram: [], percentiles: { p50: 0, p75: 0, p85: 0, p95: 0 }, total_cards: 0 } });
  });

  it('renders page title and tab list', () => {
    renderPage();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Cumulative Flow')).toBeInTheDocument();
    expect(screen.getByText('Cycle Time')).toBeInTheDocument();
    expect(screen.getByText('Flow Efficiency')).toBeInTheDocument();
    expect(screen.getByText('Aging WIP')).toBeInTheDocument();
    expect(screen.getByText('Monte Carlo')).toBeInTheDocument();
  });

  it('shows CFD tab by default', () => {
    renderPage();
    expect(screen.getByText('Cumulative Flow Diagram')).toBeInTheDocument();
  });

  it('switches tabs on click', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('tab-cycle-time'));
    await waitFor(() => {
      expect(screen.getByText('Cycle Time Scatter')).toBeInTheDocument();
    });
  });

  it('switches to Monte Carlo tab', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('tab-monte-carlo'));
    await waitFor(() => {
      expect(screen.getByText('Monte Carlo Simulation')).toBeInTheDocument();
    });
  });

  it('switches to Aging WIP tab', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('tab-aging-wip'));
    await waitFor(() => {
      const headings = screen.getAllByText('Aging WIP');
      expect(headings.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('switches to Flow Efficiency tab', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('tab-flow-efficiency'));
    await waitFor(() => {
      const headings = screen.getAllByText('Flow Efficiency');
      expect(headings.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders CFD date range buttons', () => {
    renderPage();
    expect(screen.getByTestId('date-7d')).toBeInTheDocument();
    expect(screen.getByTestId('date-30d')).toBeInTheDocument();
    expect(screen.getByTestId('date-90d')).toBeInTheDocument();
  });

  it('renders Monte Carlo data when fetch succeeds', async () => {
    vi.mocked(analyticsApi.fetchMonteCarlo).mockResolvedValue({
      throughput_data: [5, 3, 7],
      simulations: {
        histogram: [{ days: 1, probability: 0.1 }, { days: 2, probability: 0.3 }],
        percentiles: { p50: 2, p75: 3, p85: 5, p95: 7 },
        total_cards: 5,
      },
    });
    renderPage();
    fireEvent.click(screen.getByTestId('tab-monte-carlo'));
    await waitFor(() => {
      expect(screen.getByText('P50:')).toBeInTheDocument();
      expect(screen.getByText('2d')).toBeInTheDocument();
    });
  });

  it('renders aging WIP data when fetch succeeds', async () => {
    vi.mocked(analyticsApi.fetchAgingWip).mockResolvedValue({
      stagnant_cards: [{ card_id: 'c1', title: 'Old Card', column_title: 'Doing', assignee_name: 'Bob', idle_hours: 96, idle_days: 4, entered_column_at: '' }],
      stagnant_count: 1,
      threshold_days: 3,
      total_cards_in_active_columns: 10,
    });
    renderPage();
    fireEvent.click(screen.getByTestId('tab-aging-wip'));
    await waitFor(() => {
      expect(screen.getByText('Old Card')).toBeInTheDocument();
    });
  });

  it('has active tab styling on selected tab', () => {
    renderPage();
    const cfdTab = screen.getByTestId('tab-cfd');
    expect(cfdTab.getAttribute('aria-selected')).toBe('true');
  });
});
