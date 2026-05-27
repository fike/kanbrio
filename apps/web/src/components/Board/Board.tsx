import { type Component, For, Show, createMemo, createSignal, onMount, type JSX } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { fetchBoardState, moveCard, type BoardState } from '../../api/board';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import Card from '../Card/Card';

interface BoardProps {
  workspaceId: string;
}

const ColumnZone: Component<{
  columnId: string,
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
      class="w-[300px] min-h-[150px] p-2 border-r border-base last:border-r-0 flex flex-col gap-2 transition-colors duration-200"
      classList={{ 'bg-accent-primary/5 border-dashed border-accent-primary/30': isOver() }}
    >
      {props.children}
    </div>
  );
};

const Board: Component<BoardProps> = (props) => {
  const queryClient = useQueryClient();

  const query = createQuery(() => ({
    queryKey: ['board', props.workspaceId],
    queryFn: () => fetchBoardState(props.workspaceId),
  }));

  const mutation = createMutation(() => ({
    mutationFn: (data: { cardId: string, toColumnId: string, toSwimlaneId: string }) =>
      moveCard(props.workspaceId, data.cardId, data.toColumnId, data.toSwimlaneId),
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
    onError: (err, _newData, context) => {
      queryClient.setQueryData(['board', props.workspaceId], context?.previousState);
      if (err instanceof Error && err.message === 'WIP_LIMIT_EXCEEDED') {
        alert('WIP Limit Exceeded for this column!');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board', props.workspaceId] });
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
            {(column) => (
              <div class="w-[300px] p-3 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-primary truncate">
                  {column.title}
                </h3>
                <Show when={column.wip_limit}>
                  <span class="text-[10px] px-1.5 py-0.5 bg-elevated rounded border border-base text-tertiary">
                    WIP: {column.wip_limit}
                  </span>
                </Show>
              </div>
            )}
          </For>
        </div>

        {/* Board Content: Swimlanes and Cards */}
        <div class="flex-1 overflow-auto">
          <div class="min-w-max">
            <For each={sortedSwimlanes()}>
              {(swimlane) => (
                <div class="flex flex-col">
                  {/* Swimlane Header */}
                  <div class="h-8 flex items-center sticky left-0 z-10 bg-elevated/50 border-y border-base px-2">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-secondary">
                      {swimlane.title}
                    </span>
                  </div>

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
                          swimlaneId={swimlane.id}
                          workspaceId={props.workspaceId}
                          onDrop={(cardId) => mutation.mutate({ cardId, toColumnId: column.id, toSwimlaneId: swimlane.id })}
                        >
                          <For each={query.data!.cards.filter(c => c.current_column_id === column.id && c.current_swimlane_id === swimlane.id)}>
                            {(card) => (
                              <Card
                                id={card.id.split('-')[0]}
                                fullId={card.id}
                                title={card.title}
                                state="default"
                              />
                            )}
                          </For>
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
    </div>
  );
};

export default Board;
