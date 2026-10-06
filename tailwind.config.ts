import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#F59A1B",
          dark: "#D97F0C",
          light: "#FFF3E0",
          ink: "#FFFFFF"
        },
        navy: {
          DEFAULT: "#0F1E3A",
          light: "#1B2D4F"
        },
        ink: {
          DEFAULT: "#1A1A1A",
          muted: "#6B6570",
          faint: "#A39FA6"
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F4F6FA",
          border: "#E6E9F0"
        },
        status: {
          success: "#16A34A",
          "success-bg": "#ECFDF3",
          warning: "#D97706",
          "warning-bg": "#FFF7ED",
          danger: "#DC2626",
          "danger-bg": "#FEF2F2",
          info: "#2563EB",
          "info-bg": "#EFF6FF",
          new: "#2563EB",
          "new-bg": "#EFF6FF",
          preparing: "#D97706",
          "preparing-bg": "#FFF7ED",
          ready: "#F5C518",
          "ready-bg": "#FFFBEB",
          delivered: "#16A34A",
          "delivered-bg": "#ECFDF3",
          cancelled: "#DC2626",
          "cancelled-bg": "#FEF2F2"
        }
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,30,58,0.05), 0 2px 6px rgba(15,30,58,0.06)"
      }
    }
  },
  plugins: []
};

export default config;