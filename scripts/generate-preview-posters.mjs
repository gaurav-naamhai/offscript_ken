import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Illustrated posters keep fictional preview events visually distinct without
// presenting a stock photograph as a picture of a real event or venue.
const posters = [
  ['evt-1', 'COFFEE / CULTURE', '#44302d', '#c58762', '#f4dfc3'],
  ['evt-2', 'ART / OUTSIDE', '#243d43', '#9cb9a7', '#e9d9b6'],
  ['evt-3', 'AFTER / HOURS', '#342b52', '#a885bd', '#e5c5ae'],
  ['evt-4', 'WILD / CITY', '#254438', '#8dae73', '#e9dcb2'],
  ['evt-5', 'FILM / FORUM', '#392b33', '#c67969', '#f0d0a1'],
  ['evt-6', 'BUILD / TOGETHER', '#313f4c', '#9f9a77', '#e9d9b0'],
  ['evt-7', 'OPEN / SOURCE', '#2b3656', '#729fc1', '#ddd8c9'],
  ['evt-8', 'FOOD / FINDS', '#6b3b31', '#dc9b65', '#f1d6a3'],
  ['evt-9', 'FOLK / SOUNDS', '#344045', '#b49b78', '#e9d6bd'],
  ['evt-10', 'WORDS / PEOPLE', '#4e334a', '#bb8f9f', '#f2d6c2'],
]

const output = join(process.cwd(), 'public', 'images', 'preview')
mkdirSync(output, { recursive: true })

for (const [id, label, base, mid, light] of posters) {
  const number = Number(id.split('-')[1])
  const rings = Array.from({ length: 7 }, (_, i) => {
    const x = 180 + ((number * 97 + i * 193) % 1000)
    const y = 100 + ((number * 79 + i * 151) % 600)
    const radius = 65 + ((number * 31 + i * 43) % 180)
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="${light}" stroke-opacity="${0.1 + i * 0.015}" stroke-width="${i % 2 ? 2 : 1}"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" role="img" aria-label="Illustrated preview poster for ${label}">
  <defs>
    <linearGradient id="bg" x2="1" y2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="${light}" stop-opacity=".68"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="750" fill="url(#bg)"/>
  <circle cx="${830 - number * 19}" cy="${270 + number * 13}" r="390" fill="url(#glow)"/>
  <path d="M-80 ${560 - number * 11} C 250 ${300 + number * 9}, 580 ${860 - number * 13}, 1280 ${210 + number * 17}" fill="none" stroke="${light}" stroke-opacity=".54" stroke-width="${85 + number * 5}"/>
  <path d="M-80 ${600 - number * 11} C 250 ${340 + number * 9}, 580 ${900 - number * 13}, 1280 ${250 + number * 17}" fill="none" stroke="${base}" stroke-opacity=".55" stroke-width="36"/>
  ${rings}
  <rect x="48" y="48" width="1104" height="654" fill="none" stroke="${light}" stroke-opacity=".68"/>
  <text x="82" y="104" fill="${light}" font-family="Arial, sans-serif" font-size="25" letter-spacing="7">GATHER / PREVIEW ${String(number).padStart(2, '0')}</text>
  <text x="82" y="635" fill="${light}" font-family="Georgia, serif" font-size="58" letter-spacing="2">${label}</text>
</svg>`
  writeFileSync(join(output, `${id}.svg`), svg)
}
