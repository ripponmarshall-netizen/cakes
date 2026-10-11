/**
 * The app icon in the Night Shift Calculator's style: a near-black tile, a
 * light ring for the circle of members, and one amber dot for whose draw it
 * is. index.html draws the same mark (bigger) on the loading screen and flies
 * it onto the header's copy, so keep the two in step.
 */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="block shrink-0">
      <rect width="64" height="64" rx="14" fill="#0b0b0c" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#f4f4f5" strokeWidth="3.5" />
      <g stroke="#0b0b0c" strokeWidth="2.5">
        <circle cx="32" cy="15" r="5.5" fill="#e0a43c" />
        <circle cx="46.72" cy="40.5" r="5.5" fill="#f4f4f5" />
        <circle cx="17.28" cy="40.5" r="5.5" fill="#f4f4f5" />
      </g>
    </svg>
  )
}
