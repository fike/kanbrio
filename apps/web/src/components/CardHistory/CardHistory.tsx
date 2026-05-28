import { type Component, For, Show, Switch, Match } from 'solid-js';
import { createQuery } from '@tanstack/solid-query';
import { getCardHistory } from '../../api/board';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Move,
  ShieldAlert,
  ShieldCheck,
  Edit,
  Archive,
  Trash2,
  Circle
} from 'lucide-solid';

interface CardHistoryProps {
  workspaceId: string;
  cardId: string;
}

const EventIcon: Component<{ type: string }> = (props) => {
  return (
    <Switch fallback={<Circle size={14} class="text-tertiary" />}>
      <Match when={props.type === 'create'}><Plus size={14} class="text-status-doing" /></Match>
      <Match when={props.type === 'move'}><Move size={14} class="text-accent-primary" /></Match>
      <Match when={props.type === 'block'}><ShieldAlert size={14} class="text-status-blocked" /></Match>
      <Match when={props.type === 'unblock'}><ShieldCheck size={14} class="text-status-done" /></Match>
      <Match when={props.type === 'update'}><Edit size={14} class="text-tertiary" /></Match>
      <Match when={props.type === 'archive'}><Archive size={14} class="text-tertiary" /></Match>
      <Match when={props.type === 'delete'}><Trash2 size={14} class="text-status-blocked" /></Match>
    </Switch>
  );
};

interface BlockPayload {
  reason?: string;
}

const CardHistory: Component<CardHistoryProps> = (props) => {
  const query = createQuery(() => ({
    queryKey: ['card-history', props.cardId],
    queryFn: () => getCardHistory(props.workspaceId, props.cardId),
  }));

  return (
    <div class="flex flex-col gap-6">
      <Show when={query.isLoading}>
        <div class="flex items-center justify-center p-8 text-secondary animate-pulse">
          Fetching history...
        </div>
      </Show>

      <Show when={query.isError}>
        <div class="p-4 bg-status-blocked/10 text-status-blocked rounded border border-status-blocked/20 text-xs">
          Failed to load history.
        </div>
      </Show>

      <Show when={query.isSuccess && query.data}>
        <div class="relative border-l border-base ml-2 pl-6 flex flex-col gap-6">
          <For each={query.data}>
            {(event) => (
              <div class="relative">
                {/* Timeline Dot */}
                <div class="absolute -left-[31px] top-0 w-2.5 h-2.5 rounded-full bg-surface border-2 border-base" />

                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-2">
                    <EventIcon type={event.transition_type} />
                    <span class="text-xs font-bold uppercase tracking-wider text-primary">
                      {event.transition_type}
                    </span>
                    <span class="text-[10px] text-tertiary">
                      {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Payload Details */}
                  <div class="text-xs text-secondary bg-elevated/30 p-2 rounded border border-base/50">
                    <Show when={event.transition_type === 'move'}>
                      Moved from column to another.
                    </Show>
                    <Show when={event.transition_type === 'block' && (event.payload as BlockPayload)?.reason}>
                      <span class="italic font-medium">Reason:</span> {(event.payload as BlockPayload).reason}
                    </Show>
                    <Show when={event.transition_type === 'update'}>
                      Updated properties.
                    </Show>
                    <Show when={!['move', 'block', 'update'].includes(event.transition_type)}>
                      No additional details.
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={query.isSuccess && query.data?.length === 0}>
        <div class="text-center p-8 text-tertiary text-xs italic">
          No history recorded for this card.
        </div>
      </Show>
    </div>
  );
};

export default CardHistory;
