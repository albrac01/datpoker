import './style.css'
import qrcode from 'qrcode-generator'
import { getBackend, type Backend, type Unsub } from './lib/sync'
import { DECK, MAX_PLAYERS, awards, micsFor, summarize, type HistoryRound } from './lib/game'
import { COFFEE_PARTY, GOLD_PARTY, HAT, MITRE, THEMES, party, themeForDate } from './lib/themes'
import { $, esc, fmt, roomCode, shortId, store } from './lib/util'

// ---------- datamodel ----------
interface Player { name: string; joinedAt: number; online?: boolean; lastSeen?: number }
interface Vote { value: string; round: string; at: number }
interface Round { id: string; n: number; revealed: boolean; startedAt: number; revealedAt?: number; mics?: string[] }
interface Meta { team: string; createdBy: string; hostName: string; createdAt: number; finished?: number | null; autoReveal?: boolean }
interface Room { meta?: Meta; players?: Record<string, Player>; round?: Round; votes?: Record<string, Vote>; history?: Record<string, HistoryRound> }
interface Nudge { from: string; fromName: string; at: number }

const SCREENS = ['sLoading', 'sMissing', 'sStart', 'sInvite', 'sJoin', 'sTable'] as const
type Screen = (typeof SCREENS)[number]

let backend: Backend
let code: string | null = null
let room: Room | null | undefined
let subs: Unsub[] = []
let presenceOff: Unsub | null = null
let current: Screen = 'sLoading'
let showInvite = false
let lastRevealed: string | null | undefined // undefined: nog niet geladen
let finishShownFor = 0
const nudgeCooldown: Record<string, number> = {}

const app = $('app')

// ---------- algemeen: schermen, meldingen, vensters ----------
function show(id: Screen) {
  current = id
  for (const s of SCREENS) $(s).hidden = s !== id
  $('teamLine').hidden = id !== 'sTable'
  if (id !== 'sTable') closeSheet()
  const first = $(id).querySelector<HTMLInputElement>('input')
  if (first && !first.value) first.focus({ preventScroll: true })
}

let toastTimer = 0
function toast(msg: string) {
  document.querySelector('.toast')?.remove()
  const t = document.createElement('div')
  t.className = 'toast'
  t.setAttribute('role', 'status')
  t.textContent = msg
  app.append(t)
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => t.remove(), 2600)
}

function wiggle(el: Element | null) {
  if (!el) return
  el.classList.remove('wiggle')
  void (el as HTMLElement).offsetWidth
  el.classList.add('wiggle')
}

function openSheet(kind: string, html: string, onReady?: (o: HTMLElement) => void) {
  closeSheet()
  const o = document.createElement('div')
  o.className = 'overlay'
  o.id = 'overlay'
  o.dataset.kind = kind
  o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`
  if (kind !== 'finish') o.addEventListener('mousedown', (e) => e.target === o && closeSheet())
  app.append(o)
  onReady?.(o)
  o.querySelector<HTMLElement>('button')?.focus()
}
function closeSheet(kind?: string) {
  const o = $('overlay')
  if (o && (!kind || o.dataset.kind === kind)) o.remove()
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('overlay')?.dataset.kind !== 'finish') closeSheet()
})

// ---------- licht en donker (per toestel) ----------
let dark = store.get('sp-theme') === 'dark'
function applyDark() {
  document.documentElement.classList.toggle('dark', dark)
  $('dark').textContent = dark ? 'Licht' : 'Donker'
  $('dark').setAttribute('aria-label', dark ? 'Lichte weergave aanzetten' : 'Donkere weergave aanzetten')
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#160f1d' : '#f6f9fc')
}
$('dark').onclick = () => {
  dark = !dark
  store.set('sp-theme', dark ? 'dark' : 'light')
  applyDark()
}

// ---------- seizoensthema's (per toestel) ----------
let themeMode = store.get('dat-thema') || 'auto' // auto | uit | <thema-id>
const activeTheme = () => (themeMode === 'uit' ? null : themeMode === 'auto' ? themeForDate(new Date()) : THEMES[themeMode] ? themeMode : null)
function applyTheme() {
  const t = activeTheme()
  for (const id of Object.keys(THEMES)) document.documentElement.classList.toggle('t-' + id, t === id)
  // Logo blijft staan; alleen het mijtertje komt erbij of gaat weg
  const title = $('title')
  title.querySelector('.mitre')?.remove()
  if (t === 'sinterklaas') title.insertAdjacentHTML('beforeend', MITRE)
  $('title').classList.toggle('flip', t === 'aprilgrap')
  $('themeBtn').setAttribute('aria-label', t ? `Feestthema's, nu ${THEMES[t].name}` : "Feestthema's")
}
$('themeBtn').onclick = () => {
  const today = themeForDate(new Date())
  const opt = (id: string, label: string, sub: string) =>
    `<button class="option" role="radio" aria-checked="${themeMode === id}" data-mode="${id}"><span>${esc(label)}</span><small>${esc(sub)}</small></button>`
  openSheet(
    'theme',
    `<h2>Feestthema's</h2>
    <p>Thema's veranderen alleen het feestje bij consensus en een klein accent. Op "Automatisch" volgen ze de datum.</p>
    <div class="options" role="radiogroup" aria-label="Thema">
      ${opt('auto', 'Automatisch', today ? `nu: ${THEMES[today].name}` : 'nu geen thema')}
      ${opt('uit', 'Uit', 'altijd gewone confetti')}
    </div>
    <p>Bekijk een thema vooraf:</p>
    <div class="options" role="radiogroup" aria-label="Voorbeeld">
      ${Object.entries(THEMES).map(([id, t]) => opt(id, t.name, t.when)).join('')}
    </div>
    <div class="row"><button class="btn secondary grow" id="tryParty">Feestje proberen</button><button class="btn primary" id="closeTheme">Klaar</button></div>`,
    (o) => {
      o.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => {
        b.onclick = () => {
          themeMode = b.dataset.mode!
          store.set('dat-thema', themeMode)
          o.querySelectorAll<HTMLElement>('[data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.mode === themeMode)))
          applyTheme()
          renderTable(true)
          party(app, activeTheme())
        }
      })
      o.querySelector<HTMLElement>('#tryParty')!.onclick = () => party(app, activeTheme())
      o.querySelector<HTMLElement>('#closeTheme')!.onclick = () => closeSheet()
    },
  )
}

// ---------- navigatie ----------
function navigate(path: string, replace = false) {
  if (replace) history.replaceState(null, '', path)
  else history.pushState(null, '', path)
  route()
}
window.addEventListener('popstate', route)

function route() {
  const m = location.pathname.match(/^\/t\/([a-z0-9-]{3,40})\/?$/i)
  if (m) openRoom(m[1].toLowerCase())
  else {
    leaveRoom()
    document.title = 'DAT pokert wat'
    const saved = store.get('dat-naam')
    if (saved && !($<HTMLInputElement>('hostName').value)) $<HTMLInputElement>('hostName').value = saved
    show('sStart')
  }
}

// ---------- kamer volgen ----------
function leaveRoom() {
  subs.forEach((u) => u())
  subs = []
  presenceOff?.()
  presenceOff = null
  code = null
  room = undefined
  lastRevealed = undefined
  lastSignature = ''
}

function openRoom(c: string) {
  if (code === c) return
  leaveRoom()
  code = c
  show('sLoading')
  $('loadingText').textContent = 'Even laden…'
  const slow = window.setTimeout(() => {
    if (room === undefined) $('loadingText').textContent = 'De verbinding duurt lang. We blijven het proberen…'
  }, 10000)
  subs.push(() => clearTimeout(slow))
  subs.push(
    backend.subscribe(
      `rooms/${c}`,
      (v) => {
        clearTimeout(slow)
        room = (v as Room | null) ?? null
        onRoom()
      },
      (err) => {
        console.error(err)
        $('missingTitle').textContent = 'Geen verbinding'
        $('missingText').textContent = 'Het team kon niet worden geladen. Controleer je internet en probeer het opnieuw.'
        show('sMissing')
      },
    ),
  )
  // Duwtjes: alleen degene die geduwd wordt kan ze lezen
  subs.push(backend.subscribe(`nudges/${c}/${backend.uid}`, (v) => onNudges(v as Record<string, Nudge> | null)))
}

const me = () => room?.players?.[backend.uid]
const isHost = () => room?.meta?.createdBy === backend.uid
const isOnline = (p: Player) => p.online !== false && (backend.staleMs <= 0 || backend.now() - (p.lastSeen ?? 0) < backend.staleMs)

/** Wie zitten er aan tafel: jijzelf eerst, daarna in volgorde van binnenkomst. */
function seated(): [string, Player][] {
  const list = Object.entries(room?.players ?? {}).filter(([id, p]) => p?.name && (id === backend.uid || isOnline(p)))
  return list.sort((a, b) => (a[0] === backend.uid ? -1 : b[0] === backend.uid ? 1 : (a[1].joinedAt ?? 0) - (b[1].joinedAt ?? 0)))
}

/** Stemmen van deze ronde, alleen van wie aan tafel zit. */
function votes(): Record<string, string> {
  const r = room?.round
  const out: Record<string, string> = {}
  const ids = new Set(seated().map(([id]) => id))
  for (const [id, v] of Object.entries(room?.votes ?? {})) if (r && v?.round === r.id && ids.has(id)) out[id] = v.value
  return out
}

function onRoom() {
  if (!room || !room.meta) {
    $('missingTitle').textContent = 'Dit team bestaat niet'
    $('missingText').textContent = 'Controleer de link, of maak zelf een team aan.'
    show('sMissing')
    return
  }
  document.title = `${room.meta.team} · DAT pokert wat`
  if (!me()?.name) {
    presenceOff?.()
    presenceOff = null
    renderJoin()
    if (current !== 'sJoin') show('sJoin')
    return
  }
  if (!presenceOff) presenceOff = backend.presence(`rooms/${code}/players/${backend.uid}`)
  if (showInvite) {
    renderInvite()
    if (current !== 'sInvite') show('sInvite')
  } else if (current !== 'sTable' && current !== 'sInvite') show('sTable')
  renderTable()
  handleReveal()
  handleFinish()
  maybeAutoReveal()
}

// ---------- 1. team aanmaken ----------
$<HTMLFormElement>('startForm').onsubmit = async (e) => {
  e.preventDefault()
  const name = $<HTMLInputElement>('hostName').value.trim()
  const team = $<HTMLInputElement>('newTeam').value.trim()
  const err = $('startError')
  err.hidden = Boolean(name && team)
  err.textContent = !name && !team ? 'Vul je naam en een teamnaam in.' : !name ? 'Vul je naam in.' : 'Vul een teamnaam in.'
  if (!name || !team) return
  const btn = $<HTMLButtonElement>('createBtn')
  btn.disabled = true
  btn.textContent = 'Team aanmaken…'
  try {
    let c = roomCode()
    for (let i = 0; i < 5 && (await backend.get(`rooms/${c}/meta/team`)) !== null; i++) c = roomCode()
    const now = backend.now()
    await backend.set(`rooms/${c}`, {
      meta: { team, createdBy: backend.uid, hostName: name, createdAt: now, autoReveal: $<HTMLInputElement>('autoReveal').checked },
      round: { id: shortId(), n: 1, revealed: false, startedAt: now },
      players: { [backend.uid]: { name, joinedAt: now, online: true, lastSeen: now } },
    })
    store.set('dat-naam', name)
    showInvite = true
    navigate(`/t/${c}`)
  } catch (error) {
    console.error(error)
    err.hidden = false
    err.textContent = 'Het aanmaken lukte niet. Controleer je internet en probeer het opnieuw.'
  } finally {
    btn.disabled = false
    btn.textContent = 'Team aanmaken'
  }
}

// ---------- 2. link delen ----------
const roomUrl = () => `${location.origin}/t/${code}`
function renderInvite() {
  const team = room?.meta?.team ?? 'Je team'
  $('inviteTitle').textContent = isHost() && showInvite ? `${team} staat klaar` : `Nodig je team uit voor ${team}`
  $('link').textContent = roomUrl().replace(/^https?:\/\//, '')
  try {
    const q = qrcode(0, 'M')
    q.addData(roomUrl())
    q.make()
    $('qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
    $('qr').hidden = false
  } catch {
    $('qr').hidden = true
  }
}
$('copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(roomUrl())
    toast('Link gekopieerd')
  } catch {
    toast('Kopiëren lukte niet. Houd de link ingedrukt om te kopiëren.')
  }
}
$('share').onclick = async () => {
  const team = room?.meta?.team ?? 'ons team'
  if (navigator.share) {
    try {
      await navigator.share({ title: team, text: `Doe mee met ${team} op DAT pokert wat`, url: roomUrl() })
    } catch {
      /* gebruiker brak het delen af */
    }
  } else toast('Delen kan op je telefoon. Kopieer hier de link.')
}
$('toTable').onclick = () => {
  showInvite = false
  show('sTable')
  renderTable(true)
}
$('toStart').onclick = () => navigate('/')

// ---------- 3. meedoen via de link ----------
function renderJoin() {
  const m = room!.meta!
  $('joinBy').textContent = `${m.hostName} nodigt je uit voor`
  $('joinTeam').textContent = m.team
  const here = seated().map(([, p]) => p.name)
  $('joinHere').textContent =
    here.length === 0 ? 'Er zit nog niemand aan tafel.' : here.length === 1 ? `${here[0]} zit al aan tafel.` : here.length <= 3 ? `${here.slice(0, -1).join(', ')} en ${here[here.length - 1]} zitten al aan tafel.` : `${here.length} mensen zitten al aan tafel.`
  const input = $<HTMLInputElement>('joinName')
  if (!input.value) input.value = store.get('dat-naam') ?? ''
}
$<HTMLFormElement>('joinForm').onsubmit = async (e) => {
  e.preventDefault()
  const name = $<HTMLInputElement>('joinName').value.trim()
  const err = $('joinError')
  err.hidden = true
  if (!name) {
    err.hidden = false
    err.textContent = 'Vul je naam in om mee te doen.'
    return
  }
  if (seated().length >= MAX_PLAYERS) {
    err.hidden = false
    err.textContent = `Deze tafel is vol: er kunnen maximaal ${MAX_PLAYERS} mensen meedoen.`
    return
  }
  const btn = $<HTMLButtonElement>('joinBtn')
  btn.disabled = true
  try {
    const now = backend.now()
    store.set('dat-naam', name)
    await backend.set(`rooms/${code}/players/${backend.uid}`, { name, joinedAt: now, online: true, lastSeen: now })
    toast(`Welkom, ${name}`)
  } catch (error) {
    console.error(error)
    err.hidden = false
    err.textContent = 'Meedoen lukte niet. Probeer het opnieuw.'
  } finally {
    btn.disabled = false
  }
}

// ---------- 4. de tafel ----------
function renderTeamName() {
  $('teamName').textContent = room?.meta?.team ?? ''
}

// Teammenu: uitnodigen, teamnaam wijzigen (alleen starter) en de tafel verlaten
$('teamBtn').onclick = () => {
  const team = room?.meta?.team ?? 'Team'
  const host = isHost()
  openSheet(
    'team',
    `<h2>${esc(team)}</h2>
    ${host ? `<form class="team-form" id="renameForm"><label class="sr-only" for="renameInput">Teamnaam</label><input id="renameInput" maxlength="24" value="${esc(team)}"><button class="btn secondary">Opslaan</button></form>` : ''}
    ${
      host
        ? `<label class="switch-row" for="menuAuto"><span><b>Kaarten automatisch omdraaien</b><small>Zodra iedereen gestemd heeft</small></span><input type="checkbox" role="switch" id="menuAuto" ${autoRevealOn() ? 'checked' : ''}></label>`
        : `<p>${autoRevealOn() ? 'De kaarten gaan vanzelf om zodra iedereen gestemd heeft.' : 'De kaarten gaan om als iemand op Kaarten omdraaien tikt.'}</p>`
    }
    <button class="btn secondary wide" id="menuInvite">Teamgenoten uitnodigen</button>
    <button class="btn secondary wide danger" id="menuLeave">Tafel verlaten</button>
    <p>${host ? 'Je blijft de starter: via de link kom je later terug en kun je weer afronden.' : 'Via de link kun je later altijd weer meedoen.'}</p>
    <button class="btn primary wide" id="menuClose">Sluiten</button>`,
    (o) => {
      const form = o.querySelector<HTMLFormElement>('#renameForm')
      if (form)
        form.onsubmit = async (e) => {
          e.preventDefault()
          const v = o.querySelector<HTMLInputElement>('#renameInput')!.value.trim()
          if (v && v !== team) {
            await backend.update(`rooms/${code}/meta`, { team: v })
            toast('Teamnaam gewijzigd')
          }
          closeSheet()
        }
      const auto = o.querySelector<HTMLInputElement>('#menuAuto')
      if (auto)
        auto.onchange = async () => {
          await backend.update(`rooms/${code}/meta`, { autoReveal: auto.checked })
          toast(auto.checked ? 'Kaarten gaan nu automatisch om' : 'Kaarten draaien jullie nu zelf om')
        }
      o.querySelector<HTMLElement>('#menuInvite')!.onclick = () => {
        closeSheet()
        renderInvite()
        show('sInvite')
      }
      o.querySelector<HTMLElement>('#menuLeave')!.onclick = () => void leaveTable()
      o.querySelector<HTMLElement>('#menuClose')!.onclick = () => closeSheet()
    },
  )
}

async function leaveTable() {
  const team = room?.meta?.team ?? 'het team'
  const c = code
  closeSheet()
  leaveRoom() // eerst stoppen met volgen, zodat het meedoen-scherm niet even verschijnt
  try {
    await backend.update(`rooms/${c}`, { [`players/${backend.uid}`]: null, [`votes/${backend.uid}`]: null })
  } catch (error) {
    console.error(error)
  }
  navigate('/')
  toast(`Je hebt ${team} verlaten`)
}

let lastSignature = ''
function renderTable(force = false) {
  if (!room?.meta || !me()) return
  renderTeamName()
  const people = seated()
  const v = votes()
  const r = room.round
  const revealed = Boolean(r?.revealed)
  // Alleen opnieuw tekenen als er voor de speler iets zichtbaars verandert (niet bij elk aanwezigheidssignaal)
  const signature = JSON.stringify([people.map(([id, p]) => [id, p.name]), v, r, isHost(), activeTheme()])
  if (!force && signature === lastSignature) return
  lastSignature = signature
  const voted = people.filter(([id]) => v[id] !== undefined).length
  const myVote = v[backend.uid]
  const summary = revealed ? summarize(v) : null
  const mics = revealed ? (r?.mics ?? []) : []
  const theme = activeTheme()

  // indeling: 2-6 spelers één rij, 7-8 twee rijen van 4, 9-12 twee rijen van 6
  const n = people.length
  app.classList.toggle('row6', n > 4 && n <= 6)
  app.classList.toggle('rows2', n > 6)
  app.classList.toggle('cols6', n > 8)
  $('team').style.setProperty('--cols', String(n <= 6 ? Math.max(n, 3) : n <= 8 ? 4 : 6))

  const team = $('team')
  team.innerHTML = ''
  for (const [id, p] of people) {
    const value = v[id] ?? null
    const self = id === backend.uid
    const li = document.createElement('li')
    li.className = 'seat' + (self ? ' me' : '')
    li.dataset.seat = id
    const btn = document.createElement('button')
    btn.className = 'seat-btn'
    const canNudge = !self && value === null && !revealed
    btn.disabled = !canNudge
    btn.setAttribute('aria-label', `${self ? 'Jij' : p.name}: ${value === null ? 'nog niet gestemd' + (canNudge ? ', tik voor een duwtje' : '') : revealed ? value : 'heeft gestemd'}`)
    if (canNudge) btn.onclick = () => nudge(id, p.name)
    const slot = document.createElement('span')
    slot.className = 'slot' + (value !== null ? (revealed ? ' open' : ' voted') : '') + (revealed && summary?.consensus ? ' agree' : '')
    if (revealed && value !== null) slot.textContent = value
    if (self && theme === 'kerst') slot.insertAdjacentHTML('beforeend', HAT)
    if (revealed && mics.includes(id)) slot.insertAdjacentHTML('beforeend', '<span class="mic" title="Mag uitleggen">🎤</span>')
    const label = document.createElement('span')
    label.className = 'name'
    label.textContent = self ? 'Jij' : p.name
    label.title = p.name
    btn.append(slot, label)
    li.append(btn)
    team.append(li)
  }

  $('reveal').hidden = revealed
  $<HTMLButtonElement>('reveal').disabled = voted === 0
  $('reset').hidden = !revealed
  $('finish').hidden = !isHost()

  const cards = $('cards')
  cards.innerHTML = ''
  for (const c of DECK) {
    const b = document.createElement('button')
    b.className = 'card'
    b.textContent = c
    b.setAttribute('role', 'radio')
    b.setAttribute('aria-checked', String(myVote === c))
    b.setAttribute('aria-label', c === '?' ? 'Weet ik niet' : c)
    b.disabled = revealed
    b.onclick = () => castVote(myVote === c ? null : c)
    cards.append(b)
  }
  $('handTitle').textContent = revealed ? 'Wacht op de volgende story' : myVote ? 'Gestemd. Je kunt nog wisselen.' : 'Kies je kaart'

  const hint = $('hint')
  hint.hidden = revealed
  hint.textContent =
    n === 1
      ? 'Je zit nog alleen aan tafel. Tik op Uitnodigen om je team erbij te halen.'
      : voted === n
        ? autoRevealOn()
          ? 'Iedereen heeft gestemd. De kaarten gaan om…'
          : 'Iedereen heeft gestemd. Draai de kaarten om.'
        : myVote
          ? `${voted} van ${n} gestemd. ${autoRevealOn() ? 'De kaarten gaan vanzelf om als iedereen klaar is.' : 'Wachten op de rest…'}`
          : 'Kies hieronder je kaart. Je teamgenoten zien alleen dát je gestemd hebt.'

  const res = $('result')
  res.hidden = !revealed
  if (revealed) {
    res.innerHTML = ''
    const grid = document.createElement('div')
    grid.className = 'result'
    if (!summary)
      grid.innerHTML = everyoneUnsure(v)
        ? '<p class="agree">☕ Niemand weet het. Tijd voor koffie?</p>'
        : '<p class="agree">Er is geen schatting met een getal.</p>'
    else {
      for (const [k, val] of [['Gemiddelde', fmt(summary.avg)], ['Mediaan', fmt(summary.median)], [summary.consensus ? 'Consensus' : 'Voorstel', summary.near]]) {
        const d = document.createElement('div')
        d.innerHTML = `<b>${esc(val)}</b><span>${esc(k)}</span>`
        grid.append(d)
      }
      const p = document.createElement('p')
      p.className = 'agree'
      const nameOf = (id: string) => (id === backend.uid ? 'Jij' : room?.players?.[id]?.name ?? 'Iemand')
      const who = mics.filter((id) => v[id] !== undefined).map((id) => `${nameOf(id)} (${v[id]})`)
      const numeric = Object.values(v).filter((x) => x !== '?').length
      const streak = summary.consensus ? consensusStreak() : 0
      p.textContent = summary.consensus
        ? streak === 3
          ? '🏆 Hattrick! Drie keer op rij consensus.'
          : streak > 3
            ? `🏆 Alweer! ${streak} keer op rij consensus.`
            : 'Iedereen is het eens.'
        : numeric === 1
          ? 'Er is maar één stem met een getal.'
          : who.length === 2
            ? `🎤 ${who[0]} en ${who[1]}: leg kort uit waarom.`
            : who.length === 1
              ? `🎤 ${who[0]}: leg kort uit waarom.`
              : 'De stemmen liggen dicht bij elkaar. Kies samen één kaart.'
      grid.append(p)
    }
    res.append(grid)
  }
}

// ---------- acties ----------
function castVote(value: string | null) {
  const r = room?.round
  if (!r || r.revealed) return
  const path = `rooms/${code}/votes/${backend.uid}`
  void (value === null ? backend.remove(path) : backend.set(path, { value, round: r.id, at: backend.now() } satisfies Vote))
}

$('reveal').onclick = () => void revealCards()

async function revealCards() {
  const r = room?.round
  if (!r || r.revealed) return
  const v = votes()
  const s = summarize(v)
  const mics = s?.consensus ? [] : micsFor(v)
  const hist: HistoryRound = { at: backend.now(), votes: {}, times: {}, near: s?.near ?? null, consensus: Boolean(s?.consensus) }
  for (const [id, value] of Object.entries(v)) {
    hist.votes[id] = { name: room?.players?.[id]?.name ?? 'Iemand', value }
    const at = room?.votes?.[id]?.at
    if (at) hist.times![id] = Math.max(0, at - r.startedAt)
  }
  await backend.update(`rooms/${code}`, {
    'round/revealed': true,
    'round/revealedAt': backend.now(),
    'round/mics': mics,
    [`history/${r.id}`]: hist,
  })
  if (current === 'sTable') $('reset').focus()
}

// ---------- automatisch omdraaien ----------
// Staat standaard aan (ook bij teams van vóór deze instelling). Eén toestel draait om:
// de starter als die aan tafel zit, anders wie het langst aan tafel zit. Zo gebeurt het maar één keer.
const autoRevealOn = () => room?.meta?.autoReveal !== false
let autoTimer = 0
let autoFor: string | null = null
function maybeAutoReveal() {
  const r = room?.round
  const people = seated()
  const v = votes()
  const ready = Boolean(r && !r.revealed && autoRevealOn() && !room?.meta?.finished && people.length >= 2 && people.every(([id]) => v[id] !== undefined))
  if (!ready) {
    clearTimeout(autoTimer)
    autoFor = null
    return
  }
  if (autoFor === r!.id) return // staat al gepland voor deze ronde
  autoFor = r!.id
  const order = [...people].sort((a, b) => (a[1].joinedAt ?? 0) - (b[1].joinedAt ?? 0)).map(([id]) => id)
  const host = room?.meta?.createdBy
  const leader = host && order.includes(host) ? host : order[0]
  if (leader !== backend.uid) {
    autoFor = null
    return
  }
  // Even wachten, zodat de laatste stemmer zijn kaart nog ziet oplichten
  autoTimer = window.setTimeout(() => {
    autoFor = null
    const now = votes()
    if (!room?.round?.revealed && seated().every(([id]) => now[id] !== undefined)) void revealCards()
  }, 900)
}

function newRound(n: number) {
  return backend.set(`rooms/${code}/round`, { id: shortId(), n, revealed: false, startedAt: backend.now() } satisfies Round)
}
$('reset').onclick = () => void newRound((room?.round?.n ?? 0) + 1)

// Consensusfeestje: op elk toestel zodra de kaarten omgaan
// ---------- easter eggs ----------
/** Hoeveel rondes op rij eindigden in consensus (de laatste ronde telt mee). */
function consensusStreak() {
  const hist = Object.values(room?.history ?? {}).filter(Boolean).sort((a, b) => a.at - b.at)
  let n = 0
  for (let i = hist.length - 1; i >= 0 && hist[i].consensus; i--) n++
  return n
}
/** Iedereen aan tafel (minstens twee) koos het vraagteken. */
function everyoneUnsure(v: Record<string, string>) {
  const vals = Object.values(v)
  return vals.length >= 2 && vals.length === seated().length && vals.every((x) => x === '?')
}

function handleReveal() {
  const r = room?.round
  const id = r?.revealed ? r.id : null
  if (lastRevealed === undefined) {
    lastRevealed = id // eerste keer laden: geen feestje voor een oude ronde
    return
  }
  if (id && id !== lastRevealed) {
    lastRevealed = id
    const v = votes()
    if (summarize(v)?.consensus) {
      if (consensusStreak() === 3) {
        party(app, GOLD_PARTY) // hattrick
        navigator.vibrate?.([60, 40, 60, 40, 120])
      } else {
        party(app, activeTheme())
        navigator.vibrate?.([40, 30, 40])
      }
    } else if (everyoneUnsure(v)) party(app, COFFEE_PARTY)
  } else if (!id) lastRevealed = null
}

// ---------- duwtje: alleen de duwer en de geduwde merken het ----------
function nudge(to: string, name: string) {
  const now = Date.now()
  if (nudgeCooldown[to] && now - nudgeCooldown[to] < 8000) {
    toast(`${name} heeft net al een duwtje gehad`)
    return
  }
  nudgeCooldown[to] = now
  wiggle(document.querySelector(`[data-seat="${to}"] .slot`))
  toast(`${name} krijgt een duwtje`)
  void backend.push(`nudges/${code}/${to}`, { from: backend.uid, fromName: me()?.name ?? 'Iemand', at: backend.now() } satisfies Nudge)
}

function onNudges(list: Record<string, Nudge> | null) {
  if (!list) return
  for (const [key, n] of Object.entries(list)) {
    void backend.remove(`nudges/${code}/${backend.uid}/${key}`)
    if (!n || backend.now() - n.at > 60000 || room?.round?.revealed) continue
    if (votes()[backend.uid]) continue
    navigator.vibrate?.([80, 60, 80])
    wiggle($('hand'))
    toast(`${n.fromName} geeft je een duwtje: kies een kaart`)
  }
}

// ---------- afronden en prijsuitreiking ----------
$('finish').onclick = () => {
  if (isHost()) void backend.update(`rooms/${code}/meta`, { finished: backend.now() })
}

function handleFinish() {
  const f = room?.meta?.finished ?? 0
  if (!f) {
    closeSheet('finish')
    finishShownFor = 0
    return
  }
  if (f === finishShownFor) return
  finishShownFor = f
  const hist = Object.values(room?.history ?? {}).filter(Boolean).sort((a, b) => a.at - b.at)
  const n = hist.length
  const withAwards = n >= 3
  const list = withAwards ? awards(hist, backend.uid, fmt) : []
  const overview = hist
    .map((r, i) => `<li><span class="icon" aria-hidden="true">${i + 1}</span><b>${r.near ? esc(r.near) + (r.consensus ? ', consensus' : '') : 'geen schatting'}</b><span>Ronde ${i + 1}</span></li>`)
    .join('')
  const host = isHost()
  openSheet(
    'finish',
    `<h2>${withAwards ? 'Prijsuitreiking' : 'Sessie afgerond'}</h2>
    <p>${n === 0 ? 'Er is nog geen ronde gespeeld.' : `${n} ronde${n > 1 ? 's' : ''} gespeeld.`}${withAwards ? ' Dit zijn de titels van vandaag:' : n > 0 ? ' Vanaf 3 rondes volgt er ook een prijsuitreiking.' : ''}</p>
    ${withAwards ? `<ul class="awards">${list.map((a) => `<li><span class="icon" aria-hidden="true">${a.icon}</span><b>${esc(a.title)}: ${esc(a.who)}</b><span>${esc(a.why)}</span></li>`).join('')}</ul>` : n > 0 ? `<ul class="awards">${overview}</ul>` : ''}
    ${
      host
        ? '<div class="row"><button class="btn secondary grow" id="back">Terug naar tafel</button><button class="btn primary" id="newSession">Nieuwe sessie</button></div>'
        : '<div class="row"><button class="btn primary grow" id="closeFinish">Sluiten</button></div>'
    }`,
    (o) => {
      o.querySelector<HTMLElement>('#back')?.addEventListener('click', () => void backend.update(`rooms/${code}/meta`, { finished: null }))
      o.querySelector<HTMLElement>('#newSession')?.addEventListener('click', async () => {
        await backend.update(`rooms/${code}`, {
          'meta/finished': null,
          history: null,
          round: { id: shortId(), n: 1, revealed: false, startedAt: backend.now() },
        })
      })
      o.querySelector<HTMLElement>('#closeFinish')?.addEventListener('click', () => closeSheet())
    },
  )
  if (withAwards) party(app, activeTheme())
}

// Zeven keer op het logo tikken: de kaarten D, A en T husselen even tot TAD
let logoTaps: number[] = []
let shuffling = false
$('title').addEventListener('click', () => {
  const now = Date.now()
  logoTaps = [...logoTaps.filter((t) => now - t < 3000), now]
  if (logoTaps.length >= 7 && !shuffling) {
    logoTaps = []
    void shuffleCards()
  }
})
async function shuffleCards() {
  shuffling = true
  const stage = document.createElement('div')
  stage.className = 'shuffle'
  stage.setAttribute('aria-hidden', 'true')
  const cards = ['D', 'A', 'T'].map((l, i) => {
    const c = document.createElement('span')
    c.className = `shuffle-card c${i}`
    c.textContent = l
    stage.append(c)
    return c
  })
  app.append(stage)
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const pos = (slot: number, lift = 0, rot = 0) => `translate(${(slot - 1) * 78}px, ${-lift}px) rotate(${rot}deg)`
  const move = (el: HTMLElement, frames: Keyframe[], duration: number) => el.animate(frames, { duration: still ? 1 : duration, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' }).finished
  // verschijnen
  await Promise.all(cards.map((c, i) => move(c, [{ transform: pos(1, 0, 0), opacity: 0 }, { transform: pos(i, 0, (i - 1) * 8), opacity: 1 }], 350)))
  // husselen: D en T wisselen met een boogje, A huppelt mee
  await Promise.all([
    move(cards[0], [{ transform: pos(0, 0, -8) }, { transform: pos(1, 70, 200) }, { transform: pos(2, 0, 368) }], 700),
    move(cards[1], [{ transform: pos(1, 0, 0) }, { transform: pos(1, 30, -12) }, { transform: pos(1, 0, 0) }], 700),
    move(cards[2], [{ transform: pos(2, 0, 8) }, { transform: pos(1, -50, -200) }, { transform: pos(0, 0, -368) }], 700),
  ])
  await new Promise((r) => setTimeout(r, 900)) // even TAD laten zien
  // en weer terug
  await Promise.all([
    move(cards[0], [{ transform: pos(2, 0, 368) }, { transform: pos(0, 0, -8) }], 500),
    move(cards[2], [{ transform: pos(0, 0, -368) }, { transform: pos(2, 0, 8) }], 500),
  ])
  await new Promise((r) => setTimeout(r, 300))
  await stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished
  stage.remove()
  shuffling = false
}

// ---------- start ----------
// Op de live site (niet lokaal) toont Netlify rechtsonder een badge: daar houden we ruimte vrij
if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) document.documentElement.classList.add('badge-space')
// Voorbeeldnamen in de invulvelden: elke keer een andere
const EXAMPLE_NAMES = ['Sanne', 'Daan', 'Fatima', 'Jeroen', 'Noor', 'Mohammed', 'Lotte', 'Bram', 'Annemarie', 'Kees', 'Priya', 'Sem', 'Esther', 'Youssef', 'Willemijn', 'Ruben', 'Ilse', 'Thijs', 'Aylin', 'Gerard']
const shuffled = [...EXAMPLE_NAMES].sort(() => Math.random() - 0.5)
$<HTMLInputElement>('hostName').placeholder = `Bijvoorbeeld ${shuffled[0]}`
$<HTMLInputElement>('joinName').placeholder = `Bijvoorbeeld ${shuffled[1]}`
const hr = new Date().getHours()
$('greeting').textContent = (hr < 6 ? 'Goedenacht' : hr < 12 ? 'Goedemorgen' : hr < 18 ? 'Goedemiddag' : 'Goedenavond') + ', welkom!'
applyDark()
applyTheme()

getBackend()
  .then((b) => {
    backend = b
    $('demoNote').hidden = b.kind !== 'demo'
    route()
  })
  .catch((e) => {
    console.error(e)
    $('missingTitle').textContent = 'Geen verbinding'
    $('missingText').textContent = 'De app kan de server niet bereiken. Controleer je internet en de Firebase-instellingen.'
    $('toStart').hidden = true
    show('sMissing')
  })

// Scherm aan laten tijdens het pokeren (vooral handig op telefoons)
type WakeLock = { release: () => Promise<void> }
let lock: WakeLock | null = null
async function keepAwake() {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } }
  if (document.visibilityState !== 'visible' || !nav.wakeLock || current !== 'sTable') return
  try {
    lock = await nav.wakeLock.request('screen')
  } catch {
    lock = null
  }
}
document.addEventListener('visibilitychange', () => void keepAwake())
document.addEventListener('click', () => {
  if (!lock) void keepAwake()
})
