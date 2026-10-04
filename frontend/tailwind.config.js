/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // 60% — base surfaces (warm paper tint, never pure white/gray)
        paper: {
          DEFAULT: "#F6F3EC",
          raised: "#EEEADF",
          sunken: "#E4DFD1",
        },
        ink: {
          DEFAULT: "#1F1C17",
          muted: "#5B564D",
          faint: "#8A8477",
        },
        // 30% — structural / secondary (deep pine, used for nav, footers, primary surfaces)
        pine: {
          DEFAULT: "#1E332E",
          dark: "#152722",
          light: "#2C463F",
        },
        // 10% — accent, used sparingly for primary actions & the verified seal
        amber: {
          DEFAULT: "#B5551F",
          dark: "#93441A",
          light: "#D9713A",
          tint: "#F3E4D6",
        },
        border: {
          DEFAULT: "#DCD5C4",
          strong: "#C7BEA8",
        },
        status: {
          verified: "#2F6B4F",
          "verified-tint": "#E4EFE7",
          revoked: "#9B3A2E",
          "revoked-tint": "#F5E5E0",
          pending: "#8A6B22",
          "pending-tint": "#F1E9D2",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Source Sans 3'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      spacing: {
        // explicit 8pt ramp beyond Tailwind defaults, named for component heights
        18: "4.5rem",
        22: "5.5rem",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        seal: "3px",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(31, 28, 23, 0.06)",
        raised: "0 2px 8px -2px rgba(31, 28, 23, 0.12)",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};
