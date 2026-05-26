import { type Component, For, Show, createMemo } from 'solid-js';
import { createQuery } from '@tanstack/solid-query';
import { fetchBoardState } from '../../api/board';
import Card from '../Card/Card';

interface BoardProps {
  workspaceId: string;
}

const Board: Component<BoardProps> = (props) => {
  const query = createQuery(() => ({
    queryKey: ['board', props.workspaceId],
    queryFn: () => fetchBoardState(props.workspaceId),
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
                        <div class="w-[300px] min-h-[150px] p-2 border-r border-base last:border-r-0 flex flex-col gap-2">
                          <For each={query.data!.cards.filter(c => c.current_column_id === column.id && c.current_swimlane_id === swimlane.id)}>
                            {(card) => (
                              <Card 
                                id={card.id.split('-')[0]} 
                                title={card.title}
                                // Mocking state for now as it's not in DB yet
                                state="default"
                              />
                            )}
                          </For>
                        </div>
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
