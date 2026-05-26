import type { Component } from 'solid-js';
import Card from './components/Card/Card';

const App: Component = () => {
  return (
    <div class="min-h-screen bg-base text-primary p-8">
      <header class="mb-12 text-center">
        <h1 class="text-4xl font-bold tracking-tight text-accent-primary mb-2">
          Kanbrio UI Showroom
        </h1>
        <p class="text-secondary text-lg">
          Visual verification of core components
        </p>
      </header>
      
      <main class="max-w-4xl mx-auto">
        <section class="mb-12">
          <h2 class="text-xl font-semibold mb-6 border-b border-base pb-2">
            Card Component States
          </h2>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Default State */}
            <div class="space-y-2">
              <h4 class="text-xs uppercase text-tertiary font-bold">Default</h4>
              <Card 
                id="KNB-1" 
                title="Implement user authentication logic with JWT" 
                parentTitle="Security Epic"
                subtasksCount={3}
                totalSubtasks={5}
              />
            </div>

            {/* Blocked State */}
            <div class="space-y-2">
              <h4 class="text-xs uppercase text-tertiary font-bold">Blocked</h4>
              <Card 
                id="KNB-2" 
                title="Database migration for the new board schema" 
                state="blocked"
                blockerReason="Awaiting SRE approval"
                parentTitle="Infrastructure"
              />
            </div>

            {/* Delayed State */}
            <div class="space-y-2">
              <h4 class="text-xs uppercase text-tertiary font-bold">Delayed</h4>
              <Card 
                id="KNB-3" 
                title="Update README documentation with setup guides" 
                state="delayed"
                subtasksCount={0}
                totalSubtasks={2}
              />
            </div>
          </div>
        </section>

        <section class="mb-12">
          <h2 class="text-xl font-semibold mb-6 border-b border-base pb-2">
            Component Specs (DESIGN.md Alignment)
          </h2>
          <div class="bg-surface border border-base rounded-lg p-6 space-y-4 text-sm text-secondary">
            <p>✅ <strong>Motion:</strong> Cards use <code>ease-standard</code> (cubic-bezier) and 300ms duration on hover/state change.</p>
            <p>✅ <strong>Typography:</strong> Titles use <code>font-medium</code>, IDs use <code>font-mono</code> (JetBrains Mono).</p>
            <p>✅ <strong>Acessibilidade:</strong> Focus rings and ARIA labels are active.</p>
          </div>
        </section>
      </main>
      
      <footer class="mt-16 text-center text-tertiary text-xs">
        Kanbrio Open Source Project • Cycle 2
      </footer>
    </div>
  );
};

export default App;
