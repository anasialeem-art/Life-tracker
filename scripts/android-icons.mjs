// Renders the Android launcher icons and splash logo from public/favicon.svg.
// Run once after changing the icon: node scripts/android-icons.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import sharp from 'sharp'

const RES = 'android/app/src/main/res'
const svg = readFileSync('public/favicon.svg')
const round = Buffer.from(readFileSync('public/favicon.svg', 'utf8').replace('rx="112"', 'rx="256"'))
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

for (const [d, f] of Object.entries(DENSITIES)) {
  const dir = `${RES}/mipmap-${d}`
  mkdirSync(dir, { recursive: true })
  await sharp(svg).resize(48 * f, 48 * f).png().toFile(`${dir}/ic_launcher.png`)
  await sharp(round).resize(48 * f, 48 * f).png().toFile(`${dir}/ic_launcher_round.png`)
  rmSync(`${dir}/ic_launcher_foreground.png`, { force: true })
}

// Splash: the old per-orientation Capacitor images give way to one centred logo on the app background.
for (const d of readdirSync(RES)) if (/^drawable-(land|port)-/.test(d)) rmSync(`${RES}/${d}`, { recursive: true })
rmSync(`${RES}/drawable/splash.png`, { force: true })
await sharp(svg).resize(288, 288).png().toFile(`${RES}/drawable/splash_logo.png`)
writeFileSync(`${RES}/drawable/splash.xml`, `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background" />
    <item android:width="96dp" android:height="96dp" android:gravity="center" android:drawable="@drawable/splash_logo" />
</layer-list>
`)
console.log('Android icons written')
