import type { Config } from "tailwindcss";

const config: Config = {
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        zeiq: {
          black: "#0a0a0a",
          dark: "#141414",
          charcoal: "#202020",
          surface: "#ffffff",
          light: "#f4f5f7",
          muted: "#e2e5e9",
          slate: "#64748b",
          orange: {
            DEFAULT: "#ff9600",
            hover: "#e68500",
            active: "#cc7700",
            light: "#fff7ed",
            border: "#fed7aa",
          },
          whatsapp: {
            DEFAULT: "#16a34a",
            hover: "#15803d",
          },
        },
      },
      fontFamily: {
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
