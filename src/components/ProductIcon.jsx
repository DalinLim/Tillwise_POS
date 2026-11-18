export default function ProductIcon({ color }) {
  return (
    <svg viewBox="0 0 48 20" className="mb-1 h-5 w-12" style={{ color }} aria-hidden="true">
      <rect x="1" y="3" width="20" height="14" rx="6" fill="currentColor" /><rect x="27" y="3" width="20" height="14" rx="6" fill="currentColor" />
      <path d="M21 7q3-2 6 0M1 7L0 4M47 7l1-3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
