import { useEffect, useState } from 'react'
import { searchCities } from '../../lib/cities'
import { prayerDayAt } from '../../lib/prayer'
import { getAllSettings, setSetting, type PrayerLocation } from '../../lib/settings'
import { LocationIcon, SearchIcon } from '../../components/Icons'
import { Sheet } from '../../components/Sheet'
import { Button, Field, TextInput } from '../../components/ui'

/** Sets the prayer location and, the first time, starts automatic qada tracking. */
export async function savePrayerLocation(loc: PrayerLocation) {
  await setSetting('prayerLocation', loc)
  const s = await getAllSettings()
  if (!s.prayerTrackingStart) await setSetting('prayerTrackingStart', prayerDayAt({ ...s, prayerLocation: loc }))
}

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'search' | 'manual'>('search')
  const [gps, setGps] = useState<'idle' | 'busy' | 'error'>('idle')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) { setQuery(''); setMode('search'); setGps('idle') }
  }, [open])

  const pick = async (loc: PrayerLocation) => {
    await savePrayerLocation(loc)
    onClose()
  }

  const useGps = () => {
    if (!navigator.geolocation) return setGps('error')
    setGps('busy')
    navigator.geolocation.getCurrentPosition(
      (p) => pick({ name: 'Current location', lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4) }),
      () => setGps('error'),
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 },
    )
  }

  const manualValid = Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lng)) && Math.abs(parseFloat(lat)) <= 90 && Math.abs(parseFloat(lng)) <= 180
  const results = searchCities(query)

  return (
    <Sheet open={open} onClose={onClose} title="Prayer location">
      <div className="flex flex-col gap-3">
        <Button variant="tinted" onClick={useGps} disabled={gps === 'busy'}>
          <LocationIcon size={20} /> {gps === 'busy' ? 'Finding you…' : 'Use my current location'}
        </Button>
        {gps === 'error' && <p className="px-1 text-[13px] text-danger">Couldn’t get your location. Check that location is on and allowed for this app, or pick a city.</p>}

        {mode === 'search' ? (
          <>
            <div className="relative">
              <SearchIcon size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search city" className="pl-11" enterKeyHint="search" />
            </div>
            <div className="-mx-2 flex max-h-[42dvh] flex-col overflow-y-auto">
              {results.map(([city, country, la, ln]) => (
                <button key={`${city}-${country}`} type="button" onClick={() => pick({ name: city, lat: la, lng: ln })}
                  className="flex min-h-[52px] items-center justify-between rounded-xl px-3 text-left active:bg-surface-2">
                  <span className="text-[16px] font-medium">{city}</span>
                  <span className="text-[14px] text-muted">{country}</span>
                </button>
              ))}
              {results.length === 0 && <p className="px-3 py-4 text-center text-[14px] text-muted">No match. Use your location or enter coordinates.</p>}
            </div>
            <button type="button" onClick={() => setMode('manual')} className="py-2 text-[15px] font-semibold text-accent">Enter coordinates instead</button>
          </>
        ) : (
          <>
            <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude"><TextInput inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="52.52" /></Field>
              <Field label="Longitude"><TextInput inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="13.40" /></Field>
            </div>
            <Button disabled={!manualValid} onClick={() => pick({ name: name.trim() || 'Custom location', lat: parseFloat(lat), lng: parseFloat(lng) })}>Save location</Button>
            <button type="button" onClick={() => setMode('search')} className="py-2 text-[15px] font-semibold text-accent">Search cities instead</button>
          </>
        )}
      </div>
    </Sheet>
  )
}
