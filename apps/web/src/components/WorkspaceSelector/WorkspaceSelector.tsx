import { createSignal, createEffect, Show, For } from 'solid-js';
import { useAuth } from '../AuthProvider';

export function WorkspaceSelector() {
  const auth = useAuth();
  const [isOpen, setIsOpen] = createSignal(false);
  const [search, setSearch] = createSignal('');

  let triggerRef: HTMLButtonElement | undefined;
  let searchInputRef: HTMLInputElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;

  const toggleDropdown = () => {
    setIsOpen(!isOpen());
    setSearch('');
  };

  createEffect(() => {
    if (isOpen()) {
      setTimeout(() => {
        searchInputRef?.focus();
      }, 50);
    }
  });

  const handleSelect = (id: string) => {
    auth.switchWorkspace(id);
    setIsOpen(false);
  };

  const filteredWorkspaces = () => {
    const term = search().toLowerCase();
    return auth.workspaces().filter((w) => w.name.toLowerCase().includes(term));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      const items = dropdownRef?.querySelectorAll('[role="option"]');
      if (items && items.length > 0) {
        const active = document.activeElement;
        const currentIdx = active ? Array.from(items).indexOf(active) : -1;
        const nextIdx = (currentIdx + 1) % items.length;
        (items[nextIdx] as HTMLElement).focus();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      const items = dropdownRef?.querySelectorAll('[role="option"]');
      if (items && items.length > 0) {
        const active = document.activeElement;
        const currentIdx = active ? Array.from(items).indexOf(active) : -1;
        const nextIdx = (currentIdx - 1 + items.length) % items.length;
        (items[nextIdx] as HTMLElement).focus();
      }
      e.preventDefault();
    }
  };

  const handleOptionKeyDown = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleSelect(id);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef?.focus();
      e.preventDefault();
    }
  };

  return (
    <Show
      when={auth.workspaces().length > 0}
      fallback={
        <div
          data-testid="workspace-empty-state"
          class="p-4 border border-dashed border-base rounded-md text-center bg-surface flex flex-col items-center justify-center gap-3"
        >
          <div class="text-xs font-semibold text-primary select-none">
            No Workspaces Available
          </div>
          <div class="text-[11px] text-secondary max-w-[200px] leading-relaxed">
            You are not a member of any workspaces. Create one to get started.
          </div>
          <button
            data-testid="create-workspace-button"
            class="w-full py-1.5 bg-accent-primary text-white text-xs font-medium rounded hover:bg-accent-primary/95 transition-colors focus:ring-2 focus:ring-accent-primary/30"
          >
            Create Workspace
          </button>
        </div>
      }
    >
      <div class="relative w-full">
        <button
          ref={triggerRef}
          data-testid="workspace-selector-trigger"
          role="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen() ? 'true' : 'false'}
          aria-controls="workspace-selector-dropdown"
          onClick={toggleDropdown}
          class="w-full flex items-center justify-between p-2 rounded-md hover:bg-elevated transition-all duration-150 border border-transparent focus:ring-2 focus:ring-accent-primary focus:outline-none cursor-pointer group text-left"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-6 h-6 rounded-md bg-accent-primary/10 text-accent-primary font-mono text-xs flex items-center justify-center flex-shrink-0 font-semibold select-none">
              {auth.activeWorkspace()?.name?.charAt(0).toUpperCase() || 'W'}
            </div>
            <div class="flex flex-col text-left min-w-0">
              <span class="text-sm font-semibold text-primary truncate max-w-[140px]">
                {auth.activeWorkspace()?.name || 'Workspace'}
              </span>
              <span class="text-[10px] text-secondary uppercase font-semibold tracking-wider">
                {auth.activeWorkspace()?.role || 'MEMBER'}
              </span>
            </div>
          </div>
          <svg
            class="w-4 h-4 text-secondary ml-1.5 transition-transform duration-150 group-aria-expanded:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <Show when={isOpen()}>
          <div
            ref={dropdownRef}
            data-testid="workspace-selector-dropdown"
            role="listbox"
            aria-label="Workspace selection"
            onKeyDown={handleKeyDown}
            class="absolute top-full left-0 mt-1 w-64 bg-surface border border-base rounded-md shadow-lg z-50 py-1.5 flex flex-col gap-0.5 origin-top-left transition-all ease-standard duration-150 animate-dropdown-enter"
          >
            <div class="px-2 py-1.5 border-b border-base">
              <input
                ref={searchInputRef}
                data-testid="workspace-search-input"
                type="text"
                placeholder="Filter workspaces..."
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                class="w-full px-2 py-1 text-xs bg-elevated border border-base rounded focus:outline-none focus:ring-1 focus:ring-accent-primary text-primary"
              />
            </div>

            <div class="max-h-60 overflow-y-auto flex flex-col">
              <For
                each={filteredWorkspaces()}
                fallback={
                  <div class="px-3 py-2 text-xs text-secondary text-center">
                    No matching workspaces
                  </div>
                }
              >
                {(ws) => {
                  const isSelected = auth.activeWorkspace()?.id === ws.id;
                  return (
                    <div
                      data-testid={`workspace-option-${ws.id}`}
                      role="option"
                      aria-selected={isSelected ? 'true' : 'false'}
                      tabIndex={0}
                      onClick={() => handleSelect(ws.id)}
                      onKeyDown={(e) => handleOptionKeyDown(e, ws.id)}
                      class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-elevated transition-colors duration-150 select-none cursor-pointer border-l-2 border-transparent focus:outline-none focus:bg-elevated"
                      classList={{
                        'bg-accent-primary/5 font-medium border-l-accent-primary': isSelected,
                      }}
                    >
                      <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-6 h-6 rounded-md bg-accent-primary/10 text-accent-primary font-mono text-xs flex items-center justify-center flex-shrink-0 font-semibold select-none">
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                        <span class="text-sm text-primary truncate max-w-[120px]">
                          {ws.name}
                        </span>
                      </div>

                      <span
                        data-testid={`role-badge-${ws.role}`}
                        class="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase flex-shrink-0"
                        classList={{
                          'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400':
                            ws.role === 'Admin',
                          'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400':
                            ws.role === 'Member',
                          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400':
                            ws.role === 'Viewer',
                        }}
                      >
                        {ws.role}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
