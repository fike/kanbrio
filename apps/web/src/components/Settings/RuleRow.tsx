import type { BusinessRule } from '../../api/rules';
import { Trash2 } from 'lucide-solid';

const TRIGGER_LABELS: Record<string, string> = {
  child_status_changed: 'Child status changed',
  card_entered_column: 'Card enters column',
};

const ACTION_LABELS: Record<string, string> = {
  move_parent_card: 'Move parent card',
  assign_card: 'Assign card',
};

interface RuleRowProps {
  rule: BusinessRule;
  onToggle: (rule: BusinessRule) => void;
  onDelete: (rule: BusinessRule) => void;
  toggling: boolean;
}

export function RuleRow(props: RuleRowProps) {
  return (
    <div class="flex items-center gap-3 px-4 py-3 bg-surface border border-base rounded-md hover:bg-elevated/50 transition-colors duration-150">
      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
        <span class="text-sm font-medium text-primary truncate">{props.rule.name}</span>
        <div class="flex items-center gap-2 text-[11px] text-tertiary font-medium">
          <span class="bg-elevated px-1.5 py-0.5 rounded border border-base">
            {TRIGGER_LABELS[props.rule.trigger_type] || props.rule.trigger_type}
          </span>
          <span class="text-secondary">&rarr;</span>
          <span class="bg-elevated px-1.5 py-0.5 rounded border border-base">
            {ACTION_LABELS[props.rule.action_type] || props.rule.action_type}
          </span>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={props.rule.is_active}
        data-testid={`rule-toggle-${props.rule.id}`}
        onClick={() => props.onToggle(props.rule)}
        disabled={props.toggling}
        class="relative w-9 h-5 rounded-full transition-colors duration-200 focus:ring-2 focus:ring-accent-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        classList={{
          'bg-accent-primary': props.rule.is_active,
          'bg-elevated border border-base': !props.rule.is_active,
        }}
      >
        <span
          class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200"
          classList={{ 'translate-x-4': props.rule.is_active }}
        />
      </button>

      <button
        type="button"
        data-testid={`rule-delete-${props.rule.id}`}
        onClick={() => props.onDelete(props.rule)}
        class="p-1.5 text-tertiary hover:text-status-blocked rounded-md hover:bg-status-blocked/10 transition-colors focus:ring-2 focus:ring-accent-primary focus:outline-none"
        aria-label={`Delete rule ${props.rule.name}`}
      >
        <Trash2 class="w-4 h-4" />
      </button>
    </div>
  );
}
