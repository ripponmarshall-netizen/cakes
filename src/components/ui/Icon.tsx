/*
 * Partner Ledger's own icon set, drawn for this app on a 24px grid: a rounded
 * 1.75px line (2px when small) over a soft tint of the same colour, so icons
 * read as one family with the app's cards. Each glyph is:
 *   s  the line work (stroked)
 *   f  the tint: a filled shape under the line, at low opacity (skipped when small)
 *   p  solid marks (dice pips, a calendar's "today"), filled at full strength
 */

/** A filled circle as path data (for pips and dots). */
const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`

type Glyph = { s: string; f?: string; p?: string }

const glyphs = {
  plus: { s: 'M12 5.5v13M5.5 12h13' },
  x: { s: 'M6.5 6.5l11 11M17.5 6.5l-11 11' },
  check: { s: 'M5 12.5l4.5 4.5L19 7.5' },
  'chevron-left': { s: 'M14.5 6l-6 6 6 6' },
  'chevron-right': { s: 'M9.5 6l6 6-6 6' },
  'chevron-down': { s: 'M6 9.5l6 6 6-6' },
  'arrow-up': { s: 'M6 14.5l6-6 6 6' },
  'arrow-down': { s: 'M6 9.5l6 6 6-6' },
  'arrow-right': { s: 'M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5' },

  // Money
  /** A draw: the bag of money a member takes home. */
  draw: {
    s: 'M9.25 3.75h5.5l-1.5 2.75h-2.5zM10.5 6.5C7 8.25 5 11.25 5 14.5c0 3.5 2.75 6 7 6s7-2.5 7-6c0-3.25-2-6.25-5.5-8M13.75 11.75c-.25-.7-.95-1.1-1.75-1.1-1 0-1.75.55-1.75 1.35 0 1.85 3.5.9 3.5 2.9 0 .8-.8 1.35-1.75 1.35-.85 0-1.55-.4-1.8-1.1M12 9.75v.9M12 16.25v.9',
    f: 'M10.5 6.5h3c3.5 1.75 5.5 4.75 5.5 8 0 3.5-2.75 6-7 6s-7-2.5-7-6c0-3.25 2-6.25 5.5-8z',
  },
  /** The pot: the jar the hands are paid into. */
  pot: {
    s: 'M8.5 3.75h7M9.5 3.75v2.1C7 6.9 5.25 9 5.25 12v4.25a4.25 4.25 0 0 0 4.25 4.25h5a4.25 4.25 0 0 0 4.25-4.25V12c0-3-1.75-5.1-4.25-6.15v-2.1M5.25 12.25h13.5',
    f: 'M5.25 12.25h13.5v4a4.25 4.25 0 0 1-4.25 4.25h-5a4.25 4.25 0 0 1-4.25-4.25z',
  },
  wallet: {
    s: 'M4.5 6.5v11a2 2 0 0 0 2 2h12.25a.75.75 0 0 0 .75-.75v-9.5a.75.75 0 0 0-.75-.75H6.5a2 2 0 0 1-2-2zm0 0a2 2 0 0 1 2-2h10v4M15.25 14h1.75',
    f: 'M4.5 8.5h14.25a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-.75.75H6.5a2 2 0 0 1-2-2z',
  },
  /** Counting the box: a stack of coins. */
  coins: {
    s: 'M5 7.5C5 8.9 7.9 10 11.5 10S18 8.9 18 7.5 15.1 5 11.5 5 5 6.1 5 7.5zM5 7.5V12c0 1.4 2.9 2.5 6.5 2.5S18 13.4 18 12V7.5M5 12v4.5C5 17.9 7.9 19 11.5 19s6.5-1.1 6.5-2.5V12',
    f: 'M5 7.5C5 8.9 7.9 10 11.5 10S18 8.9 18 7.5 15.1 5 11.5 5 5 6.1 5 7.5z',
  },

  // People
  users: {
    s: 'M9 11a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5zM3.5 19.5c0-3 2.5-5.25 5.5-5.25s5.5 2.25 5.5 5.25M15.5 4.75a3.25 3.25 0 0 1 0 6.25M17 14.5c2.1.5 3.5 2.4 3.5 5',
    f: 'M9 11a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5zM3.5 19.5c0-3 2.5-5.25 5.5-5.25s5.5 2.25 5.5 5.25z',
  },
  swap: { s: 'M16 3.5l3.5 3.5-3.5 3.5M19.5 7H8a3.5 3.5 0 0 0-3.5 3.5M8 20.5L4.5 17 8 13.5M4.5 17H16a3.5 3.5 0 0 0 3.5-3.5' },
  phone: {
    s: 'M8.6 4.5H6.25A1.75 1.75 0 0 0 4.5 6.4C5 13.6 10.4 19 17.6 19.5a1.75 1.75 0 0 0 1.9-1.75V15.4a1 1 0 0 0-.7-.95l-3-1a1 1 0 0 0-1.05.27l-1.3 1.36a11 11 0 0 1-4.9-4.9l1.36-1.3a1 1 0 0 0 .27-1.05l-1-3z',
  },
  message: {
    s: 'M12 3.75a8.25 8.25 0 0 0-7.1 12.45L4 20l3.9-.9A8.25 8.25 0 1 0 12 3.75z',
    f: 'M12 3.75a8.25 8.25 0 0 0-7.1 12.45L4 20l3.9-.9A8.25 8.25 0 1 0 12 3.75z',
    p: `${dot(8.5, 12, 1)}${dot(12, 12, 1)}${dot(15.5, 12, 1)}`,
  },

  // Draws and time
  /** Draw lots. */
  dice: {
    s: 'M7 4.5h10A2.5 2.5 0 0 1 19.5 7v10a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5z',
    f: 'M7 4.5h10A2.5 2.5 0 0 1 19.5 7v10a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5z',
    p: `${dot(8.9, 8.9, 1.2)}${dot(15.1, 8.9, 1.2)}${dot(12, 12, 1.2)}${dot(8.9, 15.1, 1.2)}${dot(15.1, 15.1, 1.2)}`,
  },
  calendar: {
    s: 'M6.5 5.5h11a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2zM4.5 10h15M8.5 3.5v4M15.5 3.5v4',
    f: 'M6.5 5.5h11a2 2 0 0 1 2 2V10h-15V7.5a2 2 0 0 1 2-2z',
    p: dot(15.25, 15, 1.25),
  },
  /** History: a clock turning back. */
  clock: {
    s: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.75V8h3.25M12 8v4.25l2.75 1.75',
    f: 'M12 19.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z',
  },
  /** Waiting to sync. */
  sync: { s: 'M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1M17.5 3.75v3.5H14M6.5 20.25v-3.5H10' },

  // Status
  alert: {
    s: 'M10.3 4.2a2 2 0 0 1 3.4 0l7.2 12.6a2 2 0 0 1-1.7 3H4.8a2 2 0 0 1-1.7-3zM12 9.5v4',
    f: 'M10.3 4.2a2 2 0 0 1 3.4 0l7.2 12.6a2 2 0 0 1-1.7 3H4.8a2 2 0 0 1-1.7-3z',
    p: dot(12, 16.6, 1.05),
  },
  info: {
    s: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 11v5.5',
    f: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z',
    p: dot(12, 7.9, 1.05),
  },
  /** Money at risk. */
  shield: {
    s: 'M12 3.25l7 2.75v5.5c0 4.5-3 7.75-7 9.25-4-1.5-7-4.75-7-9.25V6zM12 8.5v4',
    f: 'M12 3.25l7 2.75v5.5c0 4.5-3 7.75-7 9.25-4-1.5-7-4.75-7-9.25V6z',
    p: dot(12, 15.6, 1.05),
  },
  lock: {
    s: 'M6.5 10.5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2',
    f: 'M6.5 10.5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z',
  },
  /** Void. */
  ban: {
    s: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM6 6l12 12',
    f: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z',
  },
  undo: { s: 'M8.5 13.5l-4-4 4-4M4.5 9.5h9a5.5 5.5 0 0 1 0 11h-3' },
  sparkle: {
    s: 'M11 4c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5C8.4 9.9 10.4 7.9 11 4zM18.5 15.5v4M16.5 17.5h4',
    f: 'M11 4c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5C8.4 9.9 10.4 7.9 11 4z',
  },

  // App
  /** Settings: two sliders. */
  settings: {
    s: 'M4.5 7.5h8M17.5 7.5h2M4.5 16.5h2M11.5 16.5h8M15 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM9 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    f: 'M15 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM9 19a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  },
  trash: {
    s: 'M4.5 7h15M9.5 7V5.25a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M6.5 7l.8 11.6a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7M10.25 11v5.5M13.75 11v5.5',
    f: 'M6.5 7l.8 11.6a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7z',
  },
  logout: { s: 'M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10M14.5 8l4 4-4 4M18.5 12h-9' },
  sun: {
    s: 'M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5zM12 2.75v1.5M12 19.75v1.5M2.75 12h1.5M19.75 12h1.5M5.45 5.45l1.06 1.06M17.49 17.49l1.06 1.06M5.45 18.55l1.06-1.06M17.49 6.51l1.06-1.06',
    f: 'M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5z',
  },
  moon: {
    s: 'M19.5 14.25A7.75 7.75 0 0 1 9.75 4.5a7.75 7.75 0 1 0 9.75 9.75zM17 3.75v2.5M15.75 5h2.5',
    f: 'M19.5 14.25A7.75 7.75 0 0 1 9.75 4.5a7.75 7.75 0 1 0 9.75 9.75z',
  },
  /** Follow the phone's light or dark setting. */
  contrast: {
    s: 'M12 20.25a8.25 8.25 0 1 0 0-16.5 8.25 8.25 0 0 0 0 16.5z',
    p: 'M12 3.75a8.25 8.25 0 0 1 0 16.5z',
  },
  download: { s: 'M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2' },
  file: {
    s: 'M7 3.5h6.5l5 5v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2zM13.5 3.5v5h5M8.75 13h6.5M8.75 16.5h4.5',
    f: 'M7 3.5h6.5l5 5v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z',
  },
  printer: {
    s: 'M7.5 9V4.5h9V9M7.5 16.5h-1a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-1M7.5 13.5h9v6h-9z',
    f: 'M6.5 9h11a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z',
  },
  link: { s: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1' },
  copy: {
    s: 'M9.5 9.5h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM15.5 9.5v-3a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1',
    f: 'M9.5 9.5h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
  },
  'wifi-off': {
    s: 'M8.75 15.5a4.6 4.6 0 0 1 6.5 0M5.5 12.25a9.2 9.2 0 0 1 4.6-2.5M14.5 9.9a9.2 9.2 0 0 1 4 2.35M2.75 9a13.8 13.8 0 0 1 3.6-2.4M10.5 5.3a13.8 13.8 0 0 1 10.75 3.7M4 4l16 16',
    p: dot(12, 18.75, 1.1),
  },
} satisfies Record<string, Glyph>

export type IconName = keyof typeof glyphs

export function Icon({
  name,
  size = 18,
  className = '',
  strokeWidth,
  duo = true,
}: {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
  /** Draw the soft tint under the line. Off below 15px, where it would only blur the shape. */
  duo?: boolean
}) {
  const g: Glyph = glyphs[name]
  const sw = strokeWidth ?? (size < 15 ? 2 : 1.75)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden focusable="false">
      {g.f && duo && size >= 15 && <path d={g.f} fill="currentColor" opacity={0.16} />}
      <path d={g.s} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      {g.p && <path d={g.p} fill="currentColor" />}
    </svg>
  )
}
