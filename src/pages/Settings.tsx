import { setSetting, useSetting, type Settings as SettingsShape } from '../lib/settings'
import { isStandalone, useOnline, usePersisted } from '../lib/storage'
import { TopBar } from '../components/TopBar'
import { Card, Page, SectionLabel, Segmented } from '../components/ui'

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[15px]">{label}</span>
      <span className={`text-sm font-medium ${ok ? 'text-success' : 'text-muted'}`}>{value}</span>
    </div>
  )
}

export function Settings() {
  const theme = useSetting('theme')
  const persisted = usePersisted()
  const online = useOnline()
  const offlineReady = !!navigator.serviceWorker?.controller

  return (
    <>
      <TopBar title="Settings" backTo="/more" />
      <Page>
        <SectionLabel>Appearance</SectionLabel>
        <Card>
          <Segmented<SettingsShape['theme']>
            value={theme}
            onChange={(v) => setSetting('theme', v)}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Card>

        <SectionLabel>App status</SectionLabel>
        <Card className="divide-y divide-line py-1">
          <StatusRow label="Works offline" value={offlineReady ? 'Ready' : 'Not yet cached'} ok={offlineReady} />
          <StatusRow label="Persistent storage" value={persisted == null ? '…' : persisted ? 'Granted' : 'Not granted'} ok={!!persisted} />
          <StatusRow label="Installed app" value={isStandalone() ? 'Yes' : 'Browser tab'} ok={isStandalone()} />
          <StatusRow label="Network" value={online ? 'Online' : 'Offline'} ok={true} />
        </Card>
        <p className="px-1 text-xs text-muted">
          Prayer, fitness targets and list management land here as their tabs are built.
        </p>
      </Page>
    </>
  )
}
