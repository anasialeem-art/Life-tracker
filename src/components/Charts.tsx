import { useId } from 'react'

export interface Point { x: number; y: number; label?: string }

/** Smooth area line chart (monotone cubic) with min/max guides. Lightweight SVG, no deps. */
export function LineChart({ points, height = 150, color = 'var(--accent)', format = (v: number) => v.toFixed(1) }: {
  points: Point[]
  height?: number
  color?: string
  format?: (v: number) => string
}) {
  const id = useId()
  const W = 340
  const H = height
  const padX = 8
  const padTop = 18
  const padBottom = 22
  if (points.length === 0) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  let minY = Math.min(...ys)
  let maxY = Math.max(...ys)
  if (maxY - minY < 1) { minY -= 0.5; maxY += 0.5 }
  const pad = (maxY - minY) * 0.15
  minY -= pad
  maxY += pad
  const sx = (x: number) => (maxX === minX ? W / 2 : padX + ((x - minX) / (maxX - minX)) * (W - padX * 2))
  const sy = (y: number) => padTop + (1 - (y - minY) / (maxY - minY)) * (H - padTop - padBottom)
  const pts = points.map((p) => [sx(p.x), sy(p.y)] as const)

  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const cx = (x0 + x1) / 2
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
  }
  const area = `${d} L${pts.at(-1)![0]},${H - padBottom} L${pts[0][0]},${H - padBottom} Z`
  const last = pts.at(-1)!
  const realMin = Math.min(...ys)
  const realMax = Math.max(...ys)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[realMax, realMin].map((v, i) => (
        <g key={i}>
          <line x1={0} x2={W} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeDasharray="3 4" />
          <text x={W} y={sy(v) - 4} textAnchor="end" fontSize="11" fill="var(--muted)">{format(v)}</text>
        </g>
      ))}
      {pts.length > 1 && <path d={area} fill={`url(#${id})`} />}
      {pts.length > 1 && <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
      <circle cx={last[0]} cy={last[1]} r="5" fill={color} stroke="var(--surface)" strokeWidth="2.5" />
      {points[0].label && <text x={padX} y={H - 4} fontSize="11" fill="var(--muted)">{points[0].label}</text>}
      {points.length > 1 && points.at(-1)!.label && <text x={W - padX} y={H - 4} textAnchor="end" fontSize="11" fill="var(--muted)">{points.at(-1)!.label}</text>}
    </svg>
  )
}

/** Rounded vertical bars with labels underneath; the last bar is highlighted. */
export function BarChart({ bars, height = 140, color = 'var(--accent)', format = String }: {
  bars: { label: string; value: number }[]
  height?: number
  color?: string
  format?: (v: number) => string
}) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {bars.map((b, i) => {
        const last = i === bars.length - 1
        return (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            {last && b.value > 0 && <span className="text-[10px] font-semibold text-accent tabular">{format(b.value)}</span>}
            <div className="w-full rounded-[6px] transition-[height] duration-700 ease-[cubic-bezier(.2,.9,.25,1)]"
              style={{ height: `${Math.max(3, (b.value / max) * (height - 34))}px`, background: color, opacity: last ? 1 : 0.35 }} />
            <span className="text-[10px] text-muted tabular">{b.label}</span>
          </div>
        )
      })}
    </div>
  )
}
