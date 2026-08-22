/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // Neutral surface palette
        ink: {
          50:  "#f6f7f9",
          100: "#eceef2",
          200: "#d7dae2",
          300: "#b3b8c6",
          400: "#8a91a4",
          500: "#646c82",
          600: "#4c5366",
          700: "#3a4054",
          800: "#252a3a",
          900: "#14172a",
          950: "#0a0c1a",
        },
        // Brand — deep, trustworthy teal-blue
        brand: {
          50:  "#effaf9",
          100: "#d7f2ef",
          200: "#b0e4e0",
          300: "#7fcfcb",
          400: "#4bb2b0",
          500: "#2f9595",
          600: "#22787c",
          700: "#1e5f66",
          800: "#1b4b52",
          900: "#183e44",
          950: "#0f272b",
        },
        // Severity scale
        severity: {
          safe:        "#10a572",
          low:         "#65a30d",
          suspicious:  "#d97706",
          scam:        "#dc2626",
          high:        "#991b1b",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Inter", "sans-serif"],
        display: ["ui-sans-serif", "system-ui", "Inter", "sans-serif"],
      },
      boxShadow: {
        // Dark theme: a drop shadow is invisible against a near-black page,
        // so "elevation" comes from a faint light ring instead, plus an
        // optional brand-colored glow for the elements that should pop.
        soft: "0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)",
        card: "0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)",
        ring: "0 0 0 1px rgba(255,255,255,0.06)",
        glow: "0 0 40px rgba(47,149,149,0.25)",
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};
