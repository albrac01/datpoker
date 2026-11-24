import type { Backend } from './types'

export type { Backend, Unsub } from './types'

const env = import.meta.env

export const firebaseConfigured = Boolean(env.VITE_FIREBASE_DATABASE_URL && env.VITE_FIREBASE_API_KEY)

let pending: Promise<Backend> | null = null

/** Eén backend per pagina. Zonder Firebase-config draait de app in demomodus. */
export function getBackend(): Promise<Backend> {
  if (pending) return pending
  if (firebaseConfigured) {
    pending = import('./firebase').then((m) =>
      m.createFirebaseBackend({
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        databaseURL: env.VITE_FIREBASE_DATABASE_URL,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      }),
    )
  } else {
    pending = import('./demo').then((m) => m.createDemoBackend())
  }
  return pending
}
