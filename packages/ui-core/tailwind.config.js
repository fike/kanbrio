/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "../../apps/*/src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        base: 'var(--color-bg-base)',
        surface: 'var(--color-bg-surface)',
        elevated: 'var(--color-bg-elevated)',
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        tertiary: 'var(--color-text-tertiary)',
        border: 'var(--color-border-base)',
        accent: {
          primary: 'var(--color-accent-primary)',
        },
        status: {
          todo: 'var(--color-status-todo)',
          doing: 'var(--color-status-doing)',
          done: 'var(--color-status-done)',
          blocked: 'var(--color-status-blocked)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      transitionDuration: {
        'micro': '150ms',
        'standard': '300ms',
        'expressive': '500ms',
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.2, 0, 0, 1)',
        'expressive': 'cubic-bezier(0, 0, 0, 1)',
      }
    },
  },
  plugins: [],
}
