import type { Component } from 'solid-js';

const App: Component = () => {
  return (
    <div class="min-h-screen bg-base text-primary flex flex-col items-center justify-center p-4">
      <header class="mb-8 text-center">
        <h1 class="text-4xl font-bold tracking-tight text-accent-primary mb-2">
          Kanbrio
        </h1>
        <p class="text-secondary text-lg">
          The Enterprise-Grade Reactive Kanban
        </p>
      </header>
      
      <main class="w-full max-w-md bg-surface border border-base rounded-lg shadow-sm p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-3 h-3 rounded-full bg-status-doing animate-pulse"></div>
          <h2 class="text-xl font-medium">Ciclo 2: The Reactive Board</h2>
        </div>
        
        <p class="text-secondary mb-6">
          Fundação de Frontend inicializada com sucesso usando <span class="font-mono text-accent-primary">SolidJS</span> e <span class="font-mono text-accent-primary">Tailwind CSS</span>.
        </p>
        
        <div class="flex flex-col gap-2">
          <div class="p-3 bg-elevated rounded border border-base text-sm">
            ✅ Workspace inicializado
          </div>
          <div class="p-3 bg-elevated rounded border border-base text-sm">
            ✅ Design Tokens integrados
          </div>
          <div class="p-3 bg-elevated rounded border border-base text-sm opacity-50">
            ⏳ Próximo: Componente de Card
          </div>
        </div>
      </main>
      
      <footer class="mt-8 text-tertiary text-xs">
        Kanbrio Open Source Project
      </footer>
    </div>
  );
};

export default App;
