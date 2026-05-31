import { type Component, Show, For, createSignal, onMount } from 'solid-js';
import { ShieldAlert, Clock, Shield } from 'lucide-solid';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type { ChecklistItem } from '../../api/board';

export type CardState = 'default' | 'blocked' | 'delayed';

export interface CardProps {
  id: string;
  fullId: string; // The UUID
  title: string;
  isBlocked?: boolean;
  isShaking?: boolean;
  blockerReason?: string;
  parentTitle?: string;
  parentId?: string;
  subtasksCount?: number;
  totalSubtasks?: number;
  subtasks?: Array<{ id: string; title: string; isDone: boolean; columnName: string }>;
  assigneeAvatar?: string;
  checklists?: ChecklistItem[];
  onClick?: () => void;
  onBlock?: (reason: string) => void;
  onUnblock?: () => void;
  onToggleChecklist?: (checklistId: string) => void;
  onOpenBlockerDrawer?: () => void;
}

const Card: Component<CardProps> = (props) => {
  const isDelayed = () => false; // Placeholder for now
  const [isDragging, setIsDragging] = createSignal(false);
  let el!: HTMLDivElement;

  onMount(() => {
    return draggable({
      element: el,
      getInitialData: () => ({ type: 'card', id: props.fullId }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  });

  const handleBlockClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (props.isBlocked) {
      props.onUnblock?.();
    } else {
      const reason = prompt('Enter reason for blocking:');
      if (reason) {
        props.onBlock?.(reason);
      }
    }
  };

  const handleParentClick = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    if (!props.parentId) return;
    const parentEl = document.querySelector(`[data-card-id="${props.parentId}"]`) as HTMLElement | null;
    if (parentEl) {
      parentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      parentEl.classList.add('border-accent-primary', 'animate-pulse', 'shadow-glow');
      setTimeout(() => {
        parentEl.classList.remove('border-accent-primary', 'animate-pulse', 'shadow-glow');
      }, 1500);
      parentEl.focus();
    }
  };

  const progressPercent = () => props.totalSubtasks && props.totalSubtasks > 0 ? Math.round((props.subtasksCount || 0) / props.totalSubtasks * 100) : 0;

  return (
    <div
      ref={el}
      role="listitem"
      tabIndex={0}
      data-card-id={props.fullId}
      onClick={() => props.onClick?.()}
      class="relative flex flex-col gap-1 p-3 bg-surface border rounded-md shadow-sm transition-all ease-standard duration-300 focus:ring-2 focus:ring-accent-primary focus:outline-none cursor-pointer group"
      classList={{
        'border-base': !props.isBlocked,
        'border-status-blocked bg-status-blocked/5 ring-1 ring-status-blocked': props.isBlocked,
        'opacity-50 scale-105 shadow-xl rotate-1': isDragging(),
        'animate-shake': props.isShaking,
      }}
      aria-label={`Card: ${props.title}${props.isBlocked ? ', Blocked' : ''}`}
    >
      {/* Left accent stripe for blocked cards */}
      <Show when={props.isBlocked}>
        <div class="w-1 h-full bg-status-blocked absolute left-0 top-0 rounded-l-md" />
      </Show>

      {/* Header: Parent Badge, Subtasks Count Badge & Actions */}
      <div class="flex justify-between items-center mb-0.5">
        <div class="flex items-center gap-2">
          <Show when={props.parentTitle && props.parentId}>
            <div
              data-testid={`card-parent-badge-${props.fullId}`}
              role="link"
              tabIndex={0}
              onClick={handleParentClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleParentClick(e);
                }
              }}
              class="text-[10px] uppercase font-bold tracking-wider text-secondary hover:text-accent-primary transition-colors cursor-pointer flex items-center gap-0.5 focus:outline-none focus:ring-1 focus:ring-accent-primary rounded px-1 py-0.5"
              title={`Parent: ${props.parentTitle}`}
            >
              ↑ {props.parentTitle!.length > 20 ? props.parentTitle!.substring(0, 17) + '...' : props.parentTitle}
            </div>
          </Show>

          <Show when={props.totalSubtasks && props.totalSubtasks > 0}>
            <div class="relative group/tooltip inline-block">
              <div
                data-testid={`card-children-badge-${props.fullId}`}
                class="flex items-center gap-1 text-[10px] text-secondary font-mono bg-elevated px-1.5 py-0.5 rounded cursor-help"
                aria-label={`${props.subtasksCount} of ${props.totalSubtasks} subtasks completed`}
              >
                <span>⑆ {props.subtasksCount}/{props.totalSubtasks}</span>
              </div>
              <div
                role="tooltip"
                class="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:block bg-surface border border-base p-2 rounded shadow-lg z-30 min-w-[220px] text-xs text-primary"
              >
                <ul class="flex flex-col gap-1">
                  <For each={props.subtasks}>
                    {(subtask) => (
                      <li class="flex justify-between items-center gap-2">
                        <span classList={{ 'line-through text-tertiary': subtask.isDone }}>
                          {subtask.title}
                        </span>
                        <span class="px-1 py-0.25 text-[9px] font-bold rounded bg-elevated border border-base max-w-[80px] truncate">
                          {subtask.columnName}
                        </span>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </div>
          </Show>
        </div>

        <button
          onClick={handleBlockClick}
          class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-base/50 transition-all"
          title={props.isBlocked ? 'Unblock card' : 'Block card'}
        >
          <Show when={props.isBlocked} fallback={<Shield size={12} class="text-tertiary" />}>
            <Shield size={12} class="text-status-blocked" />
          </Show>
        </button>
      </div>

      {/* Progress Bar below badges */}
      <Show when={props.totalSubtasks && props.totalSubtasks > 0}>
        <div
          role="progressbar"
          aria-valuenow={progressPercent()}
          aria-valuemin="0"
          aria-valuemax="100"
          class="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden mt-1.5"
        >
          <div
            class="h-full bg-accent-primary dark:bg-blue-500 rounded-full transition-all duration-300 ease-standard"
            style={{ width: `${progressPercent()}%` }}
          />
        </div>
      </Show>

      {/* Body: Title & Status Icons */}
      <div class="flex justify-between items-start gap-2">
        <h3 class="text-sm font-medium text-primary line-clamp-2 leading-tight">
          {props.title}
        </h3>
        <div class="flex gap-1 shrink-0">
          <Show when={props.isBlocked}>
            <ShieldAlert size={14} class="text-status-blocked" aria-hidden="true" />
          </Show>
          <Show when={isDelayed()}>
            <Clock size={14} class="text-status-doing" aria-hidden="true" />
          </Show>
        </div>
      </div>

      {/* Blocker Reason Badge */}
      <Show when={props.isBlocked}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            props.onOpenBlockerDrawer?.();
          }}
          data-testid="blocker-badge"
          role="button"
          tabIndex={0}
          aria-label={`Card is blocked. Click to open block details. Reason: ${props.blockerReason || 'Reason'}`}
          class="flex items-center gap-1.5 px-2 py-1 bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded font-medium mt-1 w-fit animate-pulse hover:bg-status-blocked/20 transition-all focus:ring-2 focus:ring-status-blocked/40 focus:outline-none"
        >
          <ShieldAlert size={12} class="shrink-0" />
          <span class="truncate max-w-[180px]">
            Blocked: {props.blockerReason || 'Reason'}
          </span>
        </div>
      </Show>

      {/* Checklist items container */}
      <Show when={props.checklists && props.checklists.length > 0}>
        <div data-testid="card-checklist-container" class="mt-2 flex flex-col gap-1.5 border-t border-base/30 pt-2">
          <For each={props.checklists}>
            {(item) => (
              <div data-testid={`checklist-item-${item.id}`} class="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  data-testid={`checklist-checkbox-${item.id}`}
                  checked={item.is_completed}
                  onChange={(e) => {
                    e.stopPropagation();
                    props.onToggleChecklist?.(item.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  class="w-3.5 h-3.5 rounded border-base text-accent-primary focus:ring-accent-primary cursor-pointer"
                />
                <span classList={{ 'line-through text-tertiary': item.is_completed, 'text-primary': !item.is_completed }}>
                  {item.title}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Footer: Metadata */}
      <div class="flex items-center justify-between mt-2 pt-2 border-t border-base/50">
        <div class="flex items-center gap-3">
          {/* Card ID */}
          <span class="text-[10px] font-mono text-tertiary uppercase">
            {props.id}
          </span>
        </div>

        {/* Assignee Avatar with highlights */}
        <Show
          when={props.assigneeAvatar}
          fallback={
            <div
              class="w-5 h-5 rounded-full bg-elevated border border-base"
              classList={{ 'ring-2 ring-status-blocked/40 animate-pulse border-status-blocked/60': props.isBlocked }}
            />
          }
        >
          <img
            src={props.assigneeAvatar}
            alt="Assignee"
            class="w-5 h-5 rounded-full border border-base"
            classList={{ 'ring-2 ring-status-blocked/40 animate-pulse border-status-blocked/60': props.isBlocked }}
          />
        </Show>
      </div>
    </div>
  );
};

export default Card;
