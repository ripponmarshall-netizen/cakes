export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 drop-shadow-[0_4px_10px_rgba(7,26,21,0.25)]">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#205c47" />
          <stop offset="1" stopColor="#0b2820" />
        </linearGradient>
        <linearGradient id="logo-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ead6a8" />
          <stop offset="1" stopColor="#b0873d" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#logo-bg)" />
      <circle cx="32" cy="32" r="16.5" fill="none" stroke="url(#logo-ring)" strokeWidth="4.5" />
      <circle cx="32" cy="15.5" r="4.75" fill="#f3f0e8" />
      <circle cx="46.3" cy="40.25" r="4.75" fill="#f3f0e8" />
      <circle cx="17.7" cy="40.25" r="4.75" fill="#f3f0e8" />
    </svg>
  )
}
