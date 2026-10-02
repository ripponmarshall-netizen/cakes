/** A colour defined as a CSS variable of RGB channels, so opacity modifiers work. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
      },
      // Theme tokens live in src/index.css (light and dark sets).
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        // A selected pill on a sunken track: white in light, lifted grey in dark.
        raised: 'rgb(var(--raised) / <alpha-value>)',
        ink: { 50: v('ink-50'), 100: v('ink-100'), 200: v('ink-200'), 300: v('ink-300'), 400: v('ink-400'), 500: v('ink-500'), 600: v('ink-600'), 700: v('ink-700'), 800: v('ink-800'), 900: v('ink-900') },
        brand: { 50: v('brand-50'), 100: v('brand-100'), 200: v('brand-200'), 300: v('brand-300'), 400: v('brand-400'), 500: v('brand-500'), 600: v('brand-600'), 700: v('brand-700'), 800: v('brand-800'), 900: v('brand-900'), 950: v('brand-950') },
        gold: { 50: v('gold-50'), 100: v('gold-100'), 200: v('gold-200'), 300: v('gold-300'), 400: v('gold-400'), 500: v('gold-500'), 600: v('gold-600'), 700: v('gold-700') },
        rose: { 50: v('rose-50'), 100: v('rose-100'), 200: v('rose-200'), 300: v('rose-300'), 400: v('rose-400'), 500: v('rose-500'), 600: v('rose-600'), 700: v('rose-700'), 800: v('rose-800'), 900: v('rose-900'), 950: v('rose-950') },
        amber: { 50: v('amber-50'), 100: v('amber-100'), 200: v('amber-200'), 300: v('amber-300'), 400: v('amber-400'), 500: v('amber-500'), 600: v('amber-600'), 700: v('amber-700'), 800: v('amber-800'), 900: v('amber-900'), 950: v('amber-950') },
        sky: { 50: v('sky-50'), 100: v('sky-100'), 200: v('sky-200'), 300: v('sky-300'), 400: v('sky-400'), 500: v('sky-500'), 600: v('sky-600'), 700: v('sky-700'), 800: v('sky-800'), 900: v('sky-900'), 950: v('sky-950') },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
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
        'drop-in': {
          from: { opacity: '0', transform: 'translateY(-14px) scale(0.96)' },
          to: { opacity: '1', transform: 'none' },
        },
        'drop-out': {
          from: { opacity: '1', transform: 'none' },
          to: { opacity: '0', transform: 'translateY(-10px) scale(0.97)' },
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
        'drop-in': 'drop-in 0.36s cubic-bezier(0.34, 1.3, 0.64, 1) both',
        'drop-out': 'drop-out 0.2s ease-in both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
