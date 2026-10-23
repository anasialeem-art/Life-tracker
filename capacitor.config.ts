import type { CapacitorConfig } from '@capacitor/cli'

// The Android app wraps the same web build (dist/). Bank requests use CapacitorHttp
// explicitly (src/lib/native.ts); fetch and XHR are left alone for everything else.
const config: CapacitorConfig = {
  appId: 'io.github.anasialeemart.lifetracker',
  appName: 'Life Tracker',
  webDir: 'dist',
  android: {
    // Never load http:// content.
    allowMixedContent: false,
  },
  plugins: {
    CapacitorHttp: { enabled: false },
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover' },
  },
}

export default config
