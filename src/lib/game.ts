/** Spelregels: kaarten, uitslag, microfoon en prijsuitreiking. */

export const DECK = ['0', '1', '2', '3', '5', '8', '13', '21', '?']
export const NUMS = DECK.filter((v) => v !== '?')
export const MAX_PLAYERS = 12

export const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

export interface Summary {
  avg: number
  median: number
  near: string
  consensus: boolean
}

/** Gemiddelde, mediaan en de kaart die het dichtst bij het gemiddelde ligt (bij gelijkspel de hogere). */
export function summarize(votes: Record<string, string>): Summary | null {
  const vals = Object.values(votes)
    .filter((v) => v !== '?')
    .map(Number)
    .sort((a, b) => a - b)
  if (!vals.length) return null
  const avg = vals.reduce((s, n) => s + n, 0) / vals.length
  const mid = Math.floor(vals.length / 2)
  const median = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
  const near = NUMS.map(Number).reduce((best, n) =>
    Math.abs(n - avg) < Math.abs(best - avg) || (Math.abs(n - avg) === Math.abs(best - avg) && n > best) ? n : best,
  )
  const consensus = vals.length > 1 && vals.every((n) => n === vals[0])
  return { avg, median, near: String(consensus ? vals[0] : near), consensus }
}

/**
 * Wie krijgt een microfoontje?
 * 1. Niemand bij consensus of als laag en hoog één kaart uit elkaar liggen.
 * 2. Elke kant (laag, hoog) hooguit één microfoon.
 * 3. De grootste groep hoeft niet uit te leggen.
 * 4. Zijn beide kanten de grootste groep (twee kampen), dan krijgt elke kant een woordvoerder.
 */
export function micsFor(votes: Record<string, string>): string[] {
  const entries = Object.entries(votes).filter(([, v]) => v !== '?')
  if (entries.length < 2) return []
  const idx = (v: string) => NUMS.indexOf(v)
  const values = entries.map(([, v]) => v)
  const low = values.reduce((a, b) => (idx(b) < idx(a) ? b : a))
  const high = values.reduce((a, b) => (idx(b) > idx(a) ? b : a))
  if (idx(high) - idx(low) <= 1) return []
  const groups: Record<string, string[]> = {}
  for (const [who, v] of entries) (groups[v] ||= []).push(who)
  const biggest = Math.max(...Object.values(groups).map((g) => g.length))
  const lowBig = groups[low].length === biggest
  const highBig = groups[high].length === biggest
  const sides = lowBig && highBig ? [low, high] : [low, high].filter((v) => groups[v].length < biggest)
  return sides.map((v) => pick(groups[v]))
}

export interface HistoryRound {
  at: number
  votes: Record<string, { name: string; value: string }>
  times?: Record<string, number>
  near?: string | null
  consensus?: boolean
}

export interface Award {
  icon: string
  title: string
  who: string
  why: string
}

const listNames = (raw: string[]) => {
  const list = [...raw].sort((a, b) => (a === 'Jij' ? -1 : b === 'Jij' ? 1 : 0))
  return list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} en ${list[list.length - 1]}`
}

/** Titels op basis van alle gespeelde rondes. Een titel gaat naar hooguit twee mensen. */
export function awards(history: HistoryRound[], meId: string, fmt: (n: number) => string): Award[] {
  const rounds = history.length
  const names: Record<string, string> = {}
  const count: Record<string, { mind: number; low: number; high: number; unsure: number; time: number[] }> = {}
  const get = (id: string) => (count[id] ||= { mind: 0, low: 0, high: 0, unsure: 0, time: [] })
  for (const r of history) {
    const votes = r.votes ?? {}
    for (const [id, v] of Object.entries(votes)) {
      names[id] = v.name
      const c = get(id)
      if (v.value === '?') c.unsure++
    }
    for (const [id, t] of Object.entries(r.times ?? {})) if (votes[id]) get(id).time.push(t)
    const nums = Object.entries(votes).filter(([, v]) => v.value !== '?')
    if (!nums.length) continue
    const vals = nums.map(([, v]) => Number(v.value))
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    for (const [id, v] of nums) {
      if (r.near && v.value === r.near) get(id).mind++
      if (max > min && Number(v.value) === min) get(id).low++
      if (max > min && Number(v.value) === max) get(id).high++
    }
  }
  const ids = Object.keys(count)
  const label = (id: string) => (id === meId ? 'Jij' : names[id] ?? 'Iemand')
  const best = (key: 'mind' | 'low' | 'high' | 'unsure'): [string[], number] | null => {
    const top = Math.max(0, ...ids.map((id) => count[id][key]))
    const who = ids.filter((id) => count[id][key] === top)
    return top >= 1 && who.length <= 2 ? [who, top] : null
  }
  const out: Award[] = []
  const mind = best('mind')
  if (mind) out.push({ icon: '🔮', title: 'Gedachtelezer', who: listNames(mind[0].map(label)), why: `zat ${mind[1]} van de ${rounds} keer precies op de uitkomst` })
  const low = best('low')
  if (low) out.push({ icon: '🌈', title: 'Optimist', who: listNames(low[0].map(label)), why: `stemde ${low[1]} keer het laagst` })
  const high = best('high')
  if (high) out.push({ icon: '⛈️', title: 'Doemdenker', who: listNames(high[0].map(label)), why: `stemde ${high[1]} keer het hoogst` })
  const avgTime = (id: string) => (count[id].time.length ? count[id].time.reduce((a, b) => a + b, 0) / count[id].time.length : Infinity)
  const fastest = ids.filter((id) => isFinite(avgTime(id))).sort((a, b) => avgTime(a) - avgTime(b))[0]
  if (fastest) out.push({ icon: '⚡', title: 'Snelste vinger', who: label(fastest), why: `koos gemiddeld binnen ${fmt(avgTime(fastest) / 1000)} seconden` })
  const unsure = best('unsure')
  if (unsure) out.push({ icon: '🤷', title: 'Twijfelaar', who: listNames(unsure[0].map(label)), why: `trok ${unsure[1]} keer het vraagteken` })
  return out
}
