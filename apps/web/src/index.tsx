import { render } from 'solid-js/web';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { Router } from '@solidjs/router';
import App, { AppRoutes } from './App';
import './index.css';

const queryClient = new QueryClient();

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id is wrong?',
  );
}

render(
  () => (
    <Router root={App}>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
      </QueryClientProvider>
    </Router>
  ),
  root!,
);
