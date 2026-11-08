import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#128C7E", // WhatsApp teal
          dark: "#075E54",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
