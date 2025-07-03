import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          400: '#9ca3af', // Darker than default
          500: '#6b7280', // Darker than default
          600: '#374151', // Darker than default
          700: '#374151', // Darker than default
          900: '#111827', // Darker than default
        }
      }
    },
  },
  plugins: [],
};
export default config;