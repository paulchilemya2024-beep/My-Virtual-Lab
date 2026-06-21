import { useCallback, useEffect, useRef, useState } from 'react'

// Projectile motion with real kinematics:
//   x(t) = v0·cosθ·t,  y(t) = v0·sinθ·t − ½·g·t²
// The student adjusts launch angle and speed to land a cannonball in a target
// placed at a random distance. Each shot is logged so patterns (e.g. 45° gives
// maximum range) become visible.

const G = 9.8
const WORLD_W = 280 // metres shown horizontally
const WORLD_H = 160 // metres shown vertically
const TIME_SCALE = 1.4 // speed the animation up a touch so flights feel snappy
const HIT_TOLERANCE = 9 // metres

function randomTarget() {
  // Reachable distances run up to v²/g ≈ 255 m at 45°; keep targets in a fair band.
  return Math.round(60 + Math.random() * 170)
}

export default function ProjectileLab({ lab }) {
  const { experiment, consultTutor, pushMessage, setProgress, setSummary } = lab
  const totalSteps = experiment?.steps?.length || 4

  const [angle, setAngle] = useState(45)
  const [velocity, setVelocity] = useState(30)
  const [target, setTarget] = useState(() => randomTarget())
  const [attempts, setAttempts] = useState([])
  const [flying, setFlying] = useState(false)

  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const stateRef = useRef({
    flying: false,
    t: 0,
    angle: 45,
    velocity: 30,
    points: [],
    target: target,
    celebrate: 0,
    landedX: 0,
    live: { h: 0, x: 0, t: 0, maxH: 0 },
  })
  const lastAttemptRef = useRef(null)
  const hitOnceRef = useRef(false)

  useEffect(() => {
    stateRef.current.target = target
  }, [target])

  const launch = useCallback(() => {
    if (stateRef.current.flying) return
    const s = stateRef.current
    s.flying = true
    s.t = 0
    s.angle = angle
    s.velocity = velocity
    s.points = []
    s.celebrate = 0
    s.live = { h: 0, x: 0, t: 0, maxH: 0 }
    setFlying(true)
  }, [angle, velocity])

  const finishShot = useCallback(
    (range, maxH, flightTime) => {
      const t = stateRef.current.target
      const miss = range - t
      const hit = Math.abs(miss) <= HIT_TOLERANCE
      const attempt = { angle, velocity, range: Math.round(range), target: t, hit }
      setAttempts((prev) => [...prev, attempt])

      if (hit) {
        stateRef.current.celebrate = 1.6
        if (!hitOnceRef.current) {
          hitOnceRef.current = true
          setSummary({ precisionAchieved: true })
        }
      }
      setProgress({ completed: Math.min(totalSteps, (attempts.length + 1)), total: totalSteps })

      const prev = lastAttemptRef.current
      let trend = ''
      if (prev) {
        const dAngle = angle - prev.angle
        const dRange = Math.round(range) - prev.range
        if (dAngle !== 0) {
          trend = ` Compared with my last shot I changed the angle by ${dAngle > 0 ? '+' : ''}${dAngle}° and the range changed by ${dRange > 0 ? '+' : ''}${dRange} m.`
        }
      }
      lastAttemptRef.current = attempt

      pushMessage('student', `I fired at ${angle}° and ${velocity} m/s — it landed at ${Math.round(range)} m.`)
      consultTutor(
        '',
        `launched a projectile at ${angle}° and ${velocity} m/s; it travelled ${Math.round(range)} m toward a target at ${t} m (${hit ? 'HIT!' : miss > 0 ? 'overshot' : 'fell short'}).${trend}`,
        {
          angle,
          velocity,
          rangeAchieved: Math.round(range),
          maxHeight: Math.round(maxH),
          flightTime: Number(flightTime.toFixed(1)),
          targetDistance: t,
          hitTarget: hit,
        },
      )
    },
    [angle, velocity, attempts.length, totalSteps, consultTutor, pushMessage, setProgress, setSummary],
  )

  // ── Canvas render + physics loop ──
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    let dims = { w: 0, h: 0 }
    let scale = 2
    let x0 = 40
    let groundY = 0

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
      x0 = 42
      groundY = h - 38
      scale = Math.min((w - x0 - 20) / WORLD_W, (groundY - 20) / WORLD_H)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const sx = (xm) => x0 + xm * scale
    const sy = (ym) => groundY - ym * scale

    let last = performance.now()
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = stateRef.current

      if (s.flying) {
        s.t += dt * TIME_SCALE
        const vx = s.velocity * Math.cos((s.angle * Math.PI) / 180)
        const vy = s.velocity * Math.sin((s.angle * Math.PI) / 180)
        const x = vx * s.t
        const y = vy * s.t - 0.5 * G * s.t * s.t
        s.live = { h: Math.max(0, y), x, t: s.t, maxH: Math.max(s.live.maxH, y) }
        if (y <= 0 && s.t > 0.01) {
          // Landed — compute exact range/time analytically.
          const flightTime = (2 * vy) / G
          const range = vx * flightTime
          const maxH = (vy * vy) / (2 * G)
          s.flying = false
          s.landedX = range
          s.points.push([range, 0])
          setFlying(false)
          finishShot(range, maxH, flightTime)
        } else {
          s.points.push([x, y])
        }
      }
      if (s.celebrate > 0) s.celebrate = Math.max(0, s.celebrate - dt)

      draw(s)
      raf = requestAnimationFrame(frame)
    }

    function draw(s) {
      const { w, h } = dims
      ctx.clearRect(0, 0, w, h)
      // Sky + ground
      const sky = ctx.createLinearGradient(0, 0, 0, h)
      sky.addColorStop(0, '#dbeafe')
      sky.addColorStop(1, '#eef3f8')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#cde3c0'
      ctx.fillRect(0, groundY, w, h - groundY)
      ctx.strokeStyle = 'rgba(20,28,46,0.3)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke()

      // Distance ticks every 50 m
      ctx.fillStyle = 'rgba(20,28,46,0.4)'
      ctx.font = '10px ui-monospace, monospace'
      for (let m = 0; m <= WORLD_W; m += 50) {
        const x = sx(m)
        ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY + 6); ctx.stroke()
        ctx.fillText(`${m}m`, x - 8, groundY + 18)
      }

      // Launch platform + cannon
      ctx.fillStyle = '#7a8699'
      ctx.fillRect(x0 - 16, groundY - 14, 26, 14)
      ctx.save()
      ctx.translate(x0, groundY - 10)
      ctx.rotate((-s.angle * Math.PI) / 180)
      ctx.fillStyle = '#0A0F1E'
      ctx.fillRect(0, -6, 30, 12)
      ctx.restore()

      // Target (flag + bucket)
      const tx = sx(s.target)
      ctx.fillStyle = '#8a5a2b'
      ctx.fillRect(tx - 12, groundY - 14, 24, 14)
      ctx.strokeStyle = '#5e3d1c'
      ctx.strokeRect(tx - 12, groundY - 14, 24, 14)
      ctx.strokeStyle = 'rgba(20,28,46,0.6)'
      ctx.beginPath(); ctx.moveTo(tx, groundY - 14); ctx.lineTo(tx, groundY - 48); ctx.stroke()
      ctx.fillStyle = '#e23b2a'
      ctx.beginPath(); ctx.moveTo(tx, groundY - 48); ctx.lineTo(tx + 20, groundY - 42); ctx.lineTo(tx, groundY - 36); ctx.closePath(); ctx.fill()

      // Trajectory (dotted)
      if (s.points.length > 1) {
        ctx.setLineDash([2, 6])
        ctx.strokeStyle = 'rgba(20,28,46,0.55)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(sx(s.points[0][0]), sy(s.points[0][1]))
        for (const [xm, ym] of s.points) ctx.lineTo(sx(xm), sy(ym))
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Cannonball
      if (s.flying) {
        const px = sx(s.live.x)
        const py = sy(s.live.h)
        ctx.fillStyle = '#0A0F1E'
        ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill()
      }

      // Live readings
      ctx.fillStyle = 'rgba(20,28,46,0.85)'
      ctx.font = '12px ui-monospace, monospace'
      const lines = [
        `height:   ${s.live.h.toFixed(1)} m`,
        `distance: ${s.live.x.toFixed(1)} m`,
        `time:     ${s.live.t.toFixed(1)} s`,
        `max H:    ${s.live.maxH.toFixed(1)} m`,
      ]
      lines.forEach((ln, i) => ctx.fillText(ln, 12, 20 + i * 16))

      // Celebration
      if (s.celebrate > 0) {
        const a = s.celebrate / 1.6
        ctx.fillStyle = `rgba(20,28,46,${a})`
        ctx.font = 'bold 22px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('🎯 Direct hit!', w / 2, 40)
        for (let i = 0; i < 18; i++) {
          const ang = (i / 18) * Math.PI * 2
          const r = (1.6 - s.celebrate) * 90
          ctx.fillStyle = ['#e23b2a', '#f4d000', '#1f6feb', '#3cb043'][i % 4]
          ctx.beginPath()
          ctx.arc(tx + Math.cos(ang) * r, groundY - 30 + Math.sin(ang) * r, 4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.textAlign = 'start'
      }
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [finishShot])

  function newTarget() {
    setTarget(randomTarget())
  }

  return (
    <div className="sim projectile-lab">
      <div ref={wrapRef} className="lab-canvas-wrap physics-canvas-wrap">
        <canvas ref={canvasRef} className="lab-canvas" role="img" aria-label="Projectile motion simulation with a launcher and a target." />
      </div>

      <h2>Controls</h2>
      <div className="control-group">
        <label>Launch angle: {angle}°</label>
        <input type="range" min="0" max="90" value={angle} onChange={(e) => setAngle(Number(e.target.value))} aria-label="Launch angle" />
      </div>
      <div className="control-group">
        <label>Initial velocity: {velocity} m/s</label>
        <input type="range" min="10" max="50" value={velocity} onChange={(e) => setVelocity(Number(e.target.value))} aria-label="Initial velocity" />
      </div>
      <div className="control-row">
        <button type="button" className="btn btn-primary btn-sm" onClick={launch} disabled={flying}>
          {flying ? 'In flight…' : '🚀 Launch'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={newTarget} disabled={flying}>
          🎯 New target
        </button>
        <span className="readout-sub">Target at <strong>{target} m</strong></span>
      </div>

      <h2>Attempts</h2>
      <div className="results-table">
        <div className="results-row results-head">
          <span>#</span><span>Angle</span><span>Velocity</span><span>Range</span><span>Result</span>
        </div>
        {attempts.length === 0 && <p className="text-muted results-empty">No shots yet — adjust the angle and velocity, then launch.</p>}
        {attempts.map((a, i) => (
          <div key={i} className="results-row">
            <span>{i + 1}</span>
            <span>{a.angle}°</span>
            <span>{a.velocity} m/s</span>
            <span>{a.range} m</span>
            <span className={a.hit ? 'ph-base' : 'ph-acid'}>{a.hit ? 'Hit 🎯' : a.range > a.target ? 'Over' : 'Short'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
