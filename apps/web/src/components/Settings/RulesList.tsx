import { For, Show } from 'solid-js';
import type { BusinessRule } from '../../api/rules';
import { RuleRow } from './RuleRow';
import { Plus } from 'lucide-solid';

interface RulesListProps {
  rules: BusinessRule[] | undefined;
  loading: boolean;
  error: Error | null;
  togglingId: string | null;
  onToggle: (rule: BusinessRule) => void;
  onDelete: (rule: BusinessRule) => void;
  onEdit: (rule: BusinessRule) => void;
  onCreateClick: () => void;
}

function ShimmerRow() {
  return (
    <div class="flex items-center gap-3 px-4 py-3 bg-surface border border-base rounded-md animate-pulse">
      <div class="flex-1 flex flex-col gap-2">
        <div class="h-4 w-48 bg-elevated rounded" />
        <div class="h-3 w-32 bg-elevated rounded" />
      </div>
      <div class="w-9 h-5 bg-elevated rounded-full" />
      <div class="w-7 h-7 bg-elevated rounded" />
    </div>
  );
}

export function RulesList(props: RulesListProps) {
  return (
    <Show
      when={!props.loading}
      fallback={
        <div class="flex flex-col gap-2">
          <For each={[0, 1, 2]}>
            {() => <ShimmerRow />}
          </For>
        </div>
      }
    >
      <Show
        when={!props.error}
        fallback={
          <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md px-4 py-3">
              Failed to load rules. Please try again.
            </div>
          </div>
        }
      >
        <Show
          when={props.rules && props.rules.length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
              <div class="w-12 h-12 rounded-full bg-elevated flex items-center justify-center border border-base">
                <span class="text-lg text-tertiary font-mono">if</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-primary">No automation rules</span>
                <span class="text-xs text-secondary max-w-sm">
                  Automate card movements and assignments when conditions are met.
                </span>
              </div>
              <button
                type="button"
                onClick={props.onCreateClick}
                class="mt-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/95 text-white rounded-md text-sm font-medium focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all flex items-center gap-1.5"
                data-testid="create-first-rule-button"
              >
                <Plus class="w-4 h-4" />
                Create your first rule
              </button>
            </div>
          }
        >
          <div class="flex flex-col gap-2">
            <For each={props.rules}>
              {(rule) => (
                <RuleRow
                  rule={rule}
                  onToggle={props.onToggle}
                  onDelete={props.onDelete}
                  onEdit={props.onEdit}
                  toggling={props.togglingId === rule.id}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </Show>
  );
}
