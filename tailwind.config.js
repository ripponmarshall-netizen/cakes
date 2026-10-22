/** A colour defined as a CSS variable of RGB channels, so opacity modifiers work. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // San Francisco on Apple devices (as the Night Shift Calculator),
        // Geist elsewhere. Money uses the same face with tabular figures
        // (.mono), as Apple's apps set it.
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Geist Variable"', 'Geist', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Geist Variable"', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      // Theme tokens live in src/index.css (light and dark sets).
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        // A selected pill on a sunken track: white in light, lifted grey in dark.
        raised: 'rgb(var(--raised) / <alpha-value>)',
        // iOS gray fills: segmented tracks, plain buttons, round icon buttons.
        fill: { DEFAULT: 'var(--fill)', strong: 'var(--fill-strong)' },
        'seg-pill': 'var(--seg-pill)',
        // Hairlines: `line` around controls, `line-soft` around cards.
        line: { DEFAULT: v('line'), soft: v('line-soft') },
        ink: { 50: v('ink-50'), 100: v('ink-100'), 200: v('ink-200'), 300: v('ink-300'), 400: v('ink-400'), 500: v('ink-500'), 600: v('ink-600'), 700: v('ink-700'), 800: v('ink-800'), 900: v('ink-900') },
        brand: { 50: v('brand-50'), 100: v('brand-100'), 200: v('brand-200'), 300: v('brand-300'), 400: v('brand-400'), 500: v('brand-500'), 600: v('brand-600'), 700: v('brand-700'), 800: v('brand-800'), 900: v('brand-900'), 950: v('brand-950') },
        // The terracotta accent. `accent-600` is the solid accent; `accent-ink` is the text that sits on it.
        accent: { 50: v('accent-50'), 100: v('accent-100'), 200: v('accent-200'), 300: v('accent-300'), 400: v('accent-400'), 500: v('accent-500'), 600: v('accent-600'), 700: v('accent-700'), 800: v('accent-800'), 900: v('accent-900'), 950: v('accent-950'), ink: v('accent-ink') },
        rose: { 50: v('rose-50'), 100: v('rose-100'), 200: v('rose-200'), 300: v('rose-300'), 400: v('rose-400'), 500: v('rose-500'), 600: v('rose-600'), 700: v('rose-700'), 800: v('rose-800'), 900: v('rose-900'), 950: v('rose-950') },
        amber: { 50: v('amber-50'), 100: v('amber-100'), 200: v('amber-200'), 300: v('amber-300'), 400: v('amber-400'), 500: v('amber-500'), 600: v('amber-600'), 700: v('amber-700'), 800: v('amber-800'), 900: v('amber-900'), 950: v('amber-950') },
        sky: { 50: v('sky-50'), 100: v('sky-100'), 200: v('sky-200'), 300: v('sky-300'), 400: v('sky-400'), 500: v('sky-500'), 600: v('sky-600'), 700: v('sky-700'), 800: v('sky-800'), 900: v('sky-900'), 950: v('sky-950') },
      },
      // The calculator's corners after its iOS refresh: 12px buttons, 14px
      // fields, 20px cards, 22px hero panels and dialogs.
      borderRadius: {
        xl: '12px',
        '2xl': '14px',
        '3xl': '20px',
        '4xl': '22px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
        lift: 'var(--shadow-lift)',
      },
      // Damped springs (defined in src/index.css).
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
        spring: 'var(--ease-bouncy)',
        settle: 'var(--ease-snappy)',
        soft: 'var(--ease-soft)',
      },
      // The Night Shift Calculator's motion set. Entrances end on
      // `transform: none` and use fill-mode backwards, so a finished animation
      // never leaves a transform behind (that would trap position: fixed
      // dialogs inside the animated element).
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(var(--rise-from, 22px))' },
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
        // A sheet slides up from below the screen edge and settles with a
        // small bounce; its opacity has its own quick fade (sheet-fade), as
        // the spring would overshoot it.
        'sheet-in': {
          from: { transform: 'translateY(calc(100% + 120px))' },
          to: { transform: 'none' },
        },
        'sheet-fade': {
          from: { opacity: '0.4' },
          to: { opacity: '1' },
        },
        'sheet-out': {
          from: { opacity: '1', transform: 'none' },
          to: { opacity: '0', transform: 'translateY(24px)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(14px) scale(0.88)' },
          to: { opacity: '1', transform: 'none' },
        },
        'pop-out': {
          from: { opacity: '1', transform: 'none' },
          to: { opacity: '0', transform: 'scale(0.96)' },
        },
        // Toasts drop from the top edge on a spring.
        'drop-in': {
          from: { opacity: '0', transform: 'translateY(-26px) scale(0.86)' },
          to: { opacity: '1', transform: 'none' },
        },
        'drop-out': {
          from: { opacity: '1', transform: 'none' },
          to: { opacity: '0', transform: 'translateY(-8px) scale(0.96)' },
        },
        // Badges, chips and ticks spring into place.
        pop: {
          from: { opacity: '0', transform: 'scale(0.4)' },
          to: { opacity: '1', transform: 'none' },
        },
        // Pressed in, then released: the spring carries it past full size and back.
        'check-pop': {
          from: { transform: 'scale(0.55)' },
          to: { transform: 'none' },
        },
        // Progress fills grow from their start.
        'grow-x': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'none' },
        },
        // Wizard-style steps slide in from the right.
        'step-in': {
          from: { opacity: '0', transform: 'translateX(40px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        rise: 'rise var(--rise-dur, 0.7s) var(--ease-snappy) backwards',
        fade: 'fade 0.3s ease-out backwards',
        'fade-out': 'fade-out 0.18s ease-in both',
        'sheet-in': 'sheet-in 0.62s var(--ease-soft) backwards, sheet-fade 0.2s ease-out backwards',
        'sheet-out': 'sheet-out 0.18s ease-in both',
        'pop-in': 'pop-in 0.5s var(--ease-bouncy) backwards',
        'pop-out': 'pop-out 0.16s ease-in both',
        'drop-in': 'drop-in 0.6s var(--ease-bouncy) backwards',
        'drop-out': 'drop-out 0.2s ease-in both',
        pop: 'pop 0.5s var(--ease-bouncy) backwards',
        'check-pop': 'check-pop 0.55s var(--ease-bouncy)',
        'grow-x': 'grow-x 0.8s var(--ease-snappy) backwards',
        'step-in': 'step-in 0.6s var(--ease-snappy) backwards',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
