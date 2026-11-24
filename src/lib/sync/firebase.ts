import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import {
  getDatabase,
  ref,
  onValue,
  get,
  set,
  update,
  remove,
  push,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database'
import type { Backend, Unsub } from './types'

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  databaseURL: string
  projectId: string
  appId: string
}

export async function createFirebaseBackend(config: FirebaseConfig): Promise<Backend> {
  const app = initializeApp(config)
  const auth = getAuth(app)
  await auth.authStateReady()
  if (!auth.currentUser) await signInAnonymously(auth)
  const uid = auth.currentUser!.uid
  const db = getDatabase(app)

  let offset = 0
  onValue(ref(db, '.info/serverTimeOffset'), (s) => {
    offset = Number(s.val()) || 0
  })

  return {
    kind: 'firebase',
    uid,
    staleMs: 0,
    now: () => Date.now() + offset,
    subscribe(path, cb, onError) {
      return onValue(
        ref(db, path),
        (snap) => cb(snap.val()),
        (err) => onError?.(err),
      )
    },
    get: async (path) => (await get(ref(db, path))).val(),
    set: (path, val) => set(ref(db, path), val ?? null),
    update: (path, patch) => update(ref(db, path), patch),
    remove: (path) => remove(ref(db, path)),
    async push(path, val) {
      const r = push(ref(db, path))
      await set(r, val)
      return r.key!
    },
    presence(path): Unsub {
      const target = ref(db, path)
      let active = true
      const off = onValue(ref(db, '.info/connected'), async (snap) => {
        if (snap.val() !== true || !active) return
        await onDisconnect(target).update({ online: false, lastSeen: serverTimestamp() })
        // Alleen bijwerken als de speler nog aan tafel zit
        const exists = (await get(ref(db, `${path}/name`))).exists()
        if (exists && active) await update(target, { online: true, lastSeen: serverTimestamp() })
      })
      return () => {
        active = false
        off()
        void onDisconnect(target).cancel()
        void get(ref(db, `${path}/name`)).then((s) => {
          if (s.exists()) void update(target, { online: false, lastSeen: serverTimestamp() })
        })
      }
    },
  }
}
