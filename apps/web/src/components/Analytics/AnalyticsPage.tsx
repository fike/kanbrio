import { createSignal, For, Show } from 'solid-js';
import { createQuery } from '@tanstack/solid-query';
import {
  fetchCycleTimes, fetchFlowEfficiency, fetchAgingWip,
  fetchCFD, fetchMonteCarlo,
} from '../../api/analytics';
import { CycleTimePanel } from './CycleTimePanel';
import { FlowEfficiencyPanel } from './FlowEfficiencyPanel';
import { AgingWipTable } from './AgingWipTable';
import { CFDPanel } from './CFDPanel';
import { MonteCarloPanel } from './MonteCarloPanel';

interface AnalyticsPageProps {
  workspaceId: string;
}

type Tab = 'cfd' | 'cycle-time' | 'flow-efficiency' | 'aging-wip' | 'monte-carlo';

const TABS: { id: Tab; label: string }[] = [
  { id: 'cfd', label: 'Cumulative Flow' },
  { id: 'cycle-time', label: 'Cycle Time' },
  { id: 'flow-efficiency', label: 'Flow Efficiency' },
  { id: 'aging-wip', label: 'Aging WIP' },
  { id: 'monte-carlo', label: 'Monte Carlo' },
];

export function AnalyticsPage(props: AnalyticsPageProps) {
  const [activeTab, setActiveTab] = createSignal<Tab>('cfd');
  const [days, setDays] = createSignal(90);
  const [threshold, setThreshold] = createSignal(3);
  const [cfdRange, setCfdRange] = createSignal(30);
  const [mcDays, setMcDays] = createSignal(90);

  const today = () => new Date().toISOString().split('T')[0];
  const fromDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - cfdRange());
    return d.toISOString().split('T')[0];
  };

  const cfdQuery = createQuery(() => ({
    queryKey: ['cfd', props.workspaceId, cfdRange()],
    queryFn: () => fetchCFD(props.workspaceId, fromDate(), today()),
  }));

  const cycleQuery = createQuery(() => ({
    queryKey: ['cycle-times', props.workspaceId, days()],
    queryFn: () => fetchCycleTimes(props.workspaceId, days()),
  }));

  const flowQuery = createQuery(() => ({
    queryKey: ['flow-efficiency', props.workspaceId],
    queryFn: () => fetchFlowEfficiency(props.workspaceId),
  }));

  const agingQuery = createQuery(() => ({
    queryKey: ['aging-wip', props.workspaceId, threshold()],
    queryFn: () => fetchAgingWip(props.workspaceId, threshold()),
  }));

  const mcQuery = createQuery(() => ({
    queryKey: ['monte-carlo', props.workspaceId, mcDays()],
    queryFn: () => fetchMonteCarlo(props.workspaceId, mcDays()),
  }));

  return (
    <div class="h-full overflow-y-auto p-6 flex flex-col gap-6" data-testid="analytics-page">
      <div class="flex items-center justify-between pb-4 border-b border-base">
        <div class="flex flex-col gap-1">
          <h2 class="text-lg font-semibold tracking-tight text-primary">Analytics</h2>
          <p class="text-xs text-secondary">Board analytics and flow metrics</p>
        </div>
      </div>

      <div class="flex items-center gap-1 border-b border-base mb-2 overflow-x-auto" role="tablist" data-testid="analytics-tabs">
        <For each={TABS}>
          {(tab) => (
            <button
              role="tab"
              aria-selected={activeTab() === tab.id}
              onClick={() => setActiveTab(tab.id)}
              class="px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2"
              classList={{
                'text-primary border-accent-primary': activeTab() === tab.id,
                'text-secondary border-transparent hover:text-primary': activeTab() !== tab.id,
              }}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>

      <Show when={activeTab() === 'cfd'}>
        <div class="flex items-center gap-2 mb-2">
          {[7, 30, 90].map((d) => (
            <button
              class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
              classList={{ 'bg-accent-primary text-white': cfdRange() === d, 'bg-surface border border-base text-secondary hover:bg-elevated': cfdRange() !== d }}
              onClick={() => setCfdRange(d)}
              data-testid={`date-${d}d`}
            >
              {d}d
            </button>
          ))}
        </div>
        <CFDPanel
          data={cfdQuery.data ?? null}
          loading={cfdQuery.isLoading}
          error={cfdQuery.error as Error | null}
        />
      </Show>

      <Show when={activeTab() === 'cycle-time'}>
        <div class="flex items-center gap-2 mb-2">
          {[30, 90].map((d) => (
            <button
              class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
              classList={{ 'bg-accent-primary text-white': days() === d, 'bg-surface border border-base text-secondary hover:bg-elevated': days() !== d }}
              onClick={() => setDays(d)}
              data-testid={`date-${d}d`}
            >
              {d}d
            </button>
          ))}
        </div>
        <CycleTimePanel
          data={cycleQuery.data?.data_points ?? []}
          percentiles={cycleQuery.data?.percentiles}
          loading={cycleQuery.isLoading}
          error={cycleQuery.error as Error | null}
        />
      </Show>

      <Show when={activeTab() === 'flow-efficiency'}>
        <FlowEfficiencyPanel
          data={flowQuery.data ?? null}
          loading={flowQuery.isLoading}
          error={flowQuery.error as Error | null}
        />
      </Show>

      <Show when={activeTab() === 'aging-wip'}>
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs text-secondary">Threshold:</span>
          {[1, 3, 7].map((d) => (
            <button
              class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
              classList={{ 'bg-accent-primary text-white': threshold() === d, 'bg-surface border border-base text-secondary hover:bg-elevated': threshold() !== d }}
              onClick={() => setThreshold(d)}
            >
              {d}d
            </button>
          ))}
        </div>
        <AgingWipTable
          data={agingQuery.data?.stagnant_cards ?? []}
          totalCards={agingQuery.data?.total_cards_in_active_columns ?? 0}
          loading={agingQuery.isLoading}
          error={agingQuery.error as Error | null}
        />
      </Show>

      <Show when={activeTab() === 'monte-carlo'}>
        <div class="flex items-center gap-2 mb-2">
          {[30, 90, 180].map((d) => (
            <button
              class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
              classList={{ 'bg-accent-primary text-white': mcDays() === d, 'bg-surface border border-base text-secondary hover:bg-elevated': mcDays() !== d }}
              onClick={() => setMcDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
        <MonteCarloPanel
          data={mcQuery.data ?? null}
          loading={mcQuery.isLoading}
          error={mcQuery.error as Error | null}
        />
      </Show>
    </div>
  );
}
