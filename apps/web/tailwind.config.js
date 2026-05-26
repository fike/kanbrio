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
    },
  },
}
