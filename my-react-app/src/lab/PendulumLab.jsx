import { useEffect, useRef, useState } from 'react'

// Simple pendulum: period T = 2π·√(L/g), independent of mass and (for small
// swings) of amplitude. Energy trades between kinetic and potential as it swings.
// The student can switch gravity (Earth/Moon/Mars) and verify the period with a
// live stopwatch that counts real oscillations.

const GRAVITIES = [
  { id: 'earth', name: 'Earth', g: 9.8 },
  { id: 'moon', name: 'Moon', g: 1.6 },
  { id: 'mars', name: 'Mars', g: 3.7 },
]

export default function PendulumLab({ lab }) {
  const { experiment, consultTutor, pushMessage, setProgress, setSummary } = lab
  const totalSteps = experiment?.steps?.length || 4

  const [length, setLength] = useState(1.0) // m
  const [angle, setAngle] = useState(20) // degrees
  const [mass, setMass] = useState(1.0) // kg
  const [gravityId, setGravityId] = useState('earth')
  const [running, setRunning] = useState(true)
  const [measured, setMeasured] = useState({ osc: 0, elapsed: 0 })

  const gravity = GRAVITIES.find((x) => x.id === gravityId).g
  const period = 2 * Math.PI * Math.sqrt(length / gravity)

  const paramsRef = useRef({ L: length, theta0: (angle * Math.PI) / 180, g: gravity })
  const runningRef = useRef(true)
  const tRef = useRef(0)
  const oscRef = useRef(0)
  const elapsedRef = useRef(0)
  const lastPhaseRef = useRef(0)
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const massDebounceRef = useRef(0)
  const exploredRef = useRef(new Set())
  const massRef = useRef(mass) // latest mass for the canvas loop, without restarting it

  useEffect(() => {
    massRef.current = mass
  }, [mass])

  // Update physics params; reset the swing so motion stays coherent.
  useEffect(() => {
    paramsRef.current = { L: length, theta0: (angle * Math.PI) / 180, g: gravity }
    tRef.current = 0
    oscRef.current = 0
    elapsedRef.current = 0
    lastPhaseRef.current = 0
  }, [length, angle, gravity])

  useEffect(() => {
    runningRef.current = running
  }, [running])

  // Track which lessons the student has explored to gate completion.
  useEffect(() => {
    exploredRef.current.add(`g:${gravityId}`)
    const explored = exploredRef.current
    const gravities = [...explored].filter((k) => k.startsWith('g:')).length
    if (gravities >= 2) {
      setSummary({ precisionAchieved: true })
    }
    setProgress({ completed: Math.min(totalSteps, explored.size), total: totalSteps })
  }, [gravityId, setProgress, setSummary, totalSteps])

  // Mass changes shouldn't affect the period — prompt SIMI to make the point.
  function handleMassChange(next) {
    const prev = mass
    setMass(next)
    if (next === prev) return
    clearTimeout(massDebounceRef.current)
    massDebounceRef.current = setTimeout(() => {
      pushMessage('student', `I changed the bob mass to ${next.toFixed(1)} kg.`)
      consultTutor(
        '',
        `changed the bob mass from ${prev.toFixed(1)} kg to ${next.toFixed(1)} kg, but the period stayed at ${period.toFixed(2)} s`,
        { mass: next, length, gravity, period: Number(period.toFixed(2)), massChangedPeriod: false },
      )
    }, 500)
  }

  useEffect(() => () => clearTimeout(massDebounceRef.current), [])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    let dims = { w: 0, h: 0 }
    let lastSync = 0

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      dims = { w, h }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    let last = performance.now()
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { L, theta0, g } = paramsRef.current
      const omega = Math.sqrt(g / L)

      if (runningRef.current) {
        tRef.current += dt
        elapsedRef.current += dt
        const phase = omega * tRef.current
        // Count a full oscillation each time the phase passes a multiple of 2π.
        if (Math.floor(phase / (2 * Math.PI)) > Math.floor(lastPhaseRef.current / (2 * Math.PI))) {
          oscRef.current += 1
        }
        lastPhaseRef.current = phase
      }

      const theta = theta0 * Math.cos(omega * tRef.current)
      if (now - lastSync > 150) {
        lastSync = now
        setMeasured({ osc: oscRef.current, elapsed: elapsedRef.current })
      }
      draw(theta, theta0)
      raf = requestAnimationFrame(frame)
    }

    function draw(theta, theta0) {
      const { w, h } = dims
      ctx.clearRect(0, 0, w, h)
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, '#eef3f8'); bg.addColorStop(1, '#e3eaf1')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)

      const pivotX = w * 0.42
      const pivotY = 40
      const pxPerM = Math.min((h - pivotY - 50) / 2.0, (w * 0.36) / 1.0)
      const Lpx = paramsRef.current.L * pxPerM
      const bobX = pivotX + Lpx * Math.sin(theta)
      const bobY = pivotY + Lpx * Math.cos(theta)

      // Pivot mount
      ctx.fillStyle = 'rgba(20,28,46,0.7)'
      ctx.fillRect(pivotX - 24, pivotY - 8, 48, 8)
      // Reference vertical
      ctx.strokeStyle = 'rgba(20,28,46,0.18)'
      ctx.setLineDash([3, 5])
      ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(pivotX, pivotY + Lpx + 20); ctx.stroke()
      ctx.setLineDash([])
      // Swing arc
      ctx.strokeStyle = 'rgba(20,28,46,0.15)'
      ctx.beginPath(); ctx.arc(pivotX, pivotY, Lpx, Math.PI / 2 - theta0, Math.PI / 2 + theta0); ctx.stroke()
      // String
      ctx.strokeStyle = 'rgba(20,28,46,0.7)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(bobX, bobY); ctx.stroke()
      // Bob — radius grows a little with mass
      const r = 10 + Math.sqrt(massRef.current) * 8
      const grad = ctx.createRadialGradient(bobX - r * 0.3, bobY - r * 0.3, 2, bobX, bobY, r)
      grad.addColorStop(0, '#37507a'); grad.addColorStop(1, '#0A0F1E')
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(bobX, bobY, r, 0, Math.PI * 2); ctx.fill()

      // Angle label
      ctx.fillStyle = 'rgba(20,28,46,0.65)'; ctx.font = '12px ui-monospace, monospace'
      ctx.fillText(`θ = ${(theta * 180 / Math.PI).toFixed(0)}°`, pivotX + 30, pivotY + 20)

      // ── Energy bars (KE vs PE) ── exact split from conservation of energy:
      // KE is full at the bottom (θ=0) and zero at the extremes (θ=±θ0).
      const cos0 = Math.cos(theta0)
      const keFrac = theta0 === 0 ? 0 : (Math.cos(theta) - cos0) / (1 - cos0)
      const ke = Math.max(0, Math.min(1, keFrac))
      const pe = 1 - ke
      const barX = w - 92
      const barW = 26
      const barH = h - 90
      const barY = 50
      ctx.fillStyle = 'rgba(20,28,46,0.6)'; ctx.font = 'bold 11px ui-monospace, monospace'
      ctx.fillText('Energy', barX - 4, 32)
      // KE bar
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = '#1f6feb'; ctx.fillRect(barX, barY + barH * (1 - ke), barW, barH * ke)
      ctx.fillStyle = 'rgba(20,28,46,0.6)'; ctx.fillText('KE', barX + 2, barY + barH + 16)
      // PE bar
      const barX2 = barX + barW + 14
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(barX2, barY, barW, barH)
      ctx.fillStyle = '#f0a500'; ctx.fillRect(barX2, barY + barH * (1 - pe), barW, barH * pe)
      ctx.fillStyle = 'rgba(20,28,46,0.6)'; ctx.fillText('PE', barX2 + 2, barY + barH + 16)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const measuredPeriod = measured.osc > 0 ? measured.elapsed / measured.osc : 0

  return (
    <div className="sim pendulum-lab">
      <div ref={wrapRef} className="lab-canvas-wrap physics-canvas-wrap">
        <canvas ref={canvasRef} className="lab-canvas" role="img" aria-label="A swinging pendulum with a kinetic vs potential energy chart." />
      </div>

      <div className="sim-readouts">
        <div className="readout-chip">
          <span className="readout-label">Theoretical period</span>
          <strong className="readout-value">{period.toFixed(2)} s</strong>
          <span className="readout-sub">T = 2π√(L/g)</span>
        </div>
        <div className="readout-chip">
          <span className="readout-label">Measured period</span>
          <strong className="readout-value">{measuredPeriod > 0 ? `${measuredPeriod.toFixed(2)} s` : '—'}</strong>
          <span className="readout-sub">{measured.osc} oscillations · {measured.elapsed.toFixed(1)} s</span>
        </div>
      </div>

      <h2>Controls</h2>
      <div className="control-group">
        <label>String length: {length.toFixed(2)} m</label>
        <input type="range" min="0.1" max="2" step="0.05" value={length} onChange={(e) => setLength(Number(e.target.value))} aria-label="String length" />
      </div>
      <div className="control-group">
        <label>Release angle: {angle}°</label>
        <input type="range" min="5" max="45" value={angle} onChange={(e) => setAngle(Number(e.target.value))} aria-label="Release angle" />
      </div>
      <div className="control-group">
        <label>Bob mass: {mass.toFixed(1)} kg</label>
        <input type="range" min="0.5" max="5" step="0.5" value={mass} onChange={(e) => handleMassChange(Number(e.target.value))} aria-label="Bob mass" />
        <span className="readout-sub">Watch the period — does mass change it?</span>
      </div>
      <div className="surface-tray">
        {GRAVITIES.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`material-chip ${gravityId === x.id ? 'active' : ''}`}
            onClick={() => setGravityId(x.id)}
          >
            {x.name} <span className="mu-tag">g={x.g}</span>
          </button>
        ))}
      </div>
      <div className="control-row">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setRunning((r) => !r)}>
          {running ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => { tRef.current = 0; oscRef.current = 0; elapsedRef.current = 0; lastPhaseRef.current = 0; setMeasured({ osc: 0, elapsed: 0 }) }}
        >
          ↺ Reset timer
        </button>
      </div>
    </div>
  )
}
