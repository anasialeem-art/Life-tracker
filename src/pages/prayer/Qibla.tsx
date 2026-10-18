import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Button } from '../../components/ui'

type OrientationEventCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }
type OrientationEvt = DeviceOrientationEvent & { webkitCompassHeading?: number }

const ALIGNED_DEG = 4

/** Live compass heading in degrees from north, or null until the sensor reports. */
function useHeading(active: boolean): { heading: number | null; needsPermission: boolean; request: () => void; unsupported: boolean } {
  const [heading, setHeading] = useState<number | null>(null)
  const [unsupported, setUnsupported] = useState(false)
  const Ctor = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : undefined) as OrientationEventCtor | undefined
  const [needsPermission, setNeedsPermission] = useState(!!Ctor?.requestPermission)
  const smooth = useRef<number | null>(null)

  useEffect(() => {
    if (!active || needsPermission) return
    setUnsupported(false)
    const onEvent = (e: Event) => {
      const ev = e as OrientationEvt
      let h: number | null = null
      if (typeof ev.webkitCompassHeading === 'number') h = ev.webkitCompassHeading
      else if (ev.absolute && typeof ev.alpha === 'number') h = (360 - ev.alpha + (screen.orientation?.angle ?? 0)) % 360
      if (h === null) return
      // Low-pass filter over the shortest angular distance to avoid jitter.
      const prev = smooth.current
      if (prev === null) smooth.current = h
      else {
        // Kept unwrapped (can exceed 360) so the dial never spins the long way round at north.
        smooth.current = prev + (((h - (prev % 360) + 540) % 360) - 180) * 0.25
      }
      setHeading(smooth.current)
    }
    const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(evt, onEvent)
    const t = setTimeout(() => { if (smooth.current === null) setUnsupported(true) }, 2500)
    return () => {
      window.removeEventListener(evt, onEvent)
      clearTimeout(t)
    }
  }, [active, needsPermission])

  const request = () => {
    Ctor?.requestPermission?.().then((r) => setNeedsPermission(r !== 'granted'), () => setUnsupported(true))
  }
  return { heading, needsPermission, request, unsupported }
}

export function QiblaSheet({ open, onClose, bearing, place }: { open: boolean; onClose: () => void; bearing: number; place: string }) {
  const { heading, needsPermission, request, unsupported } = useHeading(open)
  const relative = heading === null ? bearing : ((bearing - heading) % 360 + 360) % 360
  const off = Math.min(relative, 360 - relative)
  const aligned = heading !== null && off <= ALIGNED_DEG
  const wasAligned = useRef(false)

  useEffect(() => {
    if (aligned && !wasAligned.current) navigator.vibrate?.(30)
    wasAligned.current = aligned
  }, [aligned])

  const dial = heading === null ? 0 : -heading

  return (
    <Sheet open={open} onClose={onClose} title="Qibla">
      <div className="flex flex-col items-center gap-5 pb-2">
        <div className="relative h-[290px] w-[290px]">
          {/* Fixed pointer at the top: where the phone faces. */}
          <div className={`absolute top-[-6px] left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[14px] border-x-transparent transition-colors ${aligned ? 'border-t-success' : 'border-t-text'}`} />
          <svg viewBox="-150 -150 300 300" className="absolute inset-0 h-full w-full" style={{ transform: `rotate(${dial}deg)`, transition: 'transform 120ms linear' }}>
            <circle r="146" className={`transition-colors duration-300 ${aligned ? 'fill-success-soft stroke-success' : 'fill-surface-2 stroke-line'}`} strokeWidth="1.5" />
            {Array.from({ length: 72 }, (_, i) => (
              <line key={i} x1="0" x2="0" y1={-140} y2={i % 18 === 0 ? -122 : i % 2 === 0 ? -130 : -134}
                transform={`rotate(${i * 5})`} stroke={i % 18 === 0 ? 'var(--text)' : 'var(--faint)'} strokeWidth={i % 18 === 0 ? 2.5 : 1.5} strokeLinecap="round" />
            ))}
            {(['N', 'E', 'S', 'W'] as const).map((c, i) => (
              <text key={c} transform={`rotate(${i * 90}) translate(0 -100) rotate(${-i * 90 - dial})`} textAnchor="middle" dominantBaseline="central"
                fontSize="17" fontWeight="700" fill={c === 'N' ? 'var(--danger)' : 'var(--muted)'}>{c}</text>
            ))}
            <g transform={`rotate(${bearing})`}>
              <line x1="0" y1="0" x2="0" y2="-92" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
              <g transform={`translate(0 -116) rotate(${-bearing - dial})`}>
                <circle r="17" fill="var(--accent)" />
                <rect x="-8" y="-8" width="16" height="16" rx="2" fill="#111" />
                <rect x="-8" y="-4.5" width="16" height="2.5" fill="#d4a017" />
              </g>
            </g>
          </svg>
          <div className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-accent" />
        </div>

        <div className="text-center">
          <p className={`text-[22px] font-bold tabular ${aligned ? 'text-success' : ''}`}>
            {heading === null ? `${Math.round(bearing)}° from North` : aligned ? 'Facing the Qibla' : `Turn ${relative < 180 ? 'right' : 'left'} ${Math.round(off)}°`}
          </p>
          <p className="text-[14px] text-muted">Qibla is {Math.round(bearing)}° from North in {place}</p>
        </div>

        {needsPermission && <Button onClick={request}>Enable compass</Button>}
        {unsupported && !needsPermission && (
          <p className="max-w-72 text-center text-[13px] text-muted">No compass reading yet. Move your phone in a figure-eight to calibrate, and keep it flat, away from magnets.</p>
        )}
      </div>
    </Sheet>
  )
}
