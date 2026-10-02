/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#f5f4ef',
        ink: {
          50: '#f7f7f5',
          100: '#ecebe6',
          200: '#d9d7cf',
          300: '#b9b6aa',
          400: '#8f8b7e',
          500: '#6b685d',
          600: '#4f4d45',
          700: '#3a3933',
          800: '#26251f',
          900: '#171713',
        },
        brand: {
          50: '#eef7f2',
          100: '#d6ede0',
          200: '#aedbc2',
          300: '#7cc29f',
          400: '#4aa37a',
          500: '#2b8660',
          600: '#1f6b4c',
          700: '#1a563f',
          800: '#164534',
          900: '#0f2f24',
        },
        gold: {
          50: '#fdf8ec',
          100: '#faefcf',
          200: '#f3d98f',
          300: '#ebc561',
          400: '#e2b13c',
          500: '#c9971f',
          600: '#a27616',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(23, 23, 19, 0.04), 0 4px 16px -8px rgba(23, 23, 19, 0.12)',
        lift: '0 20px 40px -20px rgba(15, 47, 36, 0.35)',
      },
    },
  },
  plugins: [],
}
