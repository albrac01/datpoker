export type Unsub = () => void

/**
 * Kleine laag boven de realtime database. Paden zijn slash-gescheiden
 * ("rooms/abc/players/u1"). Een waarde van null of undefined verwijdert.
 */
export interface Backend {
  kind: 'firebase' | 'demo'
  /** Unieke id van deze speler/dit apparaat. */
  uid: string
  /** > 0: een speler telt als offline als lastSeen ouder is dan dit. */
  staleMs: number
  /** Tijd gecorrigeerd naar de server (ms sinds epoch). */
  now(): number
  subscribe(path: string, cb: (val: unknown) => void, onError?: (e: Error) => void): Unsub
  get(path: string): Promise<unknown>
  set(path: string, val: unknown): Promise<void>
  /** Sleutels mogen dieper wijzen: { 'round/revealed': true }. */
  update(path: string, patch: Record<string, unknown>): Promise<void>
  remove(path: string): Promise<void>
  push(path: string, val: unknown): Promise<string>
  /** Markeert path als online en zet het op offline zodra de verbinding wegvalt. */
  presence(path: string): Unsub
}
