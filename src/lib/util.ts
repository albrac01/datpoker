export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T

export const fmt = (n: number) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 })

export const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

export const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* opslag niet beschikbaar */
    }
  },
}

const ADJECTIVES = ['snelle', 'stille', 'dappere', 'vrolijke', 'slimme', 'rustige', 'wakkere', 'gouden', 'koene', 'vlotte', 'wijze', 'zonnige', 'frisse', 'blije', 'nuchtere', 'lieve']
const ANIMALS = ['otter', 'reiger', 'vos', 'egel', 'uil', 'das', 'kievit', 'zeehond', 'eekhoorn', 'merel', 'haas', 'bever', 'ooievaar', 'mol', 'spreeuw', 'grutto']

/** Leesbare code voor in de link, bijvoorbeeld "vlotte-otter-27". */
export function roomCode() {
  const p = <T>(l: T[]) => l[Math.floor(Math.random() * l.length)]
  return `${p(ADJECTIVES)}-${p(ANIMALS)}-${Math.floor(10 + Math.random() * 90)}`
}

export const shortId = () => Math.random().toString(36).slice(2, 10)
