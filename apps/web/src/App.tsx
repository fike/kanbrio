import { type Component } from 'solid-js';
import Board from './components/Board/Board';

const App: Component = () => {
  // Static workspace ID for initial testing (corresponds to seeder/test data)
  const TEST_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';

  return (
    <div class="h-screen flex flex-col">
      <header class="h-14 shrink-0 bg-surface border-b border-base flex items-center justify-between px-6 z-30 shadow-sm">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 bg-accent-primary rounded flex items-center justify-center text-white font-bold text-xs">
            K
          </div>
          <h1 class="text-md font-semibold tracking-tight">Kanbrio</h1>
        </div>

        <nav class="flex items-center gap-4 text-xs font-medium text-secondary">
          <span class="px-2 py-1 bg-elevated rounded border border-base">Board</span>
          <span class="opacity-40">Analytics</span>
          <span class="opacity-40">Settings</span>
        </nav>

        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-elevated border border-base flex items-center justify-center text-[10px] font-bold text-tertiary">
            FI
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-hidden">
        <Board workspaceId={TEST_WORKSPACE_ID} />
      </main>
    </div>
  );
};

export default App;
