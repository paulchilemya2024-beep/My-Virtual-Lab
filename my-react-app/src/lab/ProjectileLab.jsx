import { useCallback, useEffect, useRef, useState } from 'react'

// Projectile motion with real kinematics:
//   x(t) = v0·cosθ·t,  y(t) = v0·sinθ·t − ½·g·t²
// A night-sky range with a rotating launcher barrel, a live dotted trajectory
// preview, a glowing comet-tail ball, a random bullseye target with hit/near-
// miss/miss feedback, a switchable gravity (Earth/Moon/Mars/Jupiter), and an
// attempts log that reveals the 45°-max-range and complementary-angle patterns.

const GRAVITIES = [
  { id: 'earth', name: 'Earth', emoji: '🌍', g: 9.81 },
  { id: 'moon', name: 'Moon', emoji: '🌙', g: 1.62 },
  { id: 'mars', name: 'Mars', emoji: '🔴', g: 3.72 },
  { id: 'jupiter', name: 'Jupiter', emoji: '🟠', g: 24.79 },
]
const SPEEDS = [
  { id: 'slow', label: '🐢', mult: 0.3 },
  { id: 'normal', label: '▶', mult: 1 },
  { id: 'fast', label: '⚡', mult: 3 },
]
const HIT_TOLERANCE = 5 // metres
const NEAR_TOLERANCE = 15 // metres
const MAX_ATTEMPTS_SHOWN = 8

function rangeFor(v, angleDeg, g) {
  return (v * v * Math.sin((2 * angleDeg * Math.PI) / 180)) / g
}
function maxHeightFor(v, angleDeg, g) {
  const vy = v * Math.sin((angleDeg * Math.PI) / 180)
  return (vy * vy) / (2 * g)
}
function timeOfFlightFor(v, angleDeg, g) {
  const vy = v * Math.sin((angleDeg * Math.PI) / 180)
  return (2 * vy) / g
}
function randomTarget() {
  return Math.round(80 + Math.random() * 150) // 80–230 m
}

export default function ProjectileLab({ lab }) {
  const { setProgress, setSummary, experiment } = lab

  const [angle, setAngle] = useState(45)
  const [velocity, setVelocity] = useState(30)
  const [gravityId, setGravityId] = useState('earth')
  const [speedId, setSpeedId] = useState('normal')
  const [target, setTarget] = useState(() => randomTarget())
  const [attempts, setAttempts] = useState([])
  const [flying, setFlying] = useState(false)
  const [hitCount, setHitCount] = useState(0)
  const [readout, setReadout] = useState({ t: 0, x: 0, h: 0, vx: 0, vy: 0 })
  const [lastSummary, setLastSummary] = useState(null) // { range, maxHeight, flightTime, predicted, hit, miss, missText }

  const gravity = GRAVITIES.find((x) => x.id === gravityId).g
  const speedMult = SPEEDS.find((x) => x.id === speedId).mult

  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const stateRef = useRef({
    flying: false,
    t: 0,
    angle: 45,
    velocity: 30,
    g: 9.81,
    points: [], // full flown path this shot, in metres
    trail: [], // last ~20 canvas-space positions for the comet fade
    target,
    celebrate: 0,
    missFlash: null, // { x, text, color, life }
    live: { h: 0, x: 0, t: 0, vy: 0 },
    launchFlash: 0,
    peakSparkle: 0,
    peakFired: false,
    dust: [],
    hitParticles: [],
  })
  const hitOnceRef = useRef(false)

  // ── Step-completion tracking (order-independent, matches the rest of the app) ──
  const gravitiesTestedRef = useRef(new Set(['earth']))
  const previewTimerRef = useRef(0)
  const [previewViewed, setPreviewViewed] = useState(false)

  const recomputeProgress = useCallback(
    (attemptsList, hits, gravitiesTestedCount) => {
      const step1 = previewViewed
      const step2 = attemptsList.length >= 1
      const step3 = attemptsList.length >= 4
      const step4 = attemptsList.some((a, i) =>
        attemptsList.some((b, j) => i !== j && a.velocity === b.velocity && a.angle + b.angle === 90),
      )
      const step5 = gravitiesTestedCount >= 2
      const step6 = hits >= 1
      const completed = [step1, step2, step3, step4, step5, step6].filter(Boolean).length
      setProgress({ completed, total: 6 })
      if (step6) setSummary({ precisionAchieved: true })
    },
    [previewViewed, setProgress, setSummary],
  )

  useEffect(() => {
    recomputeProgress(attempts, hitCount, gravitiesTestedRef.current.size)
  }, [attempts, hitCount, previewViewed, recomputeProgress])

  // A slider moved while not flying → after 3s of no further change, step 1 completes.
  useEffect(() => {
    if (flying) return
    clearTimeout(previewTimerRef.current)
    previewTimerRef.current = setTimeout(() => setPreviewViewed(true), 3000)
    return () => clearTimeout(previewTimerRef.current)
  }, [angle, velocity, flying])

  useEffect(() => {
    stateRef.current.target = target
  }, [target])
  useEffect(() => {
    gravitiesTestedRef.current.add(gravityId)
  }, [gravityId])

  const launch = useCallback(() => {
    if (stateRef.current.flying) return
    const s = stateRef.current
    s.flying = true
    s.t = 0
    s.angle = angle
    s.velocity = velocity
    s.g = gravity
    s.points = []
    s.trail = []
    s.celebrate = 0
    s.missFlash = null
    s.launchFlash = 1
    s.peakSparkle = 0
    s.peakFired = false
    s.dust = []
    s.live = { h: 0, x: 0, t: 0, vy: velocity * Math.sin((angle * Math.PI) / 180) }
    setFlying(true)
  }, [angle, velocity, gravity])

  const finishShot = useCallback(
    (range, maxHeight, flightTime) => {
      const t = stateRef.current.target
      const diff = Math.abs(range - t)
      const hit = diff <= HIT_TOLERANCE
      const attempt = { angle, velocity, gravityId, range: Math.round(range * 10) / 10, maxHeight: Math.round(maxHeight * 10) / 10, hit }
      setAttempts((prev) => [...prev, attempt])

      const predicted = rangeFor(velocity, angle, gravity)
      let missText = null
      if (hit) {
        stateRef.current.celebrate = 2
        if (!hitOnceRef.current) {
          hitOnceRef.current = true
        }
        setHitCount((c) => c + 1)
      } else if (diff <= NEAR_TOLERANCE) {
        missText = { text: `Close! ${diff.toFixed(1)} m off target`, color: '#ff9800' }
      } else {
        missText = { text: `Landed ${diff.toFixed(1)} m from target`, color: '#e2ecff' }
      }
      if (missText) stateRef.current.missFlash = { ...missText, life: 3 }

      setLastSummary({ range, maxHeight, flightTime, predicted, hit })
    },
    [angle, velocity, gravity, gravityId],
  )

  // ── Canvas render + physics loop ──
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    let dims = { w: 0, h: 0 }
    let groundY = 0
    let pivotX = 60

    // Decorative stars — regenerated on resize, twinkle via sin(time).
    let stars = []
    function buildStars(w, h, count) {
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.62,
        r: 0.6 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      }))
    }

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
      groundY = h - 60
      pivotX = 60
      buildStars(w, h, stateRef.current.g < 5 && stateRef.current.g > 1 ? 60 : 40)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    // World scale adapts so the current preview/flight/target always fits.
    function worldWidth() {
      const s = stateRef.current
      const predicted = rangeFor(s.velocity, s.angle, s.g)
      return Math.max(120, predicted * 1.15, s.target * 1.15, 100)
    }
    function scalePxPerM() {
      const { w } = dims
      return (w - pivotX - 30) / worldWidth()
    }
    const sx = (xm) => pivotX + xm * scalePxPerM()
    const sy = (ym) => groundY - ym * scalePxPerM()

    function spawnHitParticles(x, y) {
      const s = stateRef.current
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2
        const speed = 3 + Math.random() * 5
        s.hitParticles.push({
          x, y,
          vx: Math.cos(a) * speed * 20,
          vy: Math.sin(a) * speed * 20,
          color: ['#ff3333', '#ffffff', '#ffcc00'][i % 3],
          life: 0.8,
        })
      }
    }
    function spawnDust(x, y) {
      const s = stateRef.current
      const n = 4 + Math.floor(Math.random() * 3)
      for (let i = 0; i < n; i++) {
        const a = Math.PI + Math.random() * Math.PI // upward-ish spread
        s.dust.push({
          x, y,
          vx: Math.cos(a) * (20 + Math.random() * 30),
          vy: -Math.abs(Math.sin(a)) * (10 + Math.random() * 15),
          r: 2 + Math.random() * 3,
          life: 0.5,
        })
      }
    }

    let last = performance.now()
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = stateRef.current

      if (s.flying) {
        s.t += dt * speedMult
        const rad = (s.angle * Math.PI) / 180
        const vx = s.velocity * Math.cos(rad)
        const vy0 = s.velocity * Math.sin(rad)
        const xM = vx * s.t
        const yM = vy0 * s.t - 0.5 * s.g * s.t * s.t
        const vyNow = vy0 - s.g * s.t
        s.live = { h: Math.max(0, yM), x: xM, t: s.t, vy: vyNow }

        // Peak sparkle: fires once, near the top of the arc.
        if (!s.peakFired && vyNow <= 0) {
          s.peakFired = true
          s.peakSparkle = 1
        }
        if (s.peakSparkle > 0) s.peakSparkle = Math.max(0, s.peakSparkle - dt / 0.15)

        if (yM <= 0 && s.t > 0.05) {
          const flightTime = timeOfFlightFor(s.velocity, s.angle, s.g)
          const range = rangeFor(s.velocity, s.angle, s.g)
          const maxHeight = maxHeightFor(s.velocity, s.angle, s.g)
          s.flying = false
          s.points.push([range, 0])
          spawnDust(sx(range), groundY)
          setFlying(false)
          finishShot(range, maxHeight, flightTime)
        } else {
          s.points.push([xM, yM])
          const cvx = sx(xM)
          const cvy = sy(Math.max(0, yM))
          s.trail.push({ x: cvx, y: cvy })
          if (s.trail.length > 20) s.trail.shift()
        }
      }
      if (s.celebrate > 0) s.celebrate = Math.max(0, s.celebrate - dt)
      if (s.launchFlash > 0) s.launchFlash = Math.max(0, s.launchFlash - dt / 0.3)
      if (s.missFlash) {
        s.missFlash.life -= dt
        if (s.missFlash.life <= 0) s.missFlash = null
      }
      for (let i = s.dust.length - 1; i >= 0; i--) {
        const d = s.dust[i]
        d.x += d.vx * dt
        d.y += d.vy * dt
        d.vy += 40 * dt
        d.life -= dt / 0.5
        if (d.life <= 0) s.dust.splice(i, 1)
      }
      for (let i = s.hitParticles.length - 1; i >= 0; i--) {
        const p = s.hitParticles[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 60 * dt
        p.life -= dt / 0.8
        if (p.life <= 0) s.hitParticles.splice(i, 1)
      }
      if (s.celebrate > 1.85 && s.hitParticles.length === 0) {
        spawnHitParticles(sx(s.target), groundY - 20)
      }

      // Sync live readouts to React ~10x/sec (avoid re-rendering every frame).
      if (Math.floor(now / 100) !== Math.floor((now - dt * 1000) / 100)) {
        const rad = (s.angle * Math.PI) / 180
        setReadout({
          t: s.live.t,
          x: s.live.x,
          h: s.live.h,
          vx: s.flying ? s.velocity * Math.cos(rad) : 0,
          vy: s.live.vy,
        })
      }

      draw(s)
      raf = requestAnimationFrame(frame)
    }

    function drawStars(time, isMoon) {
      ctx.save()
      for (const st of stars) {
        const tw = 0.5 + 0.5 * Math.sin(time * st.speed + st.phase)
        ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.5})`
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (isMoon) {
        const { w } = dims
        ctx.fillStyle = 'rgba(230,235,250,0.85)'
        ctx.beginPath()
        ctx.arc(w - 60, 44, 18, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#0a0f1e'
        ctx.beginPath()
        ctx.arc(w - 52, 38, 16, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    function drawLauncher(angleDeg, launchFlash) {
      ctx.fillStyle = '#444'
      ctx.beginPath()
      ctx.roundRect(pivotX - 15, groundY - 20, 30, 20, 3)
      ctx.fill()

      ctx.save()
      ctx.translate(pivotX, groundY - 14)
      ctx.rotate((-angleDeg * Math.PI) / 180)
      const grad = ctx.createLinearGradient(0, -6, 0, 6)
      grad.addColorStop(0, '#8a8f99')
      grad.addColorStop(0.5, '#666')
      grad.addColorStop(1, '#454a52')
      ctx.fillStyle = grad
      ctx.fillRect(0, -6, 60, 12)
      ctx.restore()

      // Angle arc + label (unrotated, drawn in screen space).
      ctx.strokeStyle = 'rgba(255,200,0,0.4)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(pivotX, groundY - 14, 40, -angleDeg * Math.PI / 180, 0)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,220,120,0.9)'
      ctx.font = 'bold 12px ui-monospace, monospace'
      ctx.fillText(`${angleDeg}°`, pivotX + 44, groundY - 14 - 34 * Math.sin((angleDeg * Math.PI) / 180) - 4)

      // Launch flash — starburst at barrel tip.
      if (launchFlash > 0) {
        const rad = (angleDeg * Math.PI) / 180
        const tipX = pivotX + Math.cos(rad) * 60
        const tipY = groundY - 14 - Math.sin(rad) * 60
        ctx.save()
        ctx.globalAlpha = launchFlash
        ctx.strokeStyle = '#fff4c2'
        ctx.lineWidth = 2
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          const len = 8 + launchFlash * 14
          ctx.beginPath()
          ctx.moveTo(tipX, tipY)
          ctx.lineTo(tipX + Math.cos(a) * len, tipY + Math.sin(a) * len)
          ctx.stroke()
        }
        ctx.restore()
      }
    }

    function drawTarget(distanceM) {
      const tx = sx(distanceM)
      // Bullseye rings.
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#ff3333'
      ctx.beginPath(); ctx.ellipse(tx, groundY, 20, 7, 0, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 0.7
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.ellipse(tx, groundY, 12, 4.2, 0, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 0.9
      ctx.fillStyle = '#ff3333'
      ctx.beginPath(); ctx.ellipse(tx, groundY, 6, 2.1, 0, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1

      // Flag pole.
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(tx, groundY); ctx.lineTo(tx, groundY - 30); ctx.stroke()
      ctx.fillStyle = '#ffe066'
      ctx.beginPath(); ctx.moveTo(tx, groundY - 30); ctx.lineTo(tx + 14, groundY - 25); ctx.lineTo(tx, groundY - 20); ctx.closePath(); ctx.fill()

      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = '11px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`Target: ${distanceM}m`, tx, groundY - 38)
      ctx.textAlign = 'start'
    }

    function draw(s) {
      const { w, h } = dims
      const isMoon = s.g < 5 && s.g > 1
      ctx.clearRect(0, 0, w, h)

      // Sky.
      const sky = ctx.createLinearGradient(0, 0, 0, h)
      if (isMoon) {
        sky.addColorStop(0, '#060912'); sky.addColorStop(0.5, '#131f3d'); sky.addColorStop(1, '#22355f')
      } else {
        sky.addColorStop(0, '#0a0f1e'); sky.addColorStop(0.5, '#1a2a4a'); sky.addColorStop(1, '#2a4a7a')
      }
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, h)
      drawStars(performance.now() / 1000, isMoon)

      // Ground.
      const groundGrad = ctx.createLinearGradient(0, groundY, 0, h)
      groundGrad.addColorStop(0, '#1a2a0a')
      groundGrad.addColorStop(1, '#0d1506')
      ctx.fillStyle = groundGrad
      ctx.fillRect(0, groundY, w, h - groundY)
      ctx.strokeStyle = 'rgba(150,255,150,0.4)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke()

      // Ground grid.
      ctx.strokeStyle = 'rgba(0,255,100,0.06)'
      ctx.lineWidth = 1
      const pxPerM = scalePxPerM()
      for (let x = pivotX % (50 * pxPerM); x < w; x += Math.max(10, 50 * pxPerM) / 5) {
        ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, h); ctx.stroke()
      }
      for (let y = groundY; y < h; y += 25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }

      // Distance markers every 50 m.
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '11px ui-monospace, monospace'
      const worldW = worldWidth()
      for (let m = 0; m <= worldW; m += 50) {
        const x = sx(m)
        if (x > w) break
        ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, groundY + 6); ctx.stroke()
        ctx.fillText(`${m}m`, x - 10, groundY + 18)
      }

      drawTarget(s.target)
      drawLauncher(s.angle, s.launchFlash)

      // Dotted trajectory preview (live, while not flying).
      if (!s.flying) {
        const rad = (s.angle * Math.PI) / 180
        const T = timeOfFlightFor(s.velocity, s.angle, s.g)
        const antOffset = (performance.now() / 200) % 8
        ctx.save()
        ctx.globalAlpha = 0.25
        ctx.fillStyle = '#ffffff'
        let dist = -antOffset
        for (let t = 0; t <= T; t += T / 120) {
          const xm = s.velocity * Math.cos(rad) * t
          const ym = s.velocity * Math.sin(rad) * t - 0.5 * s.g * t * t
          if (ym < -0.5) break
          const px = sx(xm)
          const py = sy(Math.max(0, ym))
          dist += 1
          if (dist > 0 && dist % 8 < 1.2) {
            ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill()
          }
        }
        ctx.restore()
      }

      // Flown path (replaces the preview once launched/landed).
      if (s.points.length > 1) {
        ctx.strokeStyle = 'rgba(255,204,0,0.35)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(sx(s.points[0][0]), sy(s.points[0][1]))
        for (const [xm, ym] of s.points) ctx.lineTo(sx(xm), sy(Math.max(0, ym)))
        ctx.stroke()
      }

      // Comet trail (fading dots behind the ball).
      const n = s.trail.length
      for (let i = 0; i < n; i++) {
        const p = s.trail[i]
        const age = (n - i) / n // 0 newest .. 1 oldest
        ctx.globalAlpha = Math.max(0, 0.6 * (1 - age))
        ctx.fillStyle = '#ffcc00'
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(2, 8 * (1 - age)), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // The glowing ball itself.
      if (s.flying) {
        const px = sx(s.live.x)
        const py = sy(s.live.h)
        ctx.save()
        ctx.shadowColor = '#ffaa00'
        ctx.shadowBlur = 15
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 8)
        glow.addColorStop(0, '#ffffff')
        glow.addColorStop(0.5, '#ffcc00')
        glow.addColorStop(1, '#ff6600')
        ctx.fillStyle = glow
        ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill()
        ctx.restore()

        // Peak sparkle.
        if (s.peakSparkle > 0) {
          ctx.save()
          ctx.globalAlpha = s.peakSparkle
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.5
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2
            const len = 6 + (1 - s.peakSparkle) * 10
            ctx.beginPath()
            ctx.moveTo(px + Math.cos(a) * 8, py + Math.sin(a) * 8)
            ctx.lineTo(px + Math.cos(a) * (8 + len), py + Math.sin(a) * (8 + len))
            ctx.stroke()
          }
          ctx.restore()
        }
      }

      // Dust cloud on landing.
      for (const d of s.dust) {
        ctx.globalAlpha = Math.max(0, d.life)
        ctx.fillStyle = 'rgba(140,120,90,0.7)'
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1

      // Hit particles + flash + bullseye text.
      if (s.hitParticles.length) {
        for (const p of s.hitParticles) {
          ctx.globalAlpha = Math.max(0, p.life)
          ctx.fillStyle = p.color
          ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill()
        }
        ctx.globalAlpha = 1
      }
      if (s.celebrate > 0) {
        const a = Math.min(1, s.celebrate)
        if (s.celebrate > 1.7) {
          ctx.fillStyle = `rgba(255,255,255,${(s.celebrate - 1.7) * 0.5})`
          ctx.fillRect(0, 0, w, h)
        }
        ctx.save()
        ctx.shadowColor = '#ffcc00'
        ctx.shadowBlur = 12
        ctx.fillStyle = `rgba(255,204,0,${a})`
        ctx.font = 'bold 32px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('BULLSEYE! 🎯', w / 2, h / 2 - 40)
        ctx.restore()
        ctx.textAlign = 'start'
      }

      // Miss / near-miss text + X mark.
      if (s.missFlash) {
        const alpha = Math.min(1, s.missFlash.life)
        ctx.globalAlpha = alpha
        ctx.fillStyle = s.missFlash.color
        ctx.font = 'bold 14px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(s.missFlash.text, w / 2, 50)
        ctx.textAlign = 'start'
        if (s.points.length) {
          const [lastX] = s.points[s.points.length - 1]
          const lx = sx(lastX)
          ctx.strokeStyle = s.missFlash.color
          ctx.lineWidth = 2
          ctx.beginPath(); ctx.moveTo(lx - 6, groundY - 6); ctx.lineTo(lx + 6, groundY + 6); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(lx + 6, groundY - 6); ctx.lineTo(lx - 6, groundY + 6); ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // Live readings overlay (top-right).
      const boxW = 190
      const boxH = s.flying ? 118 : 0
      if (s.flying) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.beginPath(); ctx.roundRect(w - boxW - 10, 10, boxW, boxH, 8); ctx.fill()
        ctx.fillStyle = '#e2ecff'
        ctx.font = '11px ui-monospace, monospace'
        const lines = [
          `⏱ Time: ${s.live.t.toFixed(2)} s`,
          `📏 Distance: ${s.live.x.toFixed(1)} m`,
          `↕ Height: ${s.live.h.toFixed(1)} m`,
          `➡ Horiz. speed: ${(s.velocity * Math.cos((s.angle * Math.PI) / 180)).toFixed(1)} m/s`,
          `↕ Vert. speed: ${s.live.vy.toFixed(1)} m/s`,
        ]
        lines.forEach((ln, i) => ctx.fillText(ln, w - boxW, 30 + i * 18))
      }

      // Scale indicator (bottom-right).
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`Scale: 1px ≈ ${(1 / pxPerM).toFixed(2)}m`, w - 10, h - 8)
      ctx.textAlign = 'start'
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [finishShot, speedMult])

  function newTarget() {
    setTarget(randomTarget())
  }
  function resetBall() {
    const s = stateRef.current
    s.flying = false
    s.points = []
    s.trail = []
    s.celebrate = 0
    s.missFlash = null
    setFlying(false)
    setLastSummary(null)
  }
  function clearLog() {
    setAttempts([])
    setHitCount(0)
  }

  const predictedRange = rangeFor(velocity, angle, gravity)
  const predictedHeight = maxHeightFor(velocity, angle, gravity)
  const predictedTime = timeOfFlightFor(velocity, angle, gravity)

  // Reactivity ranking-style hint: has 45° been tested and does it beat other
  // same-velocity attempts logged so far?
  const found45 =
    attempts.some((a) => a.angle === 45) &&
    (() => {
      const at45 = attempts.filter((a) => a.angle === 45)
      const bestAt45 = Math.max(...at45.map((a) => a.range))
      const others = attempts.filter((a) => a.angle !== 45 && a.velocity === at45[0]?.velocity)
      return others.length > 0 && others.every((a) => a.range <= bestAt45 + 0.5)
    })()

  const complementaryAnglesFound = attempts.some((a, i) =>
    attempts.some((b, j) => i !== j && a.velocity === b.velocity && a.angle + b.angle === 90),
  )

  const missionSteps = [
    { label: 'Preview the trajectory', done: previewViewed },
    { label: 'Launch one shot', done: attempts.length >= 1 },
    { label: 'Try several angles', done: attempts.length >= 4 },
    { label: 'Compare complementary angles', done: complementaryAnglesFound },
    { label: 'Test another planet', done: gravitiesTestedRef.current.size >= 2 },
    { label: 'Hit the target', done: hitCount >= 1 },
  ]

  const conceptInsight = found45
    ? '45° gives the maximum range for a fixed launch speed.'
    : complementaryAnglesFound
      ? 'Complementary launch angles give the same range when speed is unchanged.'
      : gravityId !== 'earth'
        ? 'Weaker gravity gives a longer flight time and a larger range.'
        : 'Try changing angle or speed to see how the trajectory changes.'

  const visibleAttempts = attempts.slice(-MAX_ATTEMPTS_SHOWN)

  return (
    <div className="sim projectile-lab">
      <div ref={wrapRef} className="lab-canvas-wrap physics-canvas-wrap projectile-canvas-wrap">
        <canvas ref={canvasRef} className="lab-canvas" role="img" aria-label="Projectile motion range with a rotating launcher and a bullseye target." />
      </div>

      <div className="predicted-box">
        <p className="predicted-label">Predicted values — launch to confirm</p>
        <div className="predicted-grid">
          <span>Range: <strong>{predictedRange.toFixed(1)} m</strong></span>
          <span>Max height: <strong>{predictedHeight.toFixed(1)} m</strong></span>
          <span>Flight time: <strong>{predictedTime.toFixed(2)} s</strong></span>
        </div>
        {lastSummary && (
          <p className="predicted-confirm">
            {Math.abs(lastSummary.range - lastSummary.predicted) < 0.1 ? '✓ Matched predicted range exactly!' : `Actual range: ${lastSummary.range.toFixed(1)} m`}
          </p>
        )}
      </div>

      <div className="results-table attempts-log-wrap">
        <div className="results-row results-head">
          <span>Mission</span>
          <span>Status</span>
        </div>
        {missionSteps.map((step) => (
          <div key={step.label} className="results-row">
            <span>{step.label}</span>
            <span className={step.done ? 'ph-base' : 'ph-acid'}>{step.done ? '✓ Done' : '○ Pending'}</span>
          </div>
        ))}
      </div>

      <p className="attempts-hint attempts-hint-success">{conceptInsight}</p>
      {experiment?.learningObjectives?.length > 0 && (
        <div className="predicted-box">
          <p className="predicted-label">Learning goals</p>
          <ul className="text-muted" style={{ margin: '0.4rem 0 0 1.1rem', padding: 0 }}>
            {experiment.learningObjectives.map((goal) => <li key={goal}>{goal}</li>)}
          </ul>
        </div>
      )}

      <h2>Launcher settings</h2>
      <div className="control-group">
        <label>Launch angle: {angle}°</label>
        <input type="range" min="5" max="85" value={angle} onChange={(e) => setAngle(Number(e.target.value))} aria-label="Launch angle" disabled={flying} />
      </div>
      <div className="control-group">
        <label>Initial velocity: {velocity} m/s</label>
        <input type="range" min="10" max="50" value={velocity} onChange={(e) => setVelocity(Number(e.target.value))} aria-label="Initial velocity" disabled={flying} />
      </div>
      <div className="control-group">
        <label>Gravity: g = {gravity} m/s²</label>
        <select className="form-input gravity-select" value={gravityId} onChange={(e) => setGravityId(e.target.value)} disabled={flying}>
          {GRAVITIES.map((gr) => (
            <option key={gr.id} value={gr.id}>{gr.emoji} {gr.name} — {gr.g} m/s²</option>
          ))}
        </select>
      </div>

      <div className="control-row">
        <button type="button" className={`btn btn-primary btn-sm launch-btn ${!flying ? 'is-pulsing' : ''}`} onClick={launch} disabled={flying}>
          {flying ? 'In flight…' : '🚀 LAUNCH'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={resetBall} disabled={flying}>
          🔄 Reset
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={newTarget} disabled={flying}>
          🎯 New Target
        </button>
      </div>
      <div className="speed-toggle">
        {SPEEDS.map((sp) => (
          <button key={sp.id} type="button" className={`speed-btn ${speedId === sp.id ? 'active' : ''}`} onClick={() => setSpeedId(sp.id)}>
            {sp.label}
          </button>
        ))}
      </div>

      <h2>Attempts log</h2>
      <div className="results-table attempts-log-wrap">
        <div className="results-row results-head">
          <span>#</span><span>Angle</span><span>Velocity</span><span>Range</span><span>Max H</span><span>Hit?</span>
        </div>
        {attempts.length === 0 && <p className="text-muted results-empty">No shots yet — adjust the controls, then launch.</p>}
        {visibleAttempts.map((a, i) => (
          <div key={i} className="results-row">
            <span>{attempts.length - visibleAttempts.length + i + 1}</span>
            <span>{a.angle}°</span>
            <span>{a.velocity} m/s</span>
            <span>{a.range} m</span>
            <span>{a.maxHeight} m</span>
            <span className={a.hit ? 'ph-base' : 'ph-acid'}>{a.hit ? 'Hit 🎯' : '✗'}</span>
          </div>
        ))}
      </div>
      {attempts.length >= 3 && (
        <p className="attempts-hint">Notice how some attempts share the same range but different heights — why is this?</p>
      )}
      {found45 && <p className="attempts-hint attempts-hint-success">✓ Maximum range achieved at 45°!</p>}
      <button type="button" className="btn btn-outline btn-full btn-sm" onClick={clearLog}>
        Clear log
      </button>

      <p className="readout-sub live-readout-fallback">
        {flying
          ? `t=${readout.t.toFixed(2)}s  x=${readout.x.toFixed(1)}m  h=${readout.h.toFixed(1)}m  vx=${readout.vx.toFixed(1)}  vy=${readout.vy.toFixed(1)}`
          : `Target at ${target} m · Hits: ${hitCount}`}
      </p>
    </div>
  )
}
