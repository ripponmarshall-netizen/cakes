/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        // Warm ivory paper, deep forest emerald, brushed brass.
        canvas: '#f3f0e8',
        ink: {
          50: '#f8f7f3',
          100: '#efede6',
          200: '#e0ddd3',
          300: '#c3bfb2',
          400: '#959083',
          500: '#6e6a5f',
          600: '#514e46',
          700: '#3b3933',
          800: '#272622',
          900: '#181815',
        },
        brand: {
          50: '#eef5f1',
          100: '#d9eae1',
          200: '#b3d4c4',
          300: '#82b59d',
          400: '#4f9177',
          500: '#2f7259',
          600: '#205c47',
          700: '#184b3a',
          800: '#123b2e',
          900: '#0b2820',
          950: '#071a15',
        },
        gold: {
          50: '#fbf7ee',
          100: '#f5ecd5',
          200: '#ead6a8',
          300: '#dcbd7b',
          400: '#c9a258',
          500: '#b0873d',
          600: '#8d6a2f',
          700: '#6c5125',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.7) inset, 0 1px 2px rgba(24,24,21,0.04), 0 8px 24px -12px rgba(24,24,21,0.12)',
        float: '0 2px 4px rgba(24,24,21,0.04), 0 16px 40px -16px rgba(24,24,21,0.22)',
        lift: '0 24px 60px -24px rgba(7,26,21,0.55)',
        glow: '0 0 0 4px rgba(201,162,88,0.18)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
        spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
      },
      keyframes: {
        // Ends on `transform: none` so a finished animation doesn't leave a
        // transform behind (that would trap position: fixed dialogs inside).
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        fade: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'none' },
        },
        'sheet-out': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          to: { opacity: '1', transform: 'none' },
        },
        'pop-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        rise: 'rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards',
        fade: 'fade 0.3s ease-out both',
        'fade-out': 'fade-out 0.2s ease-in both',
        'sheet-in': 'sheet-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
        'sheet-out': 'sheet-out 0.24s cubic-bezier(0.4, 0, 1, 1) both',
        'pop-in': 'pop-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-out': 'pop-out 0.18s ease-in both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
