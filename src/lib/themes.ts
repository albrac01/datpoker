/** Seizoensthema's: ze veranderen alleen het feestje bij consensus en een klein accent. */

import { pick } from './game'

export interface Theme {
  name: string
  when: string
  kind: 'fall' | 'burst'
  shape: 'rect' | 'dot' | 'char' | 'egg' | 'heart'
  colors: string[]
  chars?: string[]
}

export const THEMES: Record<string, Theme> = {
  sinterklaas: { name: 'Sinterklaas', when: '15 nov t/m 5 dec', kind: 'fall', shape: 'dot', colors: ['#8a4b1f', '#a0612b', '#6e3a17', '#b8773a'] },
  kerst: { name: 'Kerst', when: '6 t/m 26 dec', kind: 'fall', shape: 'char', chars: ['❄'], colors: ['#9fd3ff', '#cfe9ff', '#7fb8e6'] },
  oudnieuw: { name: 'Oud en nieuw', when: '27 dec t/m 2 jan', kind: 'burst', shape: 'dot', colors: ['#ffb612', '#e5195e', '#2ec4b6', '#9b5de5', '#f9e11e'] },
  valentijn: { name: 'Valentijn', when: '14 feb', kind: 'fall', shape: 'heart', colors: ['#e5195e', '#ff6b9a', '#c9184a'] },
  aprilgrap: { name: '1 april', when: '1 apr', kind: 'fall', shape: 'rect', colors: ['#42145f', '#ffb612', '#e3dce7', '#f9e11e'] },
  pasen: { name: 'Pasen', when: 'Goede Vrijdag t/m 2e paasdag', kind: 'fall', shape: 'egg', colors: ['#ffd6e0', '#c1f0d0', '#fff3b0', '#cde4ff', '#e6d4ff'] },
  koningsdag: { name: 'Koningsdag', when: '27 apr (26 apr als dat een zondag is)', kind: 'fall', shape: 'rect', colors: ['#ff7f00', '#ff9f1c', '#ffffff', '#e15a00'] },
  halloween: { name: 'Halloween', when: '25 t/m 31 okt', kind: 'fall', shape: 'char', chars: ['🦇'], colors: ['#000'] },
}

// Easter eggs: goud bij een hattrick, koffie als niemand het weet
export const GOLD_PARTY: Theme = { name: 'Hattrick', when: '', kind: 'fall', shape: 'rect', colors: ['#ffd54a', '#f2c14e', '#ffb612', '#fff0b8', '#d9a520'] }
export const COFFEE_PARTY: Theme = { name: 'Koffie', when: '', kind: 'fall', shape: 'char', chars: ['☕'], colors: ['#000'] }

const DEFAULT_PARTY: Theme = { name: 'Standaard', when: '', kind: 'fall', shape: 'rect', colors: ['#42145f', '#ffb612', '#e3dce7', '#f9e11e', '#8fcae7'] }

/** Paaszondag volgens het gregoriaanse rekenschema. */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(y, month, day)
}

export function themeForDate(d: Date): string | null {
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate()
  const md = m * 100 + day
  if (md >= 1115 && md <= 1205) return 'sinterklaas'
  if (md >= 1206 && md <= 1226) return 'kerst'
  if (md >= 1227 || md <= 102) return 'oudnieuw'
  if (md === 214) return 'valentijn'
  if (md === 401) return 'aprilgrap'
  const e = easter(y)
  const from = new Date(e), to = new Date(e)
  from.setDate(e.getDate() - 2)
  to.setDate(e.getDate() + 1)
  const today = new Date(y, m - 1, day)
  if (today >= from && today <= to) return 'pasen'
  const kingsDay = new Date(y, 3, 27).getDay() === 0 ? 26 : 27
  if (m === 4 && day === kingsDay) return 'koningsdag'
  if (md >= 1025 && md <= 1031) return 'halloween'
  return null
}

// Mijter van Sinterklaas, met verlopen en glimlicht voor een ruimtelijk effect
export const MITRE =
  '<svg class="mitre" viewBox="0 0 28 34" aria-hidden="true"><defs><linearGradient id="mt-l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5a5f"/><stop offset="0.55" stop-color="#e0213a"/><stop offset="1" stop-color="#b3132a"/></linearGradient><linearGradient id="mt-r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a40f25"/><stop offset="1" stop-color="#6e0717"/></linearGradient><linearGradient id="mt-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset="0.45" stop-color="#f2c14e"/><stop offset="1" stop-color="#b8861b"/></linearGradient><linearGradient id="mt-gv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff0b8"/><stop offset="0.5" stop-color="#f2c14e"/><stop offset="1" stop-color="#a87814"/></linearGradient><radialGradient id="mt-s" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="14" cy="31.6" rx="11" ry="2.2" fill="url(#mt-s)"/><path d="M14 1.5 C8.5 6 4.6 11 4.2 20 L4 29 L14 29 Z" fill="url(#mt-l)"/><path d="M14 1.5 C19.5 6 23.4 11 23.8 20 L24 29 L14 29 Z" fill="url(#mt-r)"/><path d="M12.6 3.4 C8.6 7.2 6 11.6 5.6 19" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="1.1" stroke-linecap="round"/><path d="M14 7.6 V20 M10 12 H18" stroke="#4a0410" stroke-width="3.4" stroke-linecap="round" transform="translate(.5 .6)" opacity=".45"/><path d="M14 7.6 V20 M10 12 H18" stroke="url(#mt-gv)" stroke-width="3" stroke-linecap="round"/><path d="M13.4 8.4 V19 M10.8 11.5 H13" stroke="#fff6cf" stroke-width=".8" stroke-linecap="round" stroke-opacity=".9"/><path d="M3.4 24.6 Q14 26.6 24.6 24.6 L24.6 29.4 Q14 31.4 3.4 29.4 Z" fill="url(#mt-g)"/><path d="M3.4 24.6 Q14 26.6 24.6 24.6" fill="none" stroke="#fff6cf" stroke-width=".8" stroke-opacity=".9"/><path d="M3.4 29.4 Q14 31.4 24.6 29.4" fill="none" stroke="#8a6110" stroke-width=".7" stroke-opacity=".8"/><circle cx="14" cy="27.6" r="1.5" fill="#2e7de9"/><circle cx="13.5" cy="27.1" r=".5" fill="#ffffff" fill-opacity=".85"/></svg>'
// Kerstmuts op je eigen kaart, met verlopen en een zacht pompon
export const HAT =
  '<svg class="hat" viewBox="0 0 34 28" aria-hidden="true"><defs><linearGradient id="ht-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a5f"/><stop offset="0.5" stop-color="#d62839"/><stop offset="1" stop-color="#8e0f1f"/></linearGradient><linearGradient id="ht-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#eef1f6"/><stop offset="1" stop-color="#c7cdd8"/></linearGradient><radialGradient id="ht-p" cx="0.38" cy="0.35" r="0.65"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#eef1f6"/><stop offset="1" stop-color="#b9c0cc"/></radialGradient></defs><path d="M5 20 C7 10 14 3.5 24 4.2 C26.5 4.4 28 6 28.2 8 L25.5 20 Z" fill="url(#ht-r)"/><path d="M8.5 17 C10.5 10 15.5 6 22.5 6" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"/><path d="M20 20 C22 14 24.5 9.5 27.6 7.6 L25.5 20 Z" fill="#000" fill-opacity=".18"/><rect x="2.5" y="18" width="26" height="7" rx="3.5" fill="url(#ht-w)"/><path d="M5 19.4 H26" stroke="#ffffff" stroke-width=".9" stroke-linecap="round"/><circle cx="28.4" cy="7.4" r="4" fill="url(#ht-p)"/></svg>'

/** Kleur mengen met wit (amt > 0) of zwart (amt < 0), voor licht en schaduw. */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255)
  return `rgb(${r}, ${g}, ${b})`
}

let heartId = 0
function heartSvg(color: string, size: number) {
  const id = `hg${heartId++}`
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 22" style="display:block;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.3))"><defs><radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${shade(color, 0.55)}"/><stop offset=".5" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -0.35)}"/></radialGradient></defs><path d="M12 21 C5 15.5 1 12 1 7 A5.5 5.5 0 0 1 12 4.5 A5.5 5.5 0 0 1 23 7 C23 12 19 15.5 12 21Z" fill="url(#${id})"/><ellipse cx="7" cy="6.5" rx="2.4" ry="1.4" fill="#fff" fill-opacity=".45" transform="rotate(-30 7 6.5)"/></svg>`
}

/** Een feestje binnen het app-scherm: vallende of spattende deeltjes in de stijl van het thema. */
export function party(host: HTMLElement, theme: string | Theme | null) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const t = typeof theme === 'object' && theme ? theme : (theme && THEMES[theme]) || DEFAULT_PARTY
  const box = document.createElement('div')
  box.className = 'party'
  box.setAttribute('aria-hidden', 'true')
  const n = t.kind === 'burst' ? 60 : 44
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span')
    s.className = 'bit' + (t.kind === 'burst' ? ' burst' : '')
    const color = pick(t.colors)
    // Alles met licht en schaduw, zodat het feestje ruimtelijk oogt
    if (t.shape === 'heart') {
      s.innerHTML = heartSvg(color, 14 + Math.random() * 12)
    } else if (t.shape === 'char') {
      s.textContent = pick(t.chars ?? ['•'])
      s.style.color = color
      s.style.fontSize = 14 + Math.random() * 14 + 'px'
      s.style.textShadow = `0 0 6px ${shade(color, 0.6)}, 0 1px 2px rgba(0, 0, 0, 0.35)`
    } else {
      const w = t.shape === 'egg' ? 11 + Math.random() * 4 : t.shape === 'dot' ? 9 + Math.random() * 5 : 7 + Math.random() * 6
      s.style.width = w + 'px'
      s.style.height = (t.shape === 'egg' ? w * 1.35 : t.shape === 'dot' ? w : w * 0.45) + 'px'
      s.style.borderRadius = t.shape === 'egg' ? '50% 50% 50% 50% / 60% 60% 40% 40%' : t.shape === 'dot' ? '50%' : '2px'
      if (t.shape === 'rect') {
        s.style.background = `linear-gradient(135deg, ${shade(color, 0.45)} 0%, ${color} 45%, ${shade(color, -0.3)} 100%)`
        s.style.boxShadow = '0 1px 1.5px rgba(0, 0, 0, 0.25)'
      } else {
        s.style.background = `radial-gradient(circle at 35% 30%, ${shade(color, 0.5)} 0%, ${color} 50%, ${shade(color, -0.35)} 100%)`
        s.style.boxShadow = t.kind === 'burst' ? `0 0 8px ${color}, 0 0 2px ${shade(color, 0.6)}` : '0 1.5px 2px rgba(0, 0, 0, 0.3)'
      }
    }
    if (t.kind === 'burst') {
      const centers = [[30, 28], [70, 22], [50, 45]]
      const [cx, cy] = centers[i % centers.length]
      const ang = Math.random() * Math.PI * 2
      const dist = 50 + Math.random() * 70
      s.style.setProperty('--x', cx + '%')
      s.style.setProperty('--y', cy + '%')
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px')
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px')
      s.style.setProperty('--delay', (i % 3) * 0.35 + 's')
    } else {
      s.style.left = Math.random() * 100 + '%'
      s.style.setProperty('--dx', Math.random() * 100 - 50 + 'px')
      s.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg')
      s.style.setProperty('--dur', 1.6 + Math.random() * 1.1 + 's')
      s.style.setProperty('--delay', Math.random() * 0.4 + 's')
    }
    box.append(s)
  }
  host.append(box)
  setTimeout(() => box.remove(), 3200)
}
