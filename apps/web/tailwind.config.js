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
        },
        wsPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.85)' }
        },
        wsPop: {
          '0%': { opacity: '0', transform: 'scale(0.7)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        wsPopOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.7)' }
        },
        wsCardFlash: {
          '0%': { boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.3)', backgroundColor: 'rgba(37, 99, 235, 0.05)' },
          '100%': { boxShadow: '0 0 0 0px rgba(37, 99, 235, 0)', backgroundColor: 'rgba(37, 99, 235, 0)' }
        },
        wsBadgePulse: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' }
        },
        wsSlideDown: {
          '0%': { maxHeight: '0', opacity: '0' },
          '100%': { maxHeight: '48px', opacity: '1' }
        },
        wsSlideUp: {
          '0%': { maxHeight: '48px', opacity: '1' },
          '100%': { maxHeight: '0', opacity: '0' }
        }
      },
      animation: {
        'shake': 'shake 0.3s cubic-bezier(.36,.07,.19,.97) both',
        'shimmer-fast': 'shimmer 1.5s linear infinite',
        'dropdown-enter': 'dropdownEnter 0.15s cubic-bezier(0.2, 0, 0, 1) forwards',
        'ws-pulse': 'wsPulse 1.5s ease-in-out infinite',
        'ws-pop': 'wsPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'ws-pop-out': 'wsPopOut 0.2s ease-in forwards',
        'ws-card-flash': 'wsCardFlash 0.8s ease-out forwards',
        'ws-badge-pulse': 'wsBadgePulse 0.4s ease-in-out both',
        'ws-slide-down': 'wsSlideDown 0.3s ease-standard forwards',
        'ws-slide-up': 'wsSlideUp 0.3s ease-standard forwards'
      }
    },
  },
}
