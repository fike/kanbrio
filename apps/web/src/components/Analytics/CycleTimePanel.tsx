import { onMount, Show } from 'solid-js';
import { Chart, registerables } from 'chart.js';
import type { CycleTimePoint, Percentiles } from '../../api/analytics';

Chart.register(...registerables);

interface CycleTimePanelProps {
  data: CycleTimePoint[];
  percentiles?: Percentiles;
  loading: boolean;
  error: Error | null;
}

export function CycleTimePanel(props: CycleTimePanelProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let chartInstance: Chart | null = null;

  const renderChart = () => {
    if (!canvasRef || props.data.length === 0) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const days = props.data.map((p) => new Date(p.completed_at).getTime());
    const minDate = Math.min(...days);
    const maxDate = Math.max(...days);

    chartInstance = new Chart(canvasRef, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Cards',
            data: props.data.map((p) => ({
              x: new Date(p.completed_at).getTime(),
              y: p.cycle_time_hours,
            })),
            backgroundColor: '#2563EB',
            pointRadius: 5,
            pointHoverRadius: 8,
          },
          ...(props.percentiles
            ? [
                {
                  label: 'P95',
                  data: [
                    { x: minDate, y: props.percentiles.p95 },
                    { x: maxDate, y: props.percentiles.p95 },
                  ],
                  type: 'line' as const,
                  borderColor: '#EF4444',
                  borderDash: [4, 4],
                  borderWidth: 1,
                  pointRadius: 0,
                  fill: false,
                },
                {
                  label: 'P85',
                  data: [
                    { x: minDate, y: props.percentiles.p85 },
                    { x: maxDate, y: props.percentiles.p85 },
                  ],
                  type: 'line' as const,
                  borderColor: '#EAB308',
                  borderDash: [4, 4],
                  borderWidth: 1,
                  pointRadius: 0,
                  fill: false,
                },
                {
                  label: 'P50',
                  data: [
                    { x: minDate, y: props.percentiles.p50 },
                    { x: maxDate, y: props.percentiles.p50 },
                  ],
                  type: 'line' as const,
                  borderColor: '#22C55E',
                  borderDash: [4, 4],
                  borderWidth: 1,
                  pointRadius: 0,
                  fill: false,
                },
              ]
            : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Completion Date' },
            ticks: {
              callback: (value) => {
                const d = new Date(Number(value));
                return `${d.getMonth() + 1}/${d.getDate()}`;
              },
            },
          },
          y: {
            type: 'logarithmic',
            title: { display: true, text: 'Cycle Time (hours)' },
            ticks: {
              callback: (value) => {
                const v = Number(value);
                if (v >= 24) return `${(v / 24).toFixed(0)}d`;
                return `${v.toFixed(0)}h`;
              },
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                if (idx === undefined) return '';
                const p = props.data[idx];
                const hours = p.cycle_time_hours;
                const days = (hours / 24).toFixed(1);
                return `${p.title}: ${hours.toFixed(1)}h (${days}d)`;
              },
            },
          },
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
          <h3 class="text-sm font-semibold text-primary">Cycle Time Scatter</h3>
          {props.percentiles && (
            <span class="text-[11px] text-secondary">
              P50: {(props.percentiles.p50 / 24).toFixed(1)}d &middot; P85: {(props.percentiles.p85 / 24).toFixed(1)}d &middot; P95: {(props.percentiles.p95 / 24).toFixed(1)}d
            </span>
          )}
        </div>
      </div>

      <div class="w-full h-[300px] relative">
        <Show when={props.loading}>
          <div class="absolute inset-0 flex items-center justify-center bg-surface/80 z-10" data-testid="chart-loading-overlay">
            <div class="flex flex-col items-center gap-2">
              <div class="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
              <span class="text-xs text-secondary">Loading chart...</span>
            </div>
          </div>
        </Show>

        <Show when={!props.loading && props.error}>
          <div class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex items-center justify-between" data-testid="chart-error-banner">
            <span>Failed to load chart data</span>
          </div>
        </Show>

        <Show when={!props.loading && !props.error && props.data.length === 0}>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center gap-2" data-testid="chart-empty-state">
            <div class="w-10 h-10 rounded-full bg-elevated flex items-center justify-center text-tertiary">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span class="text-sm font-medium text-primary">No data yet</span>
            <span class="text-xs text-secondary max-w-xs">Complete some cards to see cycle time trends.</span>
          </div>
        </Show>

        <canvas ref={canvasRef} class="w-full h-full" />
      </div>
    </div>
  );
}
