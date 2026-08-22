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
        // Neutral surface palette for the "one glance = one clear decision"
        // accessible light theme. Deliberately inverted from the usual
        // 50=lightest/950=darkest convention: every component in this app
        // was already written against the semantic pattern bg-ink-950 (page
        // background) / text-ink-50 (primary text) / ink-900 (card surface)
        // / ink-300..400 (secondary text) — inverting the hex assignments
        // here (950 now lightest, 50 now darkest) flips the whole app to a
        // light, high-contrast theme without touching every call site.
        ink: {
          50:  "#181c28", // primary text — dark charcoal, not black or gray
          100: "#252a3a",
          200: "#333a4d",
          300: "#454d63", // secondary body text — AA on white/off-white
          400: "#566078", // tertiary/muted text — still AA-safe at normal size
          500: "#6b7385",
          600: "#7b8398", // decorative dots, ghost-button text
          700: "#a6aebf", // stronger borders
          800: "#dde1e7", // hairlines, card borders
          900: "#ffffff", // card / surface background
          950: "#f5f6f8", // page background — very light off-white
        },
        // Brand — deep navy/blue for trust and navigation. Kept as a normal
        // (non-inverted) ramp: brand-900/950 stay genuinely dark navy, used
        // deliberately for the handful of dark accent cards (attack
        // forecast, CTA banner) that intentionally contrast against the
        // light page.
        brand: {
          50:  "#eef4fb",
          100: "#dbe7f6",
          200: "#b0cceb",
          300: "#7ea9db",
          400: "#4a80c4",
          500: "#2f5fa3", // primary navy-blue, used for buttons/links
          600: "#254c85",
          700: "#1d3c6b",
          800: "#152c50",
          900: "#101f38",
          950: "#0a1526",
        },
        // Severity scale (kept for score dials / accents; each pairing in
        // components also always carries an icon + text label, never color
        // alone, per WCAG 2.2 and the "never rely on color alone" rule).
        severity: {
          safe:        "#0f7a52",
          low:         "#4d7c0f",
          suspicious:  "#b45309",
          scam:        "#b91c1c",
          high:        "#7f1d1d",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Light theme: elevation comes from a soft drop shadow plus a
        // faint dark hairline ring, rather than the dark-theme's light glow.
        soft: "0 1px 2px rgba(20,23,42,0.06), 0 0 0 1px rgba(20,23,42,0.05)",
        card: "0 8px 24px rgba(20,23,42,0.08), 0 0 0 1px rgba(20,23,42,0.06)",
        ring: "0 0 0 1px rgba(20,23,42,0.08)",
        glow: "0 0 32px rgba(47,95,163,0.18)",
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at 1px 1px, rgba(20,23,42,0.07) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};
