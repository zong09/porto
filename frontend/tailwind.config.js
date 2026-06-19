/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#FAF5EC",
        terracotta: {
          DEFAULT: "#b45a3c",
          hover: "#a04e32",
        },
        dark: "#3d3328",
        muted: "#8a7d6c",
        faint: {
          DEFAULT: "#a89a86",
          darker: "#b3a692",
        },
        inputBorder: "#e0d5c2",
        chipBg: {
          DEFAULT: "#f0e7d8",
          text: "#6b5d49",
        },
        positive: {
          text: "#4f7136",
          bg: "#e4efdb",
        },
        negative: {
          text: "#b4543c",
          bg: "#f3ded6",
        },
        accentLine: "#5b8a8f",
        // Portfolio/series colors
        portColors: {
          0: "#7a8f55",
          1: "#c08b4f",
          2: "#b45a3c",
          3: "#5b8a8f",
          4: "#8a6f9e",
          5: "#a85d77",
        },
        // Portfolio card tints
        portTints: {
          0: "#EFF3E6",
          1: "#F3E9DC",
          2: "#F2E0D8",
          3: "#E2EDEA",
          4: "#EAE4F0",
          5: "#F2E2E8",
        },
      },
      fontFamily: {
        sans: ["Anuphan", "sans-serif"],
      },
    },
  },
  plugins: [],
}
