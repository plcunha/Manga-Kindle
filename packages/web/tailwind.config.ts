import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f0f0f",
          50: "#1a1a1a",
          100: "#242424",
          200: "#2e2e2e",
          300: "#383838",
        },
        accent: {
          DEFAULT: "#f97316",
          hover: "#fb923c",
          muted: "#c2410c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
