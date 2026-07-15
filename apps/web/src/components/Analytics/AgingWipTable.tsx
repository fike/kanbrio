import { For, Show } from 'solid-js';
import type { AgingWipCard } from '../../api/analytics';

interface AgingWipTableProps {
  data: AgingWipCard[];
  totalCards: number;
  loading: boolean;
  error: Error | null;
}

export function AgingWipTable(props: AgingWipTableProps) {
  return (
    <div class="w-full p-4 bg-surface border border-base rounded-lg shadow-sm flex flex-col gap-4" data-testid="analytics-chart-card">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-0.5">
          <h3 class="text-sm font-semibold text-primary">Aging WIP</h3>
          <span class="text-[11px] text-secondary">
            {props.totalCards} cards in active columns &middot; {props.data.length} stagnant
          </span>
        </div>
      </div>

      <Show when={props.loading}>
        <div class="flex items-center justify-center py-12">
          <div class="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={!props.loading && props.error}>
        <div class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3" data-testid="chart-error-banner">
          <span>Failed to load aging WIP data</span>
        </div>
      </Show>

      <Show when={!props.loading && !props.error && props.data.length === 0}>
        <div class="flex flex-col items-center py-12 text-center gap-2" data-testid="chart-empty-state">
          <div class="w-10 h-10 rounded-full bg-elevated flex items-center justify-center text-tertiary">
            <svg class="w-5 h-5 text-status-done" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span class="text-sm font-medium text-primary">No stagnant cards</span>
          <span class="text-xs text-secondary max-w-xs">All cards are within the idle threshold.</span>
        </div>
      </Show>

      <Show when={!props.loading && !props.error && props.data.length > 0}>
        <table class="w-full text-xs" data-testid="aging-wip-table">
          <thead>
            <tr class="text-[10px] font-semibold text-secondary uppercase tracking-wider border-b border-base">
              <th class="text-left py-2 pr-2">Card</th>
              <th class="text-left py-2 px-2">Column</th>
              <th class="text-left py-2 px-2">Assignee</th>
              <th class="text-right py-2 pl-2">Idle Time</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.data}>
              {(card) => (
                <tr class="border-b border-base last:border-b-0 hover:bg-elevated/50 transition-colors" data-testid={`aging-wip-row-${card.card_id}`}>
                  <td class="py-2.5 pr-2 text-primary font-medium truncate max-w-[200px]">{card.title}</td>
                  <td class="py-2.5 px-2 text-secondary">{card.column_title}</td>
                  <td class="py-2.5 px-2 text-secondary">{card.assignee_name || '\u2014'}</td>
                  <td class="py-2.5 pl-2 text-right font-medium">
                    <span
                      classList={{
                        'text-secondary': card.idle_days < 7,
                        'text-status-doing': card.idle_days >= 7 && card.idle_days < 14,
                        'text-status-blocked': card.idle_days >= 14,
                      }}
                    >
                      {card.idle_days}d {Math.round(card.idle_hours % 24)}h
                    </span>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}
