/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ksa: {
          blue: '#1e3a8a',
          orange: '#ea580c',
          red: '#dc2626'
        }
      }
    },
  },
  plugins: [],
}
