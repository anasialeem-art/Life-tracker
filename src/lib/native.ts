import { Capacitor, CapacitorHttp } from '@capacitor/core'

/** True inside the Android app (Capacitor); false in a browser or the installed web app. */
export const isNativeApp = () => Capacitor.isNativePlatform()

// Bank login and PIN live only in Android's secure storage (Keystore-backed),
// never in IndexedDB or a backup. The web build has no secure storage, so it never stores them.

const KEY_LOGIN = 'fin.login'
const KEY_PIN = 'fin.pin'

async function store() {
  if (!isNativeApp()) throw new Error('Secure storage is only available in the Android app.')
  // Wrapped: a Capacitor plugin proxy returned straight from an async function gets probed for .then() and throws.
  const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
  return { s: SecureStorage }
}

export interface StoredCredentials { login: string | null; pin: string | null }

export async function loadCredentials(): Promise<StoredCredentials> {
  if (!isNativeApp()) return { login: null, pin: null }
  const { s } = await store()
  const [login, pin] = await Promise.all([s.getItem(KEY_LOGIN), s.getItem(KEY_PIN)])
  return { login: login || null, pin: pin || null }
}

/** Saves the login; the PIN only when `pin` is given, otherwise any stored PIN is removed. */
export async function saveCredentials(login: string, pin: string | null): Promise<void> {
  const { s } = await store()
  await s.setItem(KEY_LOGIN, login)
  if (pin) await s.setItem(KEY_PIN, pin)
  else await s.removeItem(KEY_PIN)
}

export async function forgetCredentials(): Promise<void> {
  if (!isNativeApp()) return
  const { s } = await store()
  await Promise.all([s.removeItem(KEY_LOGIN), s.removeItem(KEY_PIN)])
}

/** POST through Android's own HTTP stack: the browser engine would block the bank server (CORS). */
export async function nativePost(url: string, body: string): Promise<string> {
  const r = await CapacitorHttp.post({
    url,
    // The body is base64 (plain ASCII), as FinTS over HTTPS expects.
    headers: { 'Content-Type': 'text/plain' },
    data: body,
    responseType: 'text',
    connectTimeout: 20_000,
    readTimeout: 90_000,
  })
  if (r.status < 200 || r.status >= 300) throw new HttpStatusError(r.status)
  return typeof r.data === 'string' ? r.data : String(r.data ?? '')
}

export class HttpStatusError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`)
  }
}

/** Android back gesture: walk the app's history (closing sheets, leaving pages); at the start, leave the app. */
export async function setupNativeBack(): Promise<void> {
  if (!isNativeApp()) return
  const { App } = await import('@capacitor/app')
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) history.back()
    else App.minimizeApp()
  })
}
