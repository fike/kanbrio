import { createSignal, For, Show } from 'solid-js';
import { createQuery } from '@tanstack/solid-query';
import { fetchCycleTimes, fetchFlowEfficiency, fetchAgingWip } from '../../api/analytics';
import { CycleTimePanel } from './CycleTimePanel';
import { FlowEfficiencyPanel } from './FlowEfficiencyPanel';
import { AgingWipTable } from './AgingWipTable';

interface AnalyticsPageProps {
  workspaceId: string;
}

type Tab = 'cycle-time' | 'flow-efficiency' | 'aging-wip';

const TABS: { id: Tab; label: string }[] = [
  { id: 'cycle-time', label: 'Cycle Time' },
  { id: 'flow-efficiency', label: 'Flow Efficiency' },
  { id: 'aging-wip', label: 'Aging WIP' },
];

export function AnalyticsPage(props: AnalyticsPageProps) {
  const [activeTab, setActiveTab] = createSignal<Tab>('cycle-time');
  const [days, setDays] = createSignal(90);
  const [threshold, setThreshold] = createSignal(3);

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

  return (
    <div class="h-full overflow-y-auto p-6 flex flex-col gap-6" data-testid="analytics-page">
      <div class="flex items-center justify-between pb-4 border-b border-base">
        <div class="flex flex-col gap-1">
          <h2 class="text-lg font-semibold tracking-tight text-primary">Analytics</h2>
          <p class="text-xs text-secondary">Board analytics and flow metrics</p>
        </div>
      </div>

      <div class="flex items-center gap-1 border-b border-base mb-2" role="tablist" data-testid="analytics-tabs">
        <For each={TABS}>
          {(tab) => (
            <button
              role="tab"
              aria-selected={activeTab() === tab.id}
              onClick={() => setActiveTab(tab.id)}
              class="px-4 py-2 text-sm font-medium transition-colors border-b-2"
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

      <Show when={activeTab() === 'cycle-time'}>
        <div class="flex items-center gap-2 mb-2">
          <button
            class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
            classList={{ 'bg-accent-primary text-white': days() === 30, 'bg-surface border border-base text-secondary hover:bg-elevated': days() !== 30 }}
            onClick={() => setDays(30)}
            data-testid="date-30d"
          >
            30d
          </button>
          <button
            class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
            classList={{ 'bg-accent-primary text-white': days() === 90, 'bg-surface border border-base text-secondary hover:bg-elevated': days() !== 90 }}
            onClick={() => setDays(90)}
            data-testid="date-90d"
          >
            90d
          </button>
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
    </div>
  );
}
