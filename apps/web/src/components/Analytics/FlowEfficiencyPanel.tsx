import { For, onMount, Show } from 'solid-js';
import { Chart, registerables } from 'chart.js';
import type { FlowEfficiencyResponse } from '../../api/analytics';

Chart.register(...registerables);

interface FlowEfficiencyPanelProps {
  data: FlowEfficiencyResponse | null;
  loading: boolean;
  error: Error | null;
}

export function FlowEfficiencyPanel(props: FlowEfficiencyPanelProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let chartInstance: Chart | null = null;

  const renderChart = () => {
    if (!canvasRef || !props.data) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    chartInstance = new Chart(canvasRef, {
      type: 'doughnut',
      data: {
        labels: ['Active Time', 'Wait Time'],
        datasets: [
          {
            data: [props.data.active_hours, props.data.wait_hours],
            backgroundColor: ['#22C55E', '#F97316'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 16, font: { size: 11 } },
          },
        },
      },
    });
  };

  onMount(() => {
    renderChart();
  });

  return (
    <div class="w-full p-4 bg-surface border border-base rounded-lg shadow-sm flex flex-col gap-4" data-testid="analytics-chart-card">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-0.5">
          <h3 class="text-sm font-semibold text-primary">Flow Efficiency</h3>
          {props.data && (
            <span class="text-[11px] text-secondary">
              {props.data.total_cards} active cards &middot; {props.data.efficiency_pct.toFixed(1)}% efficiency
            </span>
          )}
        </div>
      </div>

      <div class="w-full h-[300px] relative flex items-center justify-center">
        <Show when={props.loading}>
          <div class="absolute inset-0 flex items-center justify-center bg-surface/80 z-10" data-testid="chart-loading-overlay">
            <div class="flex flex-col items-center gap-2">
              <div class="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
              <span class="text-xs text-secondary">Loading chart...</span>
            </div>
          </div>
        </Show>

        <Show when={!props.loading && props.error}>
          <div class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3" data-testid="chart-error-banner">
            <span>Failed to load flow efficiency</span>
          </div>
        </Show>

        <Show when={!props.loading && !props.error && !props.data}>
          <div class="flex flex-col items-center text-center gap-2" data-testid="chart-empty-state">
            <span class="text-sm font-medium text-primary">No data yet</span>
            <span class="text-xs text-secondary max-w-xs">Move cards to see efficiency metrics.</span>
          </div>
        </Show>

        <Show when={!props.loading && !props.error && props.data}>
          <div class="flex gap-6 items-center w-full">
            <div class="w-[200px] h-[200px] shrink-0">
              <canvas ref={canvasRef} class="w-full h-full" />
            </div>
            <div class="flex flex-col gap-3 text-xs">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded bg-status-done" />
                <span class="text-secondary">Active: {props.data?.active_hours.toFixed(0)}h</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded bg-orange-500" />
                <span class="text-secondary">Wait: {props.data?.wait_hours.toFixed(0)}h</span>
              </div>
              <div class="border-t border-base pt-2 mt-1">
                <span class="font-semibold text-primary">{props.data?.efficiency_pct.toFixed(1)}%</span>
                <span class="text-secondary ml-1">efficiency</span>
              </div>
            </div>
          </div>
        </Show>
      </div>

      <Show when={props.data && props.data.by_column.length > 0}>
        <div class="border-t border-base pt-3">
          <span class="text-[10px] font-semibold text-secondary uppercase tracking-wider">Wait by Column</span>
          <div class="flex flex-col gap-1 mt-2 text-xs">
            <For each={props.data!.by_column}>
              {(col) => (
                <div class="flex items-center justify-between py-1 border-b border-base/50 last:border-b-0">
                  <span class="text-primary">{col.title}</span>
                  <span class="text-secondary">{col.card_count} cards &middot; {col.wait_hours.toFixed(0)}h wait</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
