// Android intent links for opening other installed apps, with a Play Store
// fallback when the app isn't installed.

export const APPS = {
  lyfta: 'com.lyfta',
} as const

export function intentUrl(packageName: string): string {
  const fallback = encodeURIComponent(`https://play.google.com/store/apps/details?id=${packageName}`)
  return `intent://#Intent;package=${packageName};S.browser_fallback_url=${fallback};end`
}

export function openApp(packageName: string) {
  location.href = intentUrl(packageName)
}
