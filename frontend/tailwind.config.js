/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        "on-accent": "var(--on-accent)",
        pos: "var(--pos)",
        neg: "var(--neg)",
      },
      borderRadius: { sm: "4px", DEFAULT: "6px", md: "6px", lg: "8px", xl: "8px" },
      boxShadow: { card: "var(--shadow)" },
      zIndex: { dropdown: "1000", sticky: "1100", modal: "1300", toast: "1400", tooltip: "1500" },
      transitionTimingFunction: { terminal: "cubic-bezier(0.23, 1, 0.32, 1)" },
      fontSize: {
        xs: ["0.75rem", "1rem"],
        sm: ["0.8125rem", "1.25rem"],
        base: ["0.9375rem", "1.5rem"],
        lg: ["1.1875rem", "1.6rem"],
        xl: ["1.5rem", "1.85rem"],
        "2xl": ["1.875rem", "2.1rem"],
      },
    },
  },
  plugins: [],
};
