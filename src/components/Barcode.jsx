import { ean13Bits } from '../lib/barcode.js'

export default function Barcode({ code, width = 200 }) {
  if (!/^\d{13}$/.test(code)) return <p className="text-sm text-slate-500">Enter 13 digits, or press Generate, to see the barcode.</p>
  const bits = ean13Bits(code)
  return (
    <svg viewBox="0 0 212 72" width={width} role="img" aria-label={'Barcode ' + code}>
      {[...bits].map((b, i) => (b === '1' ? <rect key={i} x={11 + i * 2} y="0" width="2" height="56" fill="#000" /> : null))}
      <text x="106" y="68" fontSize="12" textAnchor="middle" fontFamily="monospace" letterSpacing="2" fill="#000">{code}</text>
    </svg>
  )
}
