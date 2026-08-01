import { createEffect, onMount, Show } from 'solid-js';
import { Chart, registerables } from 'chart.js';
import type { CFDResponse } from '../../api/analytics';

Chart.register(...registerables);

interface CFDPanelProps {
  data: CFDResponse | null;
  loading: boolean;
  error: Error | null;
  dateRange: string;
  onRetry: () => void;
}

export function CFDPanel(props: CFDPanelProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let chartInstance: Chart | null = null;

  const renderChart = () => {
    if (!canvasRef || !props.data || props.data.data_points.length === 0) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const labels = props.data.data_points.map((p) => p.date);
    const datasets = props.data.columns.map((col) => ({
      label: col.title,
      data: props.data!.data_points.map((p) => p.counts[col.id] ?? 0),
      backgroundColor: col.color,
      borderColor: col.color,
      borderWidth: 0,
      fill: true,
      pointRadius: 0,
    }));

    chartInstance = new Chart(canvasRef, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            ticks: { font: { size: 10 } },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { font: { size: 10 }, stepSize: 1 },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 16, font: { size: 11 } },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
      },
    });
  };

  onMount(() => {
    renderChart();
  });

  createEffect(() => {
    renderChart();
  });

  return (
    <div class="w-full p-4 bg-surface border border-base rounded-lg shadow-sm flex flex-col gap-4" data-testid="analytics-chart-card">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-0.5">
          <h3 class="text-sm font-semibold text-primary">Cumulative Flow Diagram</h3>
          <span class="text-[11px] text-secondary">Last {props.dateRange} days</span>
        </div>
      </div>

      <div class="w-full h-[300px] relative" data-testid="chart-area">
        <Show when={props.loading}>
          <div class="absolute inset-0 flex items-center justify-center bg-surface/80 z-10" data-testid="chart-loading-overlay">
            <div class="flex flex-col items-center gap-2">
              <div class="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
              <span class="text-xs text-secondary">Loading chart...</span>
            </div>
          </div>
        </Show>

        <Show when={!props.loading && props.error}>
          <div class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex items-center justify-between" data-testid="chart-error-banner" role="alert">
            <span>Failed to load chart data</span>
            <button
              class="text-accent-primary hover:text-accent-primary/95 font-semibold underline underline-offset-2"
              data-testid="chart-retry-button"
              onClick={() => props.onRetry()}
            >
              Retry
            </button>
          </div>
        </Show>

        <Show when={!props.loading && !props.error && (!props.data || props.data.data_points.length === 0)}>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center gap-2" data-testid="chart-empty-state">
            <span class="text-sm font-medium text-primary">No data yet</span>
            <span class="text-xs text-secondary max-w-xs">Add cards and create transitions to see flow trends.</span>
          </div>
        </Show>

        <canvas
          ref={canvasRef}
          class="w-full h-full"
          role="img"
          aria-label={`Cumulative Flow Diagram showing card counts per column over the last ${props.dateRange} days`}
        />
      </div>
    </div>
  );
}
