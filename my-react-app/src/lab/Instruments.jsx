import { useEffect, useRef, useState } from 'react'

// A number that scrolls smoothly to a new value instead of jumping — used for
// every instrument readout (pH meter, thermometer, volume, voltmeter).
export function AnimatedNumber({ value, decimals = 1, suffix = '', className }) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = displayRef.current
    const to = value
    if (Math.abs(to - from) < 1e-4) {
      displayRef.current = to
      setDisplay(to)
      return
    }
    const start = performance.now()
    const diff = Math.abs(to - from)
    // Scale duration with change magnitude so large jumps animate slower.
    // Also enforce a maximum change rate (pH units per second) so the
    // readout cannot jump unrealistically fast.
    const baseDuration = Math.max(600, Math.min(2200, 400 + diff * 600))
    const maxRate = 0.25 // pH units per second (lower = slower)
    const minDurationForRate = diff > 0 ? Math.ceil((diff / maxRate) * 1000) : baseDuration
    const duration = Math.max(baseDuration, Math.min(6000, minDurationForRate))
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const v = from + (to - from) * eased
      displayRef.current = v
      setDisplay(v)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  return (
    <span className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  )
}

// An animated thermometer gauge. The mercury column height transitions via CSS
// and its colour shifts from cool blue to hot red as the temperature rises.
export function Thermometer({ temp, min = 10, max = 90 }) {
  const pct = Math.max(0, Math.min(100, ((temp - min) / (max - min)) * 100))
  // Cool (#3b82f6) → warm (#f59e0b) → hot (#e11d2b).
  const t = Math.max(0, Math.min(1, (temp - min) / (max - min)))
  const color = t < 0.5 ? lerpHex('#3b82f6', '#f59e0b', t * 2) : lerpHex('#f59e0b', '#e11d2b', (t - 0.5) * 2)
  return (
    <div className="thermometer" aria-hidden="true">
      <div className="thermo-tube">
        <div className="thermo-mercury" style={{ height: `${pct}%`, background: color }} />
      </div>
      <div className="thermo-bulb" style={{ background: color }} />
    </div>
  )
}

// A full pH scale (0–14) with a marker that slides to the current reading. The
// gradient mirrors universal-indicator colours so the bar doubles as a key.
export function PhScale({ ph }) {
  const pct = Math.max(0, Math.min(100, (ph / 14) * 100))
  return (
    <div className="ph-scale" aria-hidden="true">
      <div className="ph-scale-bar" />
      <div className="ph-scale-marker" style={{ left: `${pct}%` }}>
        <span className="ph-scale-value">{ph.toFixed(1)}</span>
      </div>
      <div className="ph-scale-ticks">
        <span>0</span>
        <span>7</span>
        <span>14</span>
      </div>
    </div>
  )
}

// A small status pill — "Positive", "No reaction", "Hazard", etc. `tone` maps to
// a colour (ok / warn / danger / muted) so every chemistry sim can report its
// own kind of result without a pH meter.
export function ResultBadge({ label, tone = 'muted' }) {
  return <span className={`result-badge tone-${tone}`}>{label}</span>
}

// A compact checklist of goals for an experiment. Each goal is { label, done }.
export function GoalTracker({ title = 'Goals', goals }) {
  return (
    <div className="goal-tracker">
      <p className="goal-tracker-title">{title}</p>
      <ul>
        {goals.map((goal) => (
          <li key={goal.label} className={goal.done ? 'is-done' : ''}>
            <span className="goal-check">{goal.done ? '✓' : '○'}</span>
            {goal.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ar = (pa >> 16) & 255
  const ag = (pa >> 8) & 255
  const ab = pa & 255
  const br = (pb >> 16) & 255
  const bg = (pb >> 8) & 255
  const bb = pb & 255
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r}, ${g}, ${bl})`
}
