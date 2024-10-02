import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'darkblue': 'rgb(0, 0, 30)', 
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
};

export default config;
