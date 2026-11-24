import type { Backend, Unsub } from './types'

/**
 * Demomodus: een "database" in localStorage die via BroadcastChannel
 * tussen tabbladen van dezelfde browser wordt gedeeld. Elk tabblad is
 * een aparte speler, zodat je alles op één apparaat kunt uitproberen.
 */

type Tree = Record<string, unknown>
const KEY = 'scrumpoker-demo-db'
const UID_KEY = 'scrumpoker-demo-uid'

function readStore(): Tree {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Tree) : {}
  } catch {
    return {}
  }
}

function split(path: string) {
  return path.split('/').filter(Boolean)
}

function getAt(tree: Tree, path: string): unknown {
  let cur: unknown = tree
  for (const seg of split(path)) {
    if (cur === null || typeof cur !== 'object') return null
    cur = (cur as Tree)[seg]
  }
  return cur ?? null
}

function setAt(tree: Tree, path: string, val: unknown) {
  const segs = split(path)
  if (!segs.length) return
  const trail: Tree[] = [tree]
  let cur = tree
  for (const seg of segs.slice(0, -1)) {
    const next = cur[seg]
    if (next === null || typeof next !== 'object') cur[seg] = {}
    cur = cur[seg] as Tree
    trail.push(cur)
  }
  const last = segs[segs.length - 1]
  if (val === null || val === undefined) delete cur[last]
  else cur[last] = JSON.parse(JSON.stringify(val))
  // Lege objecten opruimen, net als Firebase dat doet
  for (let i = trail.length - 1; i > 0; i--) {
    if (Object.keys(trail[i]).length === 0) delete trail[i - 1][segs[i - 1]]
  }
}

function pushId() {
  return Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 8)
}

export function createDemoBackend(): Backend {
  let uid = ''
  try {
    uid = sessionStorage.getItem(UID_KEY) || ''
    if (!uid) {
      uid = 'demo-' + Math.random().toString(36).slice(2, 10)
      sessionStorage.setItem(UID_KEY, uid)
    }
  } catch {
    uid = 'demo-' + Math.random().toString(36).slice(2, 10)
  }

  let tree = readStore()
  const listeners = new Set<{ path: string; cb: (v: unknown) => void; last: string | undefined }>()
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('scrumpoker-demo') : null

  const notify = () => {
    for (const l of listeners) {
      const v = getAt(tree, l.path)
      const s = JSON.stringify(v)
      if (s !== l.last) {
        l.last = s
        l.cb(JSON.parse(s))
      }
    }
  }

  channel?.addEventListener('message', (e: MessageEvent) => {
    if (e.data && typeof e.data === 'object') tree = e.data as Tree
    notify()
  })
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      tree = readStore()
      notify()
    }
  })

  const write = (fn: (t: Tree) => void) => {
    tree = readStore() // laatste stand van andere tabbladen meenemen
    fn(tree)
    try {
      localStorage.setItem(KEY, JSON.stringify(tree))
    } catch {
      /* opslag vol of geblokkeerd: dan alleen via het kanaal */
    }
    channel?.postMessage(tree)
    notify()
    return Promise.resolve()
  }

  const backend: Backend = {
    kind: 'demo',
    uid,
    staleMs: 15000,
    now: () => Date.now(),
    subscribe(path, cb) {
      const l = { path, cb, last: undefined as string | undefined }
      listeners.add(l)
      queueMicrotask(notify)
      return () => listeners.delete(l)
    },
    get: (path) => Promise.resolve(getAt(readStore(), path)),
    set: (path, val) => write((t) => setAt(t, path, val)),
    update: (path, patch) =>
      write((t) => {
        for (const [k, v] of Object.entries(patch)) setAt(t, `${path}/${k}`, v)
      }),
    remove: (path) => write((t) => setAt(t, path, null)),
    async push(path, val) {
      const id = pushId()
      await write((t) => setAt(t, `${path}/${id}`, val))
      return id
    },
    presence(path): Unsub {
      const beat = () => {
        if (getAt(readStore(), path) === null) return // speler is verwijderd
        void backend.update(path, { online: true, lastSeen: Date.now() })
      }
      beat()
      const timer = window.setInterval(beat, 5000)
      const off = () => {
        if (getAt(readStore(), path) !== null) void backend.update(path, { online: false, lastSeen: Date.now() })
      }
      window.addEventListener('pagehide', off)
      return () => {
        window.clearInterval(timer)
        window.removeEventListener('pagehide', off)
        off()
      }
    },
  }
  return backend
}
