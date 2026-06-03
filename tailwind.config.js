/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: '#fdf6f0',
        blush: {
          50: '#fdf2f4',
          100: '#fce7eb',
          200: '#f8cdd6',
          300: '#f2a7b7',
          400: '#e87a92',
          500: '#d9536f',
          600: '#c23a58',
        },
        cocoa: {
          400: '#a9856b',
          500: '#8a6650',
          600: '#6f4f3d',
          700: '#553b2d',
          800: '#3d2a20',
        },
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(111, 79, 61, 0.25)',
        card: '0 2px 12px -4px rgba(111, 79, 61, 0.18)',
      },
    },
  },
  plugins: [],
}
