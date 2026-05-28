import { type Component, Show, createSignal, onMount } from 'solid-js';
import { ShieldAlert, Clock, Layers, Shield } from 'lucide-solid';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

export type CardState = 'default' | 'blocked' | 'delayed';

export interface CardProps {
  id: string;
  fullId: string; // The UUID
  title: string;
  isBlocked?: boolean;
  blockerReason?: string;
  parentTitle?: string;
  subtasksCount?: number;
  totalSubtasks?: number;
  assigneeAvatar?: string;
  onClick?: () => void;
  onBlock?: (reason: string) => void;
  onUnblock?: () => void;
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

  return (
    <div
      ref={el}
      role="listitem"
      tabIndex={0}
      onClick={() => props.onClick?.()}
      class="flex flex-col gap-1 p-3 bg-surface border rounded-md shadow-sm transition-all ease-standard duration-300 focus:ring-2 focus:ring-accent-primary focus:outline-none cursor-pointer group"
      classList={{
        'border-base': !props.isBlocked,
        'border-status-blocked bg-status-blocked/5 ring-1 ring-status-blocked': props.isBlocked,
        'opacity-50 scale-105 shadow-xl rotate-1': isDragging(),
      }}
      aria-label={`Card: ${props.title}${props.isBlocked ? ', Blocked' : ''}`}
    >
      {/* Header: Parent Breadcrumb & Actions */}
      <div class="flex justify-between items-center mb-0.5">
        <Show when={props.parentTitle}>
          <div
            class="text-[10px] uppercase font-bold tracking-wider text-secondary hover:text-accent-primary transition-colors"
            title={`Parent: ${props.parentTitle}`}
          >
            {props.parentTitle} /
          </div>
        </Show>

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

      {/* Blocker Reason */}
      <Show when={props.isBlocked && props.blockerReason}>
        <p class="text-xs text-status-blocked font-medium italic mt-1">
          {props.blockerReason}
        </p>
      </Show>

      {/* Footer: Metadata */}
      <div class="flex items-center justify-between mt-2 pt-2 border-t border-base/50">
        <div class="flex items-center gap-3">
          {/* Subtasks Indicator */}
          <Show when={props.totalSubtasks && props.totalSubtasks > 0}>
            <div
              class="flex items-center gap-1 text-[10px] text-secondary font-mono"
              aria-label={`${props.subtasksCount} of ${props.totalSubtasks} subtasks completed`}
            >
              <Layers size={10} />
              <span>{props.subtasksCount}/{props.totalSubtasks}</span>
            </div>
          </Show>

          {/* Card ID */}
          <span class="text-[10px] font-mono text-tertiary uppercase">
            {props.id}
          </span>
        </div>

        {/* Assignee Avatar Placeholder */}
        <Show when={props.assigneeAvatar} fallback={<div class="w-5 h-5 rounded-full bg-elevated border border-base" />}>
          <img
            src={props.assigneeAvatar}
            alt="Assignee"
            class="w-5 h-5 rounded-full border border-base"
          />
        </Show>
      </div>
    </div>
  );
};

export default Card;
