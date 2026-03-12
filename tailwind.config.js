/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb', // blue-600
          dark: '#1d4ed8',    // blue-700
          light: '#60a5fa',   // blue-400
        },
        ksa: {
          blue: '#1e3a8a',
          orange: '#ea580c',
          red: '#dc2626'
        }
      }
    },
  },
  darkMode: 'class',
  plugins: [],
}
