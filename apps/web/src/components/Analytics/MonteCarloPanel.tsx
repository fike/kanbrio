import { onMount, Show } from 'solid-js';
import { Chart, registerables } from 'chart.js';
import type { MonteCarloResponse } from '../../api/analytics';

Chart.register(...registerables);

interface MonteCarloPanelProps {
  data: MonteCarloResponse | null;
  loading: boolean;
  error: Error | null;
}

export function MonteCarloPanel(props: MonteCarloPanelProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let chartInstance: Chart | null = null;

  const renderChart = () => {
    if (!canvasRef || !props.data || props.data.throughput_data.length === 0) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const bins = props.data.simulations.histogram;
    const p50 = props.data.simulations.percentiles.p50;
    const p85 = props.data.simulations.percentiles.p85;
    const p95 = props.data.simulations.percentiles.p95;

    const labels = bins.map((b) => b.days.toString());
    const values = bins.map((b) => b.probability);

    // Color bars by percentile
    const backgroundColors = bins.map((b) => {
      if (b.days <= p50) return 'rgba(34, 197, 94, 0.7)';
      if (b.days <= p85) return 'rgba(234, 179, 8, 0.7)';
      if (b.days <= p95) return 'rgba(239, 68, 68, 0.7)';
      return 'rgba(239, 68, 68, 0.3)';
    });

    chartInstance = new Chart(canvasRef, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Probability',
            data: values,
            backgroundColor: backgroundColors,
            borderWidth: 0,
            borderRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'Days to complete', font: { size: 11 } },
            ticks: { font: { size: 10 } },
          },
          y: {
            title: { display: true, text: 'Probability (%)', font: { size: 11 } },
            ticks: { font: { size: 10 } },
            beginAtZero: true,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${Number(ctx.raw).toFixed(1)}% probability`,
            },
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
        <h3 class="text-sm font-semibold text-primary">Monte Carlo Simulation</h3>
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
          <div class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3" data-testid="chart-error-banner">
            <span>Failed to load Monte Carlo data</span>
          </div>
        </Show>

        <Show when={!props.loading && !props.error && (!props.data || props.data.throughput_data.length === 0)}>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center gap-2" data-testid="chart-empty-state">
            <span class="text-sm font-medium text-primary">No data yet</span>
            <span class="text-xs text-secondary max-w-xs">Complete cards to generate throughput data for simulations.</span>
          </div>
        </Show>

        <canvas ref={canvasRef} class="w-full h-full" />
      </div>

      <Show when={props.data && props.data.throughput_data.length > 0}>
        <div class="flex items-center gap-4 text-xs pt-2 border-t border-base" data-testid="monte-carlo-summary">
          <span>P50: <strong>{props.data!.simulations.percentiles.p50}d</strong></span>
          <span>P75: <strong>{props.data!.simulations.percentiles.p75}d</strong></span>
          <span>P85: <strong>{props.data!.simulations.percentiles.p85}d</strong></span>
          <span>P95: <strong>{props.data!.simulations.percentiles.p95}d</strong></span>
          <span class="text-secondary">Simulations: {props.data!.throughput_data.length.toLocaleString()}</span>
          <span class="text-secondary">Cards: {props.data!.simulations.total_cards}</span>
        </div>
      </Show>
    </div>
  );
}
