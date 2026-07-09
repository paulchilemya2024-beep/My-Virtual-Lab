import { useCallback, useEffect, useRef, useState } from 'react'

// Forces on a block resting on an inclined plane. The block slides once the
// slope angle passes the friction threshold (tanθ > μ). Force vectors are drawn
// live: weight (red), normal (blue), friction (orange) and the net force (white).

const G = 9.8
const MASS = 2 // kg (fixed, so the lesson is about angle + friction)

const SURFACES = [
  { id: 'wood', name: 'Wood on wood', mu: 0.3 },
  { id: 'metal', name: 'Metal on metal', mu: 0.5 },
  { id: 'rubber', name: 'Rubber on concrete', mu: 0.8 },
  { id: 'ice', name: 'Ice on metal', mu: 0.03 },
]

export default function InclineLab({ lab }) {
  const { experiment, setProgress, setSummary } = lab
  const totalSteps = experiment?.steps?.length || 4

  const [angle, setAngle] = useState(20)
  const [surfaceId, setSurfaceId] = useState('wood')
  const [sliding, setSliding] = useState(false)

  const surface = SURFACES.find((s) => s.id === surfaceId)
  const angleRef = useRef(angle)
  const muRef = useRef(surface.mu)
  const slidingRef = useRef(false)
  const sRef = useRef(0) // fraction slid from top (0..1)
  const vRef = useRef(0) // m/s down-slope
  const slideCountRef = useRef(0)
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    angleRef.current = angle
  }, [angle])
  useEffect(() => {
    muRef.current = surface.mu
    // Changing the surface re-seats the block at the top.
    sRef.current = 0
    vRef.current = 0
  }, [surface.mu, surfaceId])

  const onStartSliding = useCallback(() => {
    slideCountRef.current += 1
    setSummary({ precisionAchieved: true })
    setProgress({ completed: Math.min(totalSteps, slideCountRef.current), total: totalSteps })
  }, [totalSteps, setProgress, setSummary])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    let dims = { w: 0, h: 0 }

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
      const theta = (angleRef.current * Math.PI) / 180
      const mu = muRef.current
      const sinT = Math.sin(theta)
      const cosT = Math.cos(theta)
      const along = MASS * G * sinT
      const normal = MASS * G * cosT
      const maxStatic = mu * normal

      // Sliding dynamics.
      const wasSliding = slidingRef.current
      if (!slidingRef.current) {
        if (along > maxStatic + 1e-4 && sRef.current < 1) slidingRef.current = true
      }
      let frictionMag
      if (slidingRef.current) {
        const a = G * (sinT - mu * cosT) // along-slope accel (kinetic)
        vRef.current = Math.max(0, vRef.current + a * dt)
        // Map metres to ramp-fraction: assume a 4 m ramp.
        sRef.current += (vRef.current * dt) / 4
        frictionMag = mu * normal
        if (sRef.current >= 1) {
          sRef.current = 1
          vRef.current = 0
          slidingRef.current = false
        }
        if (vRef.current === 0 && along <= maxStatic) slidingRef.current = false
      } else {
        frictionMag = Math.min(maxStatic, along) // static friction balances gravity
      }
      if (slidingRef.current !== wasSliding) {
        setSliding(slidingRef.current)
        if (!wasSliding && slidingRef.current) onStartSliding()
      }

      draw(theta, normal, frictionMag, along)
      raf = requestAnimationFrame(frame)
    }

    function arrow(x, y, dx, dy, color, label) {
      const len = Math.hypot(dx, dy)
      if (len < 1) return
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke()
      const ang = Math.atan2(dy, dx)
      const ah = 8
      ctx.beginPath()
      ctx.moveTo(x + dx, y + dy)
      ctx.lineTo(x + dx - ah * Math.cos(ang - 0.4), y + dy - ah * Math.sin(ang - 0.4))
      ctx.lineTo(x + dx - ah * Math.cos(ang + 0.4), y + dy - ah * Math.sin(ang + 0.4))
      ctx.closePath(); ctx.fill()
      if (label) {
        ctx.font = 'bold 12px ui-monospace, monospace'
        ctx.fillText(label, x + dx + 4 * Math.cos(ang), y + dy + 4 * Math.sin(ang))
      }
    }

    function draw(theta, normal, frictionMag, along) {
      const { w, h } = dims
      ctx.clearRect(0, 0, w, h)
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, '#0c162c'); bg.addColorStop(1, '#080f1e')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)

      const sinT = Math.sin(theta)
      const cosT = Math.cos(theta)
      const groundY = h - 40
      const bx = 60 // bottom-left vertex
      const L = Math.min((w - bx - 60) / Math.max(cosT, 0.3), groundY - 50)
      const top = { x: bx + L * cosT, y: groundY - L * sinT }
      const bottom = { x: bx, y: groundY }

      // Ramp body (filled triangle)
      ctx.fillStyle = 'rgba(120,134,153,0.35)'
      ctx.beginPath()
      ctx.moveTo(bottom.x, bottom.y)
      ctx.lineTo(top.x, top.y)
      ctx.lineTo(top.x, groundY)
      ctx.closePath(); ctx.fill()
      ctx.strokeStyle = 'rgba(226,236,255,0.55)'; ctx.lineWidth = 2.5; ctx.stroke()
      // Ground
      ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke()
      // Angle arc
      ctx.strokeStyle = 'rgba(226,236,255,0.5)'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(bottom.x, bottom.y, 34, -theta, 0); ctx.stroke()
      ctx.fillStyle = 'rgba(226,236,255,0.8)'; ctx.font = '12px ui-monospace, monospace'
      ctx.fillText(`${angleRef.current}°`, bottom.x + 40, bottom.y - 8)

      // Block position along incline
      const s = sRef.current
      const downSlope = { x: (bottom.x - top.x), y: (bottom.y - top.y) }
      const cx = top.x + downSlope.x * s
      const cy = top.y + downSlope.y * s
      const nOut = { x: -sinT, y: -cosT } // outward normal (up away from ramp)
      const half = 17
      const bxC = cx + nOut.x * half
      const byC = cy + nOut.y * half

      // Block (rotated square)
      ctx.save()
      ctx.translate(bxC, byC)
      ctx.rotate(-theta)
      ctx.fillStyle = '#33507f'
      ctx.fillRect(-half, -half, half * 2, half * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(-half, -half, half * 2, 6)
      ctx.restore()

      // ── Force vectors from block centre ──
      const k = 4.5 // px per newton
      const u = { x: cosT, y: -sinT } // up-slope unit
      // Weight (down)
      arrow(bxC, byC, 0, MASS * G * k, '#e23b2a', 'mg')
      // Normal (outward)
      arrow(bxC, byC, nOut.x * normal * k, nOut.y * normal * k, '#1f6feb', 'N')
      // Friction (up-slope, resisting)
      arrow(bxC, byC, u.x * frictionMag * k, u.y * frictionMag * k, '#f0a500', 'f')
      // Net force
      const netAlong = along - frictionMag // down-slope positive
      const dnSlope = { x: -cosT, y: sinT }
      if (Math.abs(netAlong) > 0.05) {
        arrow(bxC, byC, dnSlope.x * netAlong * k, dnSlope.y * netAlong * k, '#ffffff', 'Net')
      }
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [onStartSliding])

  function resetBlock() {
    sRef.current = 0
    vRef.current = 0
    slidingRef.current = false
  }

  const theta = (angle * Math.PI) / 180
  const threshold = Math.atan(surface.mu) * (180 / Math.PI)
  // Equation values derive directly from angle + surface (no per-frame state).
  const eqNormal = MASS * G * Math.cos(theta)
  const eqAlong = MASS * G * Math.sin(theta)
  const eqFriction = sliding ? surface.mu * eqNormal : Math.min(surface.mu * eqNormal, eqAlong)

  return (
    <div className="sim incline-lab">
      <div ref={wrapRef} className="lab-canvas-wrap physics-canvas-wrap">
        <canvas ref={canvasRef} className="lab-canvas" role="img" aria-label="A block on an inclined plane with force vectors drawn." />
      </div>

      <h2>Controls</h2>
      <div className="control-group">
        <label>Ramp angle: {angle}°</label>
        <input type="range" min="0" max="60" value={angle} onChange={(e) => setAngle(Number(e.target.value))} aria-label="Ramp angle" />
        <span className="readout-sub">Slips above ≈ {threshold.toFixed(0)}° on this surface</span>
      </div>
      <div className="surface-tray">
        {SURFACES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`material-chip ${surfaceId === s.id ? 'active' : ''}`}
            onClick={() => setSurfaceId(s.id)}
          >
            {s.name} <span className="mu-tag">μ={s.mu}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-outline btn-full btn-sm" onClick={resetBlock}>↺ Reset block</button>

      <h2>Live equations</h2>
      <div className="equations-panel">
        <div className="eq-row"><span>Weight component along ramp</span><code>mg·sinθ = {eqAlong.toFixed(1)} N</code></div>
        <div className="eq-row"><span>Normal force</span><code>mg·cosθ = {eqNormal.toFixed(1)} N</code></div>
        <div className="eq-row"><span>Friction force</span><code>μ·F_normal = {eqFriction.toFixed(1)} N</code></div>
        <div className={`eq-row eq-status ${sliding ? 'is-sliding' : ''}`}>
          <span>State</span>
          <code>{sliding ? 'SLIDING — net force ≠ 0' : 'At rest — friction balances gravity'}</code>
        </div>
      </div>
    </div>
  )
}
