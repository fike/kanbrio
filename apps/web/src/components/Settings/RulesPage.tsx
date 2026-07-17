import { createSignal, Show } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { fetchRules, updateRule, deleteRule } from '../../api/rules';
import type { BusinessRule } from '../../api/rules';
import { RulesList } from './RulesList';
import { CreateRuleModal } from './CreateRuleModal';
import { Plus } from 'lucide-solid';

interface RulesPageProps {
  workspaceId: string;
}

export function RulesPage(props: RulesPageProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [editingRule, setEditingRule] = createSignal<BusinessRule | null>(null);
  const [confirmDelete, setConfirmDelete] = createSignal<BusinessRule | null>(null);

  const rulesQuery = createQuery(() => ({
    queryKey: ['rules', props.workspaceId],
    queryFn: () => fetchRules(props.workspaceId),
  }));

  const toggleMutation = createMutation(() => ({
    mutationFn: ({ rule, is_active }: { rule: BusinessRule; is_active: boolean }) =>
      updateRule(props.workspaceId, rule.id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', props.workspaceId] });
    },
  }));

  const deleteMutation = createMutation(() => ({
    mutationFn: (rule: BusinessRule) => deleteRule(props.workspaceId, rule.id),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['rules', props.workspaceId] });
    },
  }));

  const handleEdit = (rule: BusinessRule) => {
    setEditingRule(rule);
    setShowCreateModal(true);
  };

  const handleToggle = (rule: BusinessRule) => {
    toggleMutation.mutate({ rule, is_active: !rule.is_active });
  };

  const handleDelete = (rule: BusinessRule) => {
    if (confirmDelete()?.id === rule.id) {
      deleteMutation.mutate(rule);
    } else {
      setConfirmDelete(rule);
    }
  };

  const cancelDelete = () => setConfirmDelete(null);

  return (
    <div class="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <h2 class="text-lg font-semibold tracking-tight text-primary">Automation Rules</h2>
          <p class="text-xs text-secondary">
            Define conditions and actions to automate your board workflow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          class="px-4 py-2 bg-accent-primary hover:bg-accent-primary/95 text-white rounded-md text-sm font-medium focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all flex items-center gap-1.5"
          data-testid="create-rule-button"
        >
          <Plus class="w-4 h-4" />
          Create Rule
        </button>
      </div>

      <Show when={confirmDelete()}>
        {(rule) => (
          <div
            class="bg-surface border border-status-blocked/30 border-l-4 border-l-status-blocked rounded-md px-4 py-3 flex items-center justify-between gap-4 animate-shake"
            role="alert"
            data-testid="delete-confirm-banner"
          >
            <span class="text-xs text-primary font-medium">
              Delete rule <span class="font-mono">&ldquo;{rule().name}&rdquo;</span>? This cannot be undone.
            </span>
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={cancelDelete}
                class="px-3 py-1.5 border border-base rounded-md text-xs font-medium text-secondary hover:bg-elevated focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(rule())}
                disabled={deleteMutation.isPending}
                class="px-3 py-1.5 bg-status-blocked hover:bg-red-600 text-white rounded-md text-xs font-medium focus:ring-2 focus:ring-status-blocked/50 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                data-testid="confirm-delete-button"
              >
                <Show
                  when={!deleteMutation.isPending}
                  fallback={<span class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                >
                  Delete
                </Show>
              </button>
            </div>
          </div>
        )}
      </Show>

      <RulesList
        rules={rulesQuery.data}
        loading={rulesQuery.isLoading}
        error={rulesQuery.error as Error | null}
        togglingId={null}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onCreateClick={() => {
          setEditingRule(null);
          setShowCreateModal(true);
        }}
      />

      <Show when={showCreateModal()}>
        <CreateRuleModal
          workspaceId={props.workspaceId}
          editRule={editingRule() || undefined}
          onClose={() => {
            setShowCreateModal(false);
            setEditingRule(null);
          }}
          onCreated={() => {
            setShowCreateModal(false);
            setEditingRule(null);
            queryClient.invalidateQueries({ queryKey: ['rules', props.workspaceId] });
          }}
        />
      </Show>
    </div>
  );
}
