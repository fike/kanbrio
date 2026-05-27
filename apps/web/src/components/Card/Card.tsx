import { type Component, Show, createSignal, onMount } from 'solid-js';
import { ShieldAlert, Clock, Layers } from 'lucide-solid';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

export type CardState = 'default' | 'blocked' | 'delayed';

export interface CardProps {
  id: string;
  fullId: string; // The UUID
  title: string;
  state?: CardState;
  blockerReason?: string;
  parentTitle?: string;
  subtasksCount?: number;
  totalSubtasks?: number;
  assigneeAvatar?: string;
  onClick?: () => void;
}

const Card: Component<CardProps> = (props) => {
  const isBlocked = () => props.state === 'blocked';
  const isDelayed = () => props.state === 'delayed';
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

  return (
    <div
      ref={el}
      role="listitem"
      tabIndex={0}
      onClick={() => props.onClick?.()}
      class="flex flex-col gap-1 p-3 bg-surface border rounded-md shadow-sm transition-all ease-standard duration-300 focus:ring-2 focus:ring-accent-primary focus:outline-none cursor-pointer"
      classList={{
        'border-base': !props.state || props.state === 'default',
        'border-status-blocked bg-status-blocked/5 ring-1 ring-status-blocked': isBlocked(),
        'border-status-doing/50 bg-status-doing/5': isDelayed(),
        'opacity-50 scale-105 shadow-xl rotate-1': isDragging(),
      }}
      aria-label={`Card: ${props.title}${isBlocked() ? ', Blocked' : ''}${isDelayed() ? ', Delayed' : ''}`}
    >
      {/* Header: Parent Breadcrumb */}
      <Show when={props.parentTitle}>
        <div
          class="text-[10px] uppercase font-bold tracking-wider text-secondary hover:text-accent-primary transition-colors mb-0.5"
          title={`Parent: ${props.parentTitle}`}
        >
          {props.parentTitle} /
        </div>
      </Show>

      {/* Body: Title & Status Icons */}
      <div class="flex justify-between items-start gap-2">
        <h3 class="text-sm font-medium text-primary line-clamp-2 leading-tight">
          {props.title}
        </h3>
        <div class="flex gap-1 shrink-0">
          <Show when={isBlocked()}>
            <ShieldAlert size={14} class="text-status-blocked" aria-hidden="true" />
          </Show>
          <Show when={isDelayed()}>
            <Clock size={14} class="text-status-doing" aria-hidden="true" />
          </Show>
        </div>
      </div>

      {/* Blocker Reason */}
      <Show when={isBlocked() && props.blockerReason}>
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
