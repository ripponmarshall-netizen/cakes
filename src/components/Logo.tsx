export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="16" fill="#1a563f" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#e2b13c" strokeWidth="5" />
      <circle cx="32" cy="15" r="5" fill="#f5f4ef" />
      <circle cx="46.7" cy="40.5" r="5" fill="#f5f4ef" />
      <circle cx="17.3" cy="40.5" r="5" fill="#f5f4ef" />
    </svg>
  )
}
