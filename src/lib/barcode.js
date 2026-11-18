const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

export const checkDigit = (b) => { let s = 0; for (let i = 0; i < 12; i++) s += +b[i] * (i % 2 ? 3 : 1); return (10 - (s % 10)) % 10 }

export function nextBarcode(products) {
  const n = Math.max(1000, ...products.filter((p) => p.sku.startsWith('9320088')).map((p) => +p.sku.slice(7, 12) || 0)) + 1
  const b = '9320088' + String(n).padStart(5, '0')
  return b + checkDigit(b)
}

// EAN-13 as a 95-character string of bars (1) and spaces (0)
export function ean13Bits(code) {
  const d = [...code].map(Number)
  let b = '101'
  for (let i = 1; i < 7; i++) b += (P[d[0]][i - 1] === 'L' ? L : G)[d[i]]
  b += '01010'
  for (let i = 7; i < 13; i++) b += R[d[i]]
  return b + '101'
}
