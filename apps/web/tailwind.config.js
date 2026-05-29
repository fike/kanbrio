/** @type {import('tailwindcss').Config} */
import baseConfig from "../../packages/ui-core/tailwind.config.js";

export default {
  ...baseConfig,
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme.extend,
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        },
        dropdownEnter: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
        }
      },
      animation: {
        'shake': 'shake 0.3s cubic-bezier(.36,.07,.19,.97) both',
        'shimmer-fast': 'shimmer 1.5s linear infinite',
        'dropdown-enter': 'dropdownEnter 0.15s cubic-bezier(0.2, 0, 0, 1) forwards'
      }
    },
  },
}
