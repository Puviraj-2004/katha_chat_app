import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0084FF",
          accent: "#00D2FF",
          darkNavy: "#0B1736",
        },
        dark: {
          bg: "#080D1A",
          surface: "#10192D",
          border: "#1B2A4A",
          bubble: "#16223D",
        },
        light: {
          bg: "#F8FAFC",
          surface: "#FFFFFF",
          border: "#E2E8F0",
          bubble: "#F1F5F9",
        },
      },
    },
  },
  plugins: [],
};
export default config;