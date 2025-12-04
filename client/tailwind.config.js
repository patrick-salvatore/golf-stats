/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        golf: {
          dark: '#0f172a',    // Slate 900
          surface: '#1e293b', // Slate 800
          accent: '#10b981',  // Emerald 500
          highlight: '#34d399', // Emerald 400
          text: '#f1f5f9',    // Slate 100
          muted: '#94a3b8',   // Slate 400
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

