/** Seizoensthema's: ze veranderen alleen het feestje bij consensus en een klein accent. */

import { pick } from './game'

export interface Theme {
  name: string
  when: string
  kind: 'fall' | 'burst'
  shape: 'rect' | 'dot' | 'char' | 'egg'
  colors: string[]
  chars?: string[]
}

export const THEMES: Record<string, Theme> = {
  sinterklaas: { name: 'Sinterklaas', when: '15 nov t/m 5 dec', kind: 'fall', shape: 'dot', colors: ['#8a4b1f', '#a0612b', '#6e3a17', '#b8773a'] },
  kerst: { name: 'Kerst', when: '6 t/m 26 dec', kind: 'fall', shape: 'char', chars: ['❄'], colors: ['#9fd3ff', '#cfe9ff', '#7fb8e6'] },
  oudnieuw: { name: 'Oud en nieuw', when: '27 dec t/m 2 jan', kind: 'burst', shape: 'dot', colors: ['#ffb612', '#e5195e', '#2ec4b6', '#9b5de5', '#f9e11e'] },
  valentijn: { name: 'Valentijn', when: '14 feb', kind: 'fall', shape: 'char', chars: ['❤'], colors: ['#e5195e', '#ff6b9a', '#c9184a'] },
  aprilgrap: { name: '1 april', when: '1 apr', kind: 'fall', shape: 'rect', colors: ['#42145f', '#ffb612', '#e3dce7', '#f9e11e'] },
  pasen: { name: 'Pasen', when: 'Goede Vrijdag t/m 2e paasdag', kind: 'fall', shape: 'egg', colors: ['#ffd6e0', '#c1f0d0', '#fff3b0', '#cde4ff', '#e6d4ff'] },
  koningsdag: { name: 'Koningsdag', when: '27 apr (26 apr als dat een zondag is)', kind: 'fall', shape: 'rect', colors: ['#ff7f00', '#ff9f1c', '#ffffff', '#e15a00'] },
  halloween: { name: 'Halloween', when: '25 t/m 31 okt', kind: 'fall', shape: 'char', chars: ['🦇'], colors: ['#000'] },
}

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

export const MITRE =
  '<svg class="mitre" viewBox="0 0 16 20" aria-hidden="true"><path d="M8 1 C3 5 2 9 2.5 19 h11 C14 9 13 5 8 1z" fill="#c8102e"/><path d="M2.6 16h10.8v3H2.6z" fill="#f2c14e"/><path d="M8 5v8M5.5 8.5h5" stroke="#f2c14e" stroke-width="1.6"/></svg>'
export const HAT =
  '<svg class="hat" viewBox="0 0 30 24" aria-hidden="true"><path d="M4 18 C8 6 16 2 25 5 L22 18z" fill="#d62828"/><rect x="2" y="16" width="24" height="6" rx="3" fill="#fff" stroke="#ddd"/><circle cx="26" cy="5" r="3.5" fill="#fff" stroke="#ddd"/></svg>'

/** Een feestje binnen het app-scherm: vallende of spattende deeltjes in de stijl van het thema. */
export function party(host: HTMLElement, themeId: string | null) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const t = (themeId && THEMES[themeId]) || DEFAULT_PARTY
  const box = document.createElement('div')
  box.className = 'party'
  box.setAttribute('aria-hidden', 'true')
  const n = t.kind === 'burst' ? 60 : 44
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span')
    s.className = 'bit' + (t.kind === 'burst' ? ' burst' : '')
    const color = pick(t.colors)
    if (t.shape === 'char') {
      s.textContent = pick(t.chars ?? ['•'])
      s.style.color = color
      s.style.fontSize = 14 + Math.random() * 14 + 'px'
    } else {
      const w = t.shape === 'egg' ? 12 : t.shape === 'dot' ? 9 + Math.random() * 5 : 7 + Math.random() * 6
      s.style.width = w + 'px'
      s.style.height = (t.shape === 'egg' ? w * 1.35 : t.shape === 'dot' ? w : w * 0.45) + 'px'
      s.style.background = color
      s.style.borderRadius = t.shape === 'egg' ? '50% 50% 50% 50% / 60% 60% 40% 40%' : t.shape === 'dot' ? '50%' : '2px'
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
