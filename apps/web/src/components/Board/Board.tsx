import { type Component, For, Show, createMemo, createSignal, onMount, type JSX } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { fetchBoardState, moveCard, blockCard, unblockCard, updateChecklistItem, type BoardState } from '../../api/board';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Shield } from 'lucide-solid';
import Card from '../Card/Card';
import CardHistory from '../CardHistory/CardHistory';
import BlockerDrawer from '../Drawer/BlockerDrawer';
import { useAuth } from '../AuthProvider';
import { InlineCardForm } from './InlineCardForm';

interface BoardProps {
  workspaceId: string;
}

const ColumnZone: Component<{
  columnId: string,
  columnTitle: string,
  swimlaneId: string,
  workspaceId: string,
  children: JSX.Element,
  onDrop: (cardId: string) => void
}> = (props) => {
  const [isOver, setIsOver] = createSignal(false);
  let el!: HTMLDivElement;

  onMount(() => {
    return dropTargetForElements({
      element: el,
      getData: () => ({ columnId: props.columnId, swimlaneId: props.swimlaneId }),
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: (args) => {
        setIsOver(false);
        const data = args.source.data;
        if (data.type === 'card' && typeof data.id === 'string') {
          props.onDrop(data.id);
        }
      },
    });
  });

  return (
    <div
      ref={el}
      data-testid={`column-zone-${props.columnTitle}`}
      class="w-[300px] min-h-[150px] p-2 border-r border-base last:border-r-0 flex flex-col gap-2 transition-colors duration-200"

      classList={{ 'bg-accent-primary/5 border-dashed border-accent-primary/30': isOver() }}
    >
      {props.children}
    </div>
  );
};

const Board: Component<BoardProps> = (props) => {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const userId = () => auth?.currentUser()?.id;

  const [selectedCardId, setSelectedCardId] = createSignal<string | null>(null);
  const [blockerDrawerCardId, setBlockerDrawerCardId] = createSignal<string | null>(null);
  const [shakingCardId, setShakingCardId] = createSignal<string | null>(null);
  const [toast, setToast] = createSignal<{ message: string; visible: boolean } | null>(null);
  const [activeIntersection, setActiveIntersection] = createSignal<{ columnId: string; swimlaneId: string } | null>(null);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
    }, 4000);
  };

  const handleCancelForm = (columnId: string, swimlaneId: string) => {
    setActiveIntersection(null);
    setTimeout(() => {
      const triggerBtn = document.querySelector(`[data-testid="column-add-card-button-${columnId}-${swimlaneId}"]`) as HTMLButtonElement | null;
      triggerBtn?.focus();
    }, 50);
  };

  const query = createQuery(() => ({
    queryKey: ['board', props.workspaceId],
    queryFn: () => fetchBoardState(props.workspaceId),
  }));

  const toggleChecklistMutation = createMutation(() => ({
    mutationFn: (data: { cardId: string; checklistId: string; isCompleted: boolean }) =>
      updateChecklistItem(props.workspaceId, data.cardId, data.checklistId, {
        is_completed: data.isCompleted,
        completed_by: data.isCompleted ? userId() : null,
      }),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['board', props.workspaceId] });
      const previousState = queryClient.getQueryData<BoardState>(['board', props.workspaceId]);

      queryClient.setQueryData<BoardState>(['board', props.workspaceId], (old) => {
        if (!old) return old;
        return {
          ...old,
          checklists: old.checklists.map((item) =>
            item.id === newData.checklistId
              ? { ...item, is_completed: newData.isCompleted, completed_by: newData.isCompleted ? userId() || null : null }
              : item
          ),
        };
      });

      return { previousState };
    },
    onError: (_err, _newData, context) => {
      queryClient.setQueryData(['board', props.workspaceId], context?.previousState);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board', props.workspaceId] });
    },
  }));

  const mutation = createMutation(() => ({
    mutationFn: (data: { cardId: string, toColumnId: string, toSwimlaneId: string }) =>
      moveCard(props.workspaceId, data.cardId, data.toColumnId, data.toSwimlaneId, userId(), false),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['board', props.workspaceId] });
      const previousState = queryClient.getQueryData<BoardState>(['board', props.workspaceId]);

      queryClient.setQueryData<BoardState>(['board', props.workspaceId], (old) => {
        if (!old) return old;
        return {
          ...old,
          cards: old.cards.map((c) =>
            c.id === newData.cardId
              ? { ...c, current_column_id: newData.toColumnId, current_swimlane_id: newData.toSwimlaneId }
              : c
          ),
        };
      });

      return { previousState };
    },
    onError: async (err, newData, context) => {
      queryClient.setQueryData(['board', props.workspaceId], context?.previousState);
      if (err instanceof Error) {
        console.error('[Mutation Error]', err.message, err);
        const isWip = err.message.includes('WIP limit') || err.message === 'WIP_LIMIT_EXCEEDED';
        const isRuleViolation = err.message.includes('Rule violation') || err.message === 'RULE_VIOLATION';
        const isBlocked = err.message === 'CARD_IS_BLOCKED';

        if (isBlocked) {
          setShakingCardId(newData.cardId);
          setTimeout(() => setShakingCardId(null), 500);
          showToast('Card is blocked and cannot be moved!');
        } else if (isWip) {
          setShakingCardId(newData.cardId);
          setTimeout(() => setShakingCardId(null), 300);
          showToast(err.message === 'WIP_LIMIT_EXCEEDED' ? 'WIP Limit Exceeded!' : err.message);
        } else if (isRuleViolation) {
          setShakingCardId(newData.cardId);
          setTimeout(() => setShakingCardId(null), 300);
          showToast(err.message === 'RULE_VIOLATION' ? 'Rule Violation!' : err.message);

          const confirmOverride = confirm('Rule violation occurred. Do you want to attempt an Admin override?');
          if (confirmOverride) {
            const reason = prompt('Enter a justification for this override:');
            if (reason) {
              try {
                await moveCard(
                  props.workspaceId,
                  newData.cardId,
                  newData.toColumnId,
                  newData.toSwimlaneId,
                  userId(),
                  true,
                  reason
                );
                queryClient.invalidateQueries({ queryKey: ['board', props.workspaceId] });
                showToast('Admin override successful!');
              } catch (overrideErr) {
                if (overrideErr instanceof Error) {
                  showToast(`Override failed: ${overrideErr.message}`);
                } else {
                  showToast('Override failed!');
                }
              }
            }
          }
        } else {
          showToast(err.message);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board', props.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['card-history'] });
    },
  }));

  const blockMutation = createMutation(() => ({
    mutationFn: (data: { cardId: string, reason: string }) =>
      blockCard(props.workspaceId, data.cardId, data.reason),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['board', props.workspaceId] });
      const previousState = queryClient.getQueryData<BoardState>(['board', props.workspaceId]);

      queryClient.setQueryData<BoardState>(['board', props.workspaceId], (old) => {
        if (!old) return old;
        return {
          ...old,
          cards: old.cards.map((c) =>
            c.id === newData.cardId
              ? { ...c, is_blocked: true }
              : c
          ),
        };
      });

      return { previousState };
    },
    onError: (_err, _newData, context) => {
      queryClient.setQueryData(['board', props.workspaceId], context?.previousState);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board', props.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['card-history'] });
    },
  }));

  const unblockMutation = createMutation(() => ({
    mutationFn: (cardId: string) =>
      unblockCard(props.workspaceId, cardId),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['board', props.workspaceId] });
      const previousState = queryClient.getQueryData<BoardState>(['board', props.workspaceId]);

      queryClient.setQueryData<BoardState>(['board', props.workspaceId], (old) => {
        if (!old) return old;
        return {
          ...old,
          cards: old.cards.map((c) =>
            c.id === newData
              ? { ...c, is_blocked: false }
              : c
          ),
        };
      });

      return { previousState };
    },
    onError: (_err, _newData, context) => {
      queryClient.setQueryData(['board', props.workspaceId], context?.previousState);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board', props.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['card-history'] });
    },
  }));

  const sortedColumns = createMemo(() =>
    [...(query.data?.columns || [])].sort((a, b) => a.position - b.position)
  );

  const sortedSwimlanes = createMemo(() =>
    [...(query.data?.swimlanes || [])].sort((a, b) => a.position - b.position)
  );

  return (
    <div class="flex flex-col h-full overflow-hidden bg-base">
      <Show when={query.isLoading}>
        <div class="flex items-center justify-center h-full text-secondary animate-pulse">
          Loading Board...
        </div>
      </Show>

      <Show when={query.isError}>
        <div class="flex items-center justify-center h-full text-status-blocked">
          Error loading board state.
        </div>
      </Show>

      <Show when={query.isSuccess && query.data}>
        {/* Header Row: Column Titles */}
        <div class="flex min-w-max sticky top-0 z-20 bg-base/95 backdrop-blur-sm border-b border-base">
          {/* Spacer for Swimlane headers */}
          <div class="w-12 shrink-0 border-r border-base" />

          <For each={sortedColumns()}>
            {(column) => {
              const columnCardsCount = () => query.data?.cards.filter(c => c.current_column_id === column.id).length || 0;
              const isAtLimit = () => column.wip_limit !== null && columnCardsCount() === column.wip_limit;
              const isExceeded = () => column.wip_limit !== null && columnCardsCount() > column.wip_limit;

              return (
                <div
                  class="w-[300px] p-3 flex items-center justify-between transition-colors duration-200 border-r border-base/50 last:border-r-0"
                  classList={{
                    'bg-orange-50': isAtLimit(),
                    'bg-red-50': isExceeded(),
                  }}
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <h3
                      class="text-sm font-semibold truncate"
                      classList={{
                        'text-primary': !isAtLimit() && !isExceeded(),
                        'text-orange-500': isAtLimit(),
                        'text-red-500': isExceeded(),
                      }}
                    >
                      {column.title}
                    </h3>
                    <Show when={query.data?.transition_rules.some(r => r.column_id === column.id)}>
                      <span title="Active Column Transition Rules" class="inline-flex shrink-0">
                        <Shield size={12} data-testid={`column-rule-indicator-${column.id}`} class="text-secondary/60" />
                      </span>
                    </Show>
                  </div>
                  <Show when={column.wip_limit !== null}>
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded border"
                      classList={{
                        'bg-elevated border-base text-tertiary': !isAtLimit() && !isExceeded(),
                        'bg-orange-100 border-orange-200 text-orange-600': isAtLimit(),
                        'bg-red-100 border-red-200 text-red-600': isExceeded(),
                      }}
                    >
                      WIP {columnCardsCount()} / {column.wip_limit}
                    </span>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        {/* Board Content: Swimlanes and Cards */}
        <div class="flex-1 overflow-auto">
          <div class="min-w-max">
            <For each={sortedSwimlanes()}>
              {(swimlane) => (
                <div class="flex flex-col">
                  {/* Swimlane Header */}
                  {(() => {
                    const swimlaneCardsCount = () => query.data?.cards.filter(c => c.current_swimlane_id === swimlane.id).length || 0;
                    const isLaneAtLimit = () => swimlane.wip_limit !== null && swimlane.wip_limit !== undefined && swimlaneCardsCount() === swimlane.wip_limit;
                    const isLaneExceeded = () => swimlane.wip_limit !== null && swimlane.wip_limit !== undefined && swimlaneCardsCount() > swimlane.wip_limit;

                    return (
                      <div
                        class="h-8 flex items-center justify-between sticky left-0 z-10 border-y border-base px-2 transition-colors duration-200"
                        classList={{
                          'bg-elevated/50': swimlane.wip_limit === null || swimlane.wip_limit === undefined || (!isLaneAtLimit() && !isLaneExceeded()),
                          'bg-orange-50': isLaneAtLimit(),
                          'bg-red-50': isLaneExceeded(),
                        }}
                      >
                        <span
                          class="text-[10px] font-bold uppercase tracking-widest"
                          classList={{
                            'text-secondary': swimlane.wip_limit === null || swimlane.wip_limit === undefined || (!isLaneAtLimit() && !isLaneExceeded()),
                            'text-orange-500': isLaneAtLimit(),
                            'text-red-500': isLaneExceeded(),
                          }}
                        >
                          {swimlane.title}
                        </span>
                        <Show when={swimlane.wip_limit !== null && swimlane.wip_limit !== undefined}>
                          <span
                            class="text-[9px] px-1.5 py-0.25 rounded border font-bold"
                            classList={{
                              'bg-elevated border-base text-tertiary': !isLaneAtLimit() && !isLaneExceeded(),
                              'bg-orange-100 border-orange-200 text-orange-600': isLaneAtLimit(),
                              'bg-red-100 border-red-200 text-red-600': isLaneExceeded(),
                            }}
                          >
                            WIP {swimlaneCardsCount()} / {swimlane.wip_limit}
                          </span>
                        </Show>
                      </div>
                    );
                  })()}

                  {/* Swimlane Content (Columns intersection) */}
                  <div class="flex">
                    {/* Swimlane Vertical Label Spacer */}
                    <div class="w-12 shrink-0 border-r border-base bg-elevated/20 flex items-center justify-center">
                      <span class="rotate-180 [writing-mode:vertical-lr] text-[8px] font-bold text-tertiary uppercase">
                        {swimlane.title}
                      </span>
                    </div>

                    <For each={sortedColumns()}>
                      {(column) => (
                        <ColumnZone
                          columnId={column.id}
                          columnTitle={column.title}
                          swimlaneId={swimlane.id}
                          workspaceId={props.workspaceId}
                          onDrop={(cardId) => mutation.mutate({ cardId, toColumnId: column.id, toSwimlaneId: swimlane.id })}
                        >
                          <div class="flex flex-col gap-2 flex-1 overflow-y-auto">
                            <For each={query.data!.cards.filter(c => c.current_column_id === column.id && c.current_swimlane_id === swimlane.id)}>
                              {(card) => {
                                const subtasks = () => query.data!.cards.filter(c => c.parent_id === card.id);
                                const totalSub = () => subtasks().length;
                                const completedSub = () => subtasks().filter(c => {
                                  const col = query.data!.columns.find(col => col.id === c.current_column_id);
                                  return col?.is_done || false;
                                }).length;

                                return (
                                  <Card
                                    id={card.id.split('-')[0]}
                                    fullId={card.id}
                                    title={card.title}
                                    isBlocked={card.is_blocked}
                                    blockerReason={card.blocked_reason || undefined}
                                    isShaking={shakingCardId() === card.id}
                                    subtasksCount={completedSub()}
                                    totalSubtasks={totalSub()}
                                    checklists={query.data!.checklists.filter(c => c.card_id === card.id)}
                                    onToggleChecklist={(checklistId) => {
                                      const item = query.data!.checklists.find(c => c.id === checklistId);
                                      if (item) {
                                        toggleChecklistMutation.mutate({ cardId: card.id, checklistId, isCompleted: !item.is_completed });
                                      }
                                    }}
                                    onBlock={(reason) => blockMutation.mutate({ cardId: card.id, reason })}
                                    onUnblock={() => unblockMutation.mutate(card.id)}
                                    onClick={() => setSelectedCardId(card.id)}
                                    onOpenBlockerDrawer={() => setBlockerDrawerCardId(card.id)}
                                  />
                                );
                              }}
                            </For>
                          </div>

                          <Show
                            when={
                              activeIntersection()?.columnId === column.id &&
                              activeIntersection()?.swimlaneId === swimlane.id
                            }
                            fallback={
                              <button
                                type="button"
                                class="text-secondary font-medium hover:text-accent-primary flex items-center gap-1.5 p-2 rounded-md hover:bg-elevated transition-colors w-full justify-start border border-transparent focus:ring-2 focus:ring-accent-primary focus:outline-none shrink-0"
                                data-testid={`column-add-card-button-${column.id}-${swimlane.id}`}
                                aria-label="Add new card to column"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveIntersection({ columnId: column.id, swimlaneId: swimlane.id });
                                }}
                              >
                                <svg class="w-4.5 h-4.5 text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Add Card</span>
                              </button>
                            }
                          >
                            <div class="shrink-0">
                              <InlineCardForm
                                columnId={column.id}
                                swimlaneId={swimlane.id}
                                workspaceId={props.workspaceId}
                                onSuccess={() => {
                                  setActiveIntersection(null);
                                }}
                                onCancel={() => handleCancelForm(column.id, swimlane.id)}
                                showToast={showToast}
                              />
                            </div>
                          </Show>
                        </ColumnZone>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Card History Sidebar */}
      <Show when={selectedCardId()}>
        <div data-testid="card-history-sidebar" class="fixed inset-y-0 right-0 w-96 bg-surface shadow-2xl border-l border-base z-50 flex flex-col animate-in slide-in-from-right duration-300">
          <div class="flex justify-between items-center p-4 border-b border-base bg-elevated/20">
            <h2 class="text-sm font-bold uppercase tracking-widest text-primary">Card History</h2>
            <button
              onClick={() => setSelectedCardId(null)}
              class="p-1 rounded-full hover:bg-base/50 text-secondary hover:text-primary transition-colors"
            >
              ✕
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            <CardHistory
              workspaceId={props.workspaceId}
              cardId={selectedCardId()!}
            />
          </div>
        </div>
      </Show>

      {/* Blocker Detail Drawer */}
      <Show when={blockerDrawerCardId()}>
        {(() => {
          const card = query.data?.cards.find(c => c.id === blockerDrawerCardId());
          return (
            <Show when={card}>
              <BlockerDrawer
                workspaceId={props.workspaceId}
                cardId={card!.id}
                cardTitle={card!.title}
                blockedAt={card!.blocked_at}
                blockedBy={card!.blocked_by}
                blockerReason={card!.blocked_reason}
                onClose={() => setBlockerDrawerCardId(null)}
              />
            </Show>
          );
        })()}
      </Show>

      {/* Toast Notification for errors */}
      <Show when={toast()?.visible}>
        <div data-testid="rule-violation-toast" class="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-surface border border-status-blocked border-l-4 shadow-xl p-4 rounded-md animate-in fade-in slide-in-from-bottom duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-status-blocked shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="text-sm font-medium text-primary">{toast()?.message}</span>
        </div>
      </Show>
    </div>
  );
};

export default Board;
