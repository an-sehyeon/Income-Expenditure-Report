import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./types/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        app: {
          background: "#f7f7f2",
          panel: "#ffffff",
          ink: "#202124",
          muted: "#6b7280",
          line: "#e5e7eb",
          income: "#108a5a",
          expense: "#c24136",
          accent: "#2563eb"
        }
      },
      boxShadow: {
        soft: "0 16px 40px rgba(32, 33, 36, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
