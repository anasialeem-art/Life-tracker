// The Android app updates by installing a newer APK from the repository's Releases page.
// CI tags each release "apk-<build number>" and attaches life-tracker.apk.

export const RELEASES_URL = 'https://github.com/anasialeem-art/Life-tracker/releases/latest'
const LATEST_API = 'https://api.github.com/repos/anasialeem-art/Life-tracker/releases/latest'

export interface UpdateInfo { build: number; apkUrl: string }

export const currentBuild = (): number | null => (/^\d+$/.test(__APP_BUILD__) ? Number(__APP_BUILD__) : null)

/** The newest published APK, or null when this one is current (or the check fails offline). */
export async function checkForUpdate(): Promise<UpdateInfo | 'current' | null> {
  try {
    const r = await fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } })
    if (!r.ok) return null
    const rel = (await r.json()) as { tag_name?: string; assets?: { name: string; browser_download_url: string }[] }
    const build = Number(rel.tag_name?.replace(/^apk-/, ''))
    const apk = rel.assets?.find((a) => a.name.endsWith('.apk'))
    if (!build || !apk) return null
    const mine = currentBuild()
    return mine !== null && build <= mine ? 'current' : { build, apkUrl: apk.browser_download_url }
  } catch {
    return null
  }
}
