/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Design-update (startscherm in Instagram-stijl): Plus Jakarta Sans, met systeemletters als terugval
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Startscherm: donkere knoppen/tekst, ring voor "nieuw", pastels per bol (licht en donker)
        inkt: '#16161a',
        nieuw: '#f0a500',
        bol: {
          friet: '#fde59a',
          agenda: '#dce6ff',
          polls: '#e6ddff',
          verslagen: '#d5f0e4',
          fotos: '#ffdccf',
          'friet-d': '#4a3d12',
          'agenda-d': '#1f2b4d',
          'polls-d': '#2f2550',
          'verslagen-d': '#173a2c',
          'fotos-d': '#4a2a20',
        },
        kaart: {
          strepen: '#e6edff',
          'strepen-d': '#1c2540',
          kamp: '#e8dcff',
          'kamp-d': '#2a2148',
          event: '#f2f2f4',
          'event-d': '#1e2330',
        },
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
