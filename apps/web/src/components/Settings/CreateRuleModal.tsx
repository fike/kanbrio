import { createSignal, For, onMount, Show } from 'solid-js';
import { createQuery } from '@tanstack/solid-query';
import { createRule, updateRule, fetchWorkspaceMembers } from '../../api/rules';
import type { BusinessRule } from '../../api/rules';
import { fetchBoardState } from '../../api/board';
import { X } from 'lucide-solid';

interface CreateRuleModalProps {
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
  editRule?: BusinessRule;
}

const TRIGGER_OPTIONS = [
  { value: 'child_status_changed', label: 'Child status changed', desc: 'When a child card moves to a done column' },
  { value: 'card_entered_column', label: 'Card enters column', desc: 'When a card is placed in a specific column' },
] as const;

const ACTION_OPTIONS = [
  { value: 'move_parent_card', label: 'Move parent card', desc: 'Automatically move the parent card' },
  { value: 'assign_card', label: 'Assign card', desc: 'Auto-assign card to a workspace member' },
] as const;

export function CreateRuleModal(props: CreateRuleModalProps) {
  let dialogRef: HTMLDivElement | undefined;
  let nameInputRef: HTMLInputElement | undefined;

  const isEditing = () => !!props.editRule;
  const editData = () => props.editRule;

  const [name, setName] = createSignal(editData()?.name || '');
  const [triggerType, setTriggerType] = createSignal<'child_status_changed' | 'card_entered_column'>(
    (editData()?.trigger_type as 'child_status_changed' | 'card_entered_column') || 'child_status_changed'
  );
  const [actionType, setActionType] = createSignal<'move_parent_card' | 'assign_card'>(
    (editData()?.action_type as 'move_parent_card' | 'assign_card') || 'move_parent_card'
  );
  const [triggerColumnId, setTriggerColumnId] = createSignal(
    typeof editData()?.trigger_config?.column_id === 'string' ? editData()!.trigger_config.column_id as string : ''
  );
  const [doneColumnId, setDoneColumnId] = createSignal(
    typeof editData()?.action_config?.done_column_id === 'string' ? editData()!.action_config.done_column_id as string : ''
  );
  const [inProgressColumnId, setInProgressColumnId] = createSignal(
    typeof editData()?.action_config?.in_progress_column_id === 'string' ? editData()!.action_config.in_progress_column_id as string : ''
  );
  const [assignedUserId, setAssignedUserId] = createSignal(
    typeof editData()?.action_config?.assigned_user_id === 'string' ? editData()!.action_config.assigned_user_id as string : ''
  );
  const [clearAssignee, setClearAssignee] = createSignal(editData()?.action_config?.clear_assignee === true);
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const boardQuery = createQuery(() => ({
    queryKey: ['board', props.workspaceId],
    queryFn: () => fetchBoardState(props.workspaceId),
  }));

  const membersQuery = createQuery(() => ({
    queryKey: ['members', props.workspaceId],
    queryFn: () => fetchWorkspaceMembers(props.workspaceId),
  }));

  const columns = () => boardQuery.data?.columns || [];

  const members = () => membersQuery.data || [];

  onMount(() => {
    nameInputRef?.focus();
  });

  const handleClose = () => {
    props.onClose();
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === dialogRef?.parentElement) {
      handleClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
    if (e.key === 'Tab') {
      const focusable = dialogRef?.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const validate = (): boolean => {
    const trimmed = name().trim();
    if (!trimmed) {
      setError('Rule name is required');
      return false;
    }
    if (trimmed.length > 255) {
      setError('Rule name must be 255 characters or less');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    const triggerConfig: Record<string, unknown> = {};
    if (triggerType() === 'card_entered_column' && triggerColumnId()) {
      triggerConfig.column_id = triggerColumnId();
    }

    const actionConfig: Record<string, unknown> = {};
    if (actionType() === 'move_parent_card') {
      if (doneColumnId()) actionConfig.done_column_id = doneColumnId();
      if (inProgressColumnId()) actionConfig.in_progress_column_id = inProgressColumnId();
    }
    if (actionType() === 'assign_card') {
      if (clearAssignee()) {
        actionConfig.clear_assignee = true;
      } else if (assignedUserId()) {
        actionConfig.assigned_user_id = assignedUserId();
      }
    }

    try {
      const payload = {
        name: name().trim(),
        trigger_type: triggerType(),
        trigger_config: triggerConfig,
        action_type: actionType(),
        action_config: actionConfig,
      };
      if (isEditing()) {
        await updateRule(props.workspaceId, editData()!.id, payload);
      } else {
        await createRule(props.workspaceId, payload);
      }
      props.onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAction = () => actionType();
  const selectedTrigger = () => triggerType();

  return (
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4"
      role="none"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        class="w-full max-w-[480px] p-6 bg-surface border border-base rounded-lg shadow-xl flex flex-col gap-5 relative z-50 animate-modal-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-rule-title"
        onKeyDown={handleKeyDown}
        data-testid="create-rule-dialog"
      >
        {/* Header */}
        <div class="flex items-center justify-between">
          <h2 id="create-rule-title" class="text-lg font-semibold tracking-tight text-primary">
            {isEditing() ? 'Edit Rule' : 'Create Rule'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            class="p-1 text-secondary hover:text-primary rounded-md hover:bg-elevated focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all"
            aria-label="Close create rule dialog"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        {/* Error banner */}
        <Show when={error()}>
          <div
            class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex gap-2 items-start"
            role="alert"
            data-testid="create-rule-error"
            classList={{ 'animate-shake': !!error() }}
          >
            <span>{error()}</span>
          </div>
        </Show>

        {/* Form */}
        <div class="flex flex-col gap-4">
          {/* Rule Name */}
          <div class="flex flex-col gap-1.5">
            <label for="rule-name" class="text-xs font-semibold text-secondary tracking-wide uppercase select-none">
              Rule Name
            </label>
            <input
              ref={nameInputRef}
              id="rule-name"
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g., Auto-close parent when children done"
              disabled={submitting()}
              aria-required="true"
              class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all placeholder:text-tertiary text-primary disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="rule-name-input"
            />
          </div>

          {/* IF — Trigger */}
          <div class="flex flex-col gap-1.5">
            <label for="trigger-type" class="text-xs font-semibold text-secondary tracking-wide uppercase select-none">
              When
            </label>
            <select
              id="trigger-type"
              value={triggerType()}
              onChange={(e) => setTriggerType(e.currentTarget.value as 'child_status_changed' | 'card_entered_column')}
              disabled={submitting()}
              class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all text-primary disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="trigger-type-select"
            >
              <For each={TRIGGER_OPTIONS}>
                {(opt) => (
                  <option value={opt.value}>{opt.label}</option>
                )}
              </For>
            </select>
            <span class="text-[11px] text-tertiary">
              {TRIGGER_OPTIONS.find((o) => o.value === triggerType())?.desc}
            </span>
          </div>

          {/* Trigger config: column selector for card_entered_column */}
          <Show when={selectedTrigger() === 'card_entered_column'}>
            <div class="flex flex-col gap-1.5">
              <label for="trigger-column" class="text-xs font-semibold text-secondary tracking-wide uppercase select-none">
                Target Column
              </label>
              <select
                id="trigger-column"
                value={triggerColumnId()}
                onChange={(e) => setTriggerColumnId(e.currentTarget.value)}
                disabled={submitting()}
                class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all text-primary disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="trigger-column-select"
              >
                <option value="">Select a column...</option>
                <For each={columns()}>
                  {(col) => (
                    <option value={col.id}>{col.title}</option>
                  )}
                </For>
              </select>
            </div>
          </Show>

          {/* THEN — Action */}
          <div class="flex flex-col gap-1.5">
            <label for="action-type" class="text-xs font-semibold text-secondary tracking-wide uppercase select-none">
              Then
            </label>
            <select
              id="action-type"
              value={actionType()}
              onChange={(e) => setActionType(e.currentTarget.value as 'move_parent_card' | 'assign_card')}
              disabled={submitting()}
              class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all text-primary disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="action-type-select"
            >
              <For each={ACTION_OPTIONS}>
                {(opt) => (
                  <option value={opt.value}>{opt.label}</option>
                )}
              </For>
            </select>
            <span class="text-[11px] text-tertiary">
              {ACTION_OPTIONS.find((o) => o.value === actionType())?.desc}
            </span>
          </div>

          {/* Action config: move_parent_card */}
          <Show when={selectedAction() === 'move_parent_card'}>
            <div class="flex flex-col gap-3 p-3 bg-elevated/30 rounded-md border border-base">
              <span class="text-[10px] font-semibold text-secondary uppercase tracking-wider">Move Parent Card Config</span>
              <div class="flex flex-col gap-1.5">
                <label for="done-column" class="text-xs font-semibold text-secondary tracking-wide uppercase select-none">
                  Done Column
                </label>
                <select
                  id="done-column"
                  value={doneColumnId()}
                  onChange={(e) => setDoneColumnId(e.currentTarget.value)}
                  disabled={submitting()}
                  class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all text-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid="done-column-select"
                >
                  <option value="">Select done column...</option>
                  <For each={columns().filter((c) => c.is_done)}>
                    {(col) => (
                      <option value={col.id}>{col.title}</option>
                    )}
                  </For>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="inprogress-column" class="text-xs font-semibold text-secondary tracking-wide uppercase select-none">
                  In Progress Column
                </label>
                <select
                  id="inprogress-column"
                  value={inProgressColumnId()}
                  onChange={(e) => setInProgressColumnId(e.currentTarget.value)}
                  disabled={submitting()}
                  class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all text-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  data-testid="inprogress-column-select"
                >
                  <option value="">Select in progress column...</option>
                  <For each={columns().filter((c) => !c.is_done)}>
                    {(col) => (
                      <option value={col.id}>{col.title}</option>
                    )}
                  </For>
                </select>
              </div>
            </div>
          </Show>

          {/* Action config: assign_card */}
          <Show when={selectedAction() === 'assign_card'}>
            <div class="flex flex-col gap-3 p-3 bg-elevated/30 rounded-md border border-base">
              <span class="text-[10px] font-semibold text-secondary uppercase tracking-wider">Assign Card Config</span>
              <div class="flex items-center gap-2">
                <input
                  id="clear-assignee"
                  type="checkbox"
                  checked={clearAssignee()}
                  onChange={(e) => setClearAssignee(e.currentTarget.checked)}
                  disabled={submitting()}
                  class="w-4 h-4 rounded border-base text-accent-primary focus:ring-accent-primary"
                  data-testid="clear-assignee-checkbox"
                />
                <label for="clear-assignee" class="text-xs font-medium text-secondary select-none">
                  Clear assignee instead
                </label>
              </div>
              <Show when={!clearAssignee()}>
                <div class="flex flex-col gap-1.5">
                  <label for="assigned-user" class="text-xs font-semibold text-secondary tracking-wide uppercase select-none">
                    Assign to
                  </label>
                  <select
                    id="assigned-user"
                    value={assignedUserId()}
                    onChange={(e) => setAssignedUserId(e.currentTarget.value)}
                    disabled={submitting()}
                    class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all text-primary disabled:opacity-60 disabled:cursor-not-allowed"
                    data-testid="assigned-user-select"
                  >
                    <option value="">Select a member...</option>
                    <For each={members()}>
                      {(member) => (
                        <option value={member.id}>{member.name}</option>
                      )}
                    </For>
                  </select>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="flex items-center justify-end gap-3 pt-1 border-t border-base">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting()}
            class="px-4 py-2 border border-base rounded-md text-sm font-medium text-secondary bg-surface hover:bg-elevated hover:text-primary focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="create-rule-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting()}
            class="px-4 py-2 bg-accent-primary hover:bg-accent-primary/95 text-white rounded-md text-sm font-medium focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="create-rule-submit"
          >
            <Show
              when={!submitting()}
              fallback={
                <>
                  <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isEditing() ? 'Saving...' : 'Creating...'}
                </>
              }
            >
              {isEditing() ? 'Save Changes' : 'Create Rule'}
            </Show>
          </button>
        </div>
      </div>
    </div>
  );
}
