/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef4ff', 100: '#dae6ff', 200: '#bcd2ff', 300: '#8eb4ff', 400: '#588aff',
                 500: '#3161ff', 600: '#1b3df5', 700: '#152de1', 800: '#1827b6', 900: '#1a288f', 950: '#141a57' },
        ink:   { 50: '#f6f7f9', 100: '#eceef2', 200: '#d4d9e3', 300: '#aeb008', 400: '#8792ab',
                 500: '#687490', 600: '#535d76', 700: '#444c60', 800: '#3b4152', 900: '#1e222e', 950: '#12141c' }
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16,24,40,.04), 0 1px 3px 0 rgba(16,24,40,.06)',
        lift: '0 4px 6px -1px rgba(16,24,40,.06), 0 12px 24px -4px rgba(16,24,40,.10)',
        pop: '0 20px 40px -12px rgba(16,24,40,.25)'
      }
    }
  },
  plugins: []
};
