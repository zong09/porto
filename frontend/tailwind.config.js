/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokenized — resolved from CSS variables defined per [data-theme] in index.css
        surface: "var(--bg)",
        bgAlt: "var(--bg-alt)",
        card: "var(--surface)",
        terracotta: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-d)",
        },
        brandDd: "var(--brand-dd)",
        dark: "var(--text)",
        text2: "var(--text2)",
        muted: "var(--muted)",
        faint: {
          DEFAULT: "var(--muted2)",
          darker: "var(--muted3)",
        },
        inputBorder: "var(--border)",
        chipBg: {
          DEFAULT: "var(--soft)",
          text: "var(--text2)",
        },
        softH: "var(--soft-h)",
        secondary: "var(--secondary)",
        secondaryL: "var(--secondary-l)",
        positive: {
          text: "var(--gain)",
          bg: "var(--gain-bg)",
        },
        gainD: "var(--gain-d)",
        negative: {
          text: "var(--loss)",
          bg: "var(--loss-bg)",
        },
        lossD: "var(--loss-d)",
        lossL: "var(--loss-l)",
        tickerUp: "var(--ticker-up)",
        gold: "var(--gold)",
        rose: "var(--rose)",
        accentLine: "#5b8a8f",
      },
      fontFamily: {
        sans: ["Anuphan", "sans-serif"],
      },
    },
  },
  plugins: [],
}
