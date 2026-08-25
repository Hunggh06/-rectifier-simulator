import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/store/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Layered technical-dark surfaces (no pure black)
        "surface-0": "var(--surface-0)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        "line": "var(--line)",
        "line-strong": "var(--line-strong)",
        "ink-1": "var(--ink-1)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        // Functional channel accents — locked per role
        "sig-sim": "var(--sig-sim)",       // Simulink measured (solid)
        "sig-theory": "var(--sig-theory)", // Analytic theory (dashed)
        "sig-scrub": "var(--sig-scrub)",   // Phase scrubber
        "sig-on": "var(--sig-on)",         // Valve conducting
        "sig-gate": "var(--sig-gate)",     // Gate pulses
        "sig-warn": "var(--sig-warn)",     // Reverse blocking / caution
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
