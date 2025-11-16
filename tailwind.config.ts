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
        espresso: {
          DEFAULT: '#5B4636',
          dark: '#3D2E24',
          light: '#8B6F5E',
        },
        offwhite: '#FAFAF8',
        charcoal: '#2D2D2D',
      },
      borderRadius: {
        '2xl': '1rem',
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        mono: ['ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
