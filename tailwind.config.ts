import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        df: {
          indigo: "#5655E5",
          purple: "#4B2E9E",
          teal: "#2FA9C9",
          black: "#0B0B0F",
          white: "#FFFFFF",
          mist: "#DCE3F0",
          text: "#1A1A1F",
        },
        status: {
          green: "#1E8E5A",
          amber: "#B9860A",
          red: "#C13B3B",
          slate: "#5B6472",
          blue: "#3467C7",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      backgroundImage: {
        "df-gradient": "linear-gradient(135deg, #5655E5 0%, #4B2E9E 60%, #2FA9C9 100%)",
      },
      borderRadius: {
        df: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
