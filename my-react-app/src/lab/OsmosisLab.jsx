import { useCallback, useEffect, useRef, useState } from 'react'
import { GoalTracker } from './Instruments.jsx'

// Cell osmosis — a fully independent biology simulation. NO flask, NO pH meter,
// NO flow-rate slider. A microscope-style dark canvas shows a living cell with a
// membrane, nucleus, mitochondria and 60 drifting water-molecule particles that
// net-flow toward the more concentrated side. The cell swells/shrinks smoothly
// toward a target size, lyses when overswollen, crenates when overshrunk, and a
// plant-cell toggle adds a rigid wall, vacuole, chloroplasts, turgor and
// plasmolysis. Concentration bars and an external-solution particle density
// visualise the same concentration gradient without needing to read a number.

const SOLUTIONS = [
  { id: 'distilled', name: 'Distilled Water', targetScale: 1.42, dir: 1, extDensity: 5, extColor: { r: 210, g: 230, b: 255 }, bg: '#050d1a', label: null },
  { id: 'saline', name: '0.9% Saline', targetScale: 1.0, dir: 0, extDensity: 30, extColor: { r: 220, g: 230, b: 245 }, bg: '#06101e', label: null },
  { id: 'salt10', name: '10% Salt Solution', targetScale: 0.62, dir: -1, extDensity: 120, extColor: { r: 235, g: 240, b: 250 }, bg: '#081422', label: 'High salt concentration' },
  { id: 'sugar20', name: '20% Sugar Solution', targetScale: 0.52, dir: -1, extDensity: 100, extColor: { r: 235, g: 205, b: 140 }, bg: '#0a0f18', label: 'High sugar concentration', extSize: 3.2 },
]
const AUTO_COMPLETE_MS = 8000

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

// ── The microscope canvas: cell + particles + arrows + meters, drawn fresh each
// frame from a mutable ref state so React re-renders never restart the sim. ──
function CellCanvas({ stateRef }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    let dims = { w: 0, h: 0 }

    // 60 water-molecule particles living in polar coordinates around the cell
    // centre, so "inside vs outside the membrane" is a simple radius compare.
    const water = Array.from({ length: 60 }, (_, i) => ({
      angle: (i / 60) * Math.PI * 2 + Math.random() * 0.5,
      radius: 40 + Math.random() * 160,
      vAngle: (Math.random() - 0.5) * 0.4,
      justCrossed: 0,
    }))
    // External "solute" texture particles — density/colour set by solution.
    let extParticles = []
    function rebuildExtParticles(sol) {
      extParticles = Array.from({ length: sol.extDensity }, () => ({
        angle: Math.random() * Math.PI * 2,
        phase: Math.random() * 400, // scatters particles across the band instead of a synced ring
        speed: 0.05 + Math.random() * 0.1,
        size: (sol.extSize || 1.6) * (0.7 + Math.random() * 0.6),
      }))
    }
    rebuildExtParticles(SOLUTIONS[0])
    let lastSolutionId = null

    const ripples = []
    const fragments = []

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      dims = { w, h, dpr }
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
      const s = stateRef.current
      const sol = SOLUTIONS.find((x) => x.id === s.solutionId) || SOLUTIONS[0]
      if (sol.id !== lastSolutionId) {
        rebuildExtParticles(sol)
        lastSolutionId = sol.id
      }

      // Ease displayed scale toward the target, unless frozen after lysis.
      if (!s.frozen) {
        s.scale += (s.targetScale - s.scale) * (1 - Math.exp(-dt / 2.2))
      }

      const { w, h } = dims
      const cx = w / 2
      const cy = h / 2
      const baseR = Math.min(w, h) * 0.22
      const membraneR = baseR * s.scale
      const wallR = baseR * 1.55 // fixed — plant cell wall never scales

      // ── Lysis state machine ──
      if (!s.frozen && s.scale > 1.62 && !s.plant && s.cellState !== 'lysed') {
        s.cellState = 'lysed'
        s.lysisT = 0
        fragments.length = 0
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2
          fragments.push({ angle: a, r: membraneR, vr: 60 + Math.random() * 80, rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.3, len: 15 + Math.random() * 25 })
        }
      }
      if (s.cellState === 'lysed') {
        s.lysisT += dt
        if (s.lysisT > 3.5) {
          s.cellState = 'normal'
          s.scale = 1
          s.frozen = true // require a deliberate reset/new solution to swell again
        }
      } else if (s.cellState !== 'lysed') {
        s.cellState = s.scale < 0.72 ? 'crenated' : s.scale > 1.3 ? 'swelling' : s.scale < 0.85 ? 'shrinking' : 'normal'
      }

      // ── Water particles: bias toward the membrane's net flow direction ──
      for (const p of water) {
        p.angle += p.vAngle * dt
        const nearBand = 90
        const dist = p.radius - membraneR
        let bias = 0
        if (sol.dir > 0 && dist > 0 && dist < nearBand) bias = -18 // hypotonic: inward
        else if (sol.dir < 0 && dist < 0 && -dist < nearBand) bias = 18 // hypertonic: outward
        p.radius += (bias + (Math.random() - 0.5) * 10) * dt
        p.radius = clamp(p.radius, 14, Math.min(w, h) * 0.46)
        const wasIn = p.prevRadius != null && p.prevRadius < membraneR
        const isIn = p.radius < membraneR
        if (p.prevRadius != null && wasIn !== isIn && p.justCrossed <= 0) {
          ripples.push({ angle: p.angle, r: membraneR, life: 1 })
          p.justCrossed = 0.3
        }
        p.justCrossed = Math.max(0, p.justCrossed - dt)
        p.prevRadius = p.radius
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].life -= dt * 1.6
        if (ripples[i].life <= 0) ripples.splice(i, 1)
      }
      for (const ep of extParticles) ep.angle += ep.speed * dt

      // ── Concentration meters ease toward their targets ──
      const targetInterior = sol.dir > 0 ? 40 - (s.scale - 1) * 22 : sol.dir < 0 ? 40 + (1 - s.scale) * 55 : 40
      s.interiorPct += (clamp(targetInterior, 5, 90) - s.interiorPct) * (1 - Math.exp(-dt / 1.5))
      const targetExterior = sol.id === 'distilled' ? 4 : sol.id === 'saline' ? 40 : sol.id === 'salt10' ? 78 : 70
      s.exteriorPct += (targetExterior - s.exteriorPct) * (1 - Math.exp(-dt / 1.5))

      draw(now / 1000, dt, cx, cy, membraneR, wallR, sol, s)
      raf = requestAnimationFrame(frame)
    }

    function draw(time, dt, cx, cy, membraneR, wallR, sol, s) {
      const { w, h } = dims
      ctx.fillStyle = sol.bg
      ctx.fillRect(0, 0, w, h)

      // ── External solution texture (concentration visualised without words) ──
      const extRange = Math.max(40, Math.max(w, h) * 0.5 - membraneR - 30)
      for (const ep of extParticles) {
        const r = membraneR + 30 + ((ep.phase + time * 4) % extRange)
        const x = cx + Math.cos(ep.angle) * r
        const y = cy + Math.sin(ep.angle) * r * 0.9
        if (x < 0 || x > w || y < 0 || y > h) continue
        ctx.fillStyle = `rgba(${sol.extColor.r},${sol.extColor.g},${sol.extColor.b},0.55)`
        ctx.beginPath()
        ctx.arc(x, y, ep.size, 0, Math.PI * 2)
        ctx.fill()
      }
      if (sol.label) {
        ctx.fillStyle = 'rgba(226,236,255,0.7)'
        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(sol.label, w - 12, 20)
        ctx.textAlign = 'left'
      }

      // ── Plant cell wall (fixed size, never scales) ──
      if (s.plant) {
        ctx.save()
        ctx.strokeStyle = '#3d7a2a'
        ctx.lineWidth = 8
        ctx.beginPath()
        ctx.arc(cx, cy, wallR, 0, Math.PI * 2)
        if (s.scale > 1.15) {
          ctx.shadowColor = '#44ff44'
          ctx.shadowBlur = 10
        }
        ctx.stroke()
        ctx.restore()
        ctx.fillStyle = 'rgba(226,236,255,0.7)'
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillText('Cell Wall', cx + wallR * 0.6, cy - wallR * 0.7)

        // Plasmolysis gap between shrunken membrane and fixed wall.
        if (s.scale < 0.85) {
          ctx.fillStyle = 'rgba(10,26,48,0.85)'
          ctx.beginPath()
          ctx.arc(cx, cy, wallR - 4, 0, Math.PI * 2)
          ctx.arc(cx, cy, membraneR, 0, Math.PI * 2, true)
          ctx.fill()
          ctx.fillStyle = 'rgba(226,236,255,0.75)'
          ctx.font = '10px system-ui, sans-serif'
          ctx.fillText('Plasmolysis gap', cx - wallR * 0.3, cy + (wallR + membraneR) / 2)
        } else if (s.scale > 1.15) {
          ctx.fillStyle = 'rgba(226,236,255,0.75)'
          ctx.font = '10px system-ui, sans-serif'
          ctx.fillText('Turgid (turgor pressure)', cx - wallR * 0.55, cy + wallR + 16)
        }
      }

      // ── Lysis fragment burst (animal cell overswollen) ──
      if (s.cellState === 'lysed') {
        const t = s.lysisT
        let alpha = 1
        if (t < 0.3) {
          ctx.save()
          ctx.strokeStyle = `rgba(255,68,68,${0.9})`
          ctx.lineWidth = 5
          ctx.beginPath()
          ctx.arc(cx, cy, membraneR, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        } else if (t < 1.5) {
          alpha = 1 - (t - 0.3) / 1.2
          for (const f of fragments) {
            f.r += f.vr * dt
            f.rot += f.vrot * dt
            const x = cx + Math.cos(f.angle) * f.r
            const y = cy + Math.sin(f.angle) * f.r
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(f.rot)
            ctx.strokeStyle = `rgba(102,255,136,${Math.max(0, alpha)})`
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(0, 0, f.len, 0, Math.PI * 0.6)
            ctx.stroke()
            ctx.restore()
          }
        } else {
          alpha = Math.max(0, 1 - (t - 1.5) / 1.0)
        }
        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.9
        ctx.fillStyle = '#ff4444'
        ctx.font = 'bold 16px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('LYSIS — cell membrane ruptured', cx, cy - membraneR - 20)
        ctx.textAlign = 'left'
        ctx.restore()
        return // skip drawing an intact cell while it is destroyed
      }

      // ── Water molecule particles ──
      for (const p of water) {
        const x = cx + Math.cos(p.angle) * p.radius
        const y = cy + Math.sin(p.angle) * p.radius * 0.92
        ctx.fillStyle = 'rgba(91,184,255,0.75)'
        ctx.beginPath()
        ctx.arc(x, y, 3.2, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const rp of ripples) {
        const x = cx + Math.cos(rp.angle) * rp.r
        const y = cy + Math.sin(rp.angle) * rp.r * 0.92
        ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, rp.life) * 0.7})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(x, y, 6 + (1 - rp.life) * 10, 0, Math.PI * 2)
        ctx.stroke()
      }

      // ── The cell membrane (crenated = bumpy path; else smooth wobble) ──
      const crenated = s.cellState === 'crenated'
      const wobble = crenated ? 6 : 2
      const bumpFreq = crenated ? 14 : 8
      ctx.beginPath()
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.08) {
        const r = membraneR + Math.sin(a * bumpFreq + time * 0.5) * wobble
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r * 0.92
        if (a === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      const cellGrad = ctx.createRadialGradient(cx - membraneR * 0.3, cy - membraneR * 0.3, membraneR * 0.1, cx, cy, membraneR)
      const cytoTop = crenated ? 'rgba(212,184,106,0.32)' : 'rgba(180,220,180,0.22)'
      cellGrad.addColorStop(0, cytoTop)
      cellGrad.addColorStop(1, 'rgba(70,170,135,0.20)')
      ctx.fillStyle = cellGrad
      ctx.fill()
      const glow = 0.7 + Math.sin(time * 1.5) * 0.3
      ctx.strokeStyle = crenated ? `rgba(212,184,106,${glow})` : `rgba(100,200,120,${glow})`
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.strokeStyle = 'rgba(150,230,150,0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, membraneR - 4, 0, Math.PI * 2)
      ctx.stroke()

      // ── Central vacuole (plant only) ──
      if (s.plant) {
        ctx.fillStyle = 'rgba(232,245,232,0.22)'
        ctx.beginPath()
        ctx.arc(cx, cy, membraneR * 0.55, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(226,236,255,0.55)'
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillText('Central Vacuole', cx - membraneR * 0.4, cy)
      }

      // ── Nucleus + nucleolus ──
      const nx = cx - membraneR * 0.15
      const ny = cy - membraneR * 0.05
      const nr = membraneR * 0.32
      const nucGrad = ctx.createRadialGradient(nx - nr * 0.3, ny - nr * 0.3, nr * 0.1, nx, ny, nr)
      nucGrad.addColorStop(0, '#1a3a8f')
      nucGrad.addColorStop(1, '#0d1f5c')
      ctx.fillStyle = nucGrad
      ctx.beginPath()
      ctx.arc(nx, ny, nr, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(80,120,255,0.7)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.strokeStyle = 'rgba(60,100,220,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(nx, ny, nr - 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#4a1080'
      ctx.beginPath()
      ctx.arc(nx + nr * 0.25, ny - nr * 0.2, nr * 0.28, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(226,236,255,0.5)'
      ctx.font = '10px system-ui, sans-serif'
      ctx.fillText('Nucleus', nx + nr + 4, ny)

      // ── Mitochondria (3, gently drifting) ──
      for (let i = 0; i < 3; i++) {
        const baseA = (i / 3) * Math.PI * 2 + 1.2
        const bx = cx + Math.cos(baseA) * membraneR * 0.55 + Math.sin(time * 0.4 + i) * 8
        const by = cy + Math.sin(baseA) * membraneR * 0.5 + Math.cos(time * 0.3 + i) * 6
        ctx.save()
        ctx.translate(bx, by)
        ctx.rotate(baseA)
        const mGrad = ctx.createLinearGradient(-8, 0, 8, 0)
        mGrad.addColorStop(0, '#c8a951')
        mGrad.addColorStop(1, '#8b6914')
        ctx.fillStyle = mGrad
        ctx.beginPath()
        ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        if (i === 0) {
          ctx.fillStyle = 'rgba(226,236,255,0.5)'
          ctx.font = '10px system-ui, sans-serif'
          ctx.fillText('Mitochondria', bx + 12, by)
        }
      }

      // ── Chloroplasts (plant only) ──
      if (s.plant) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.5
          const gx = cx + Math.cos(a) * membraneR * 0.72
          const gy = cy + Math.sin(a) * membraneR * 0.68
          ctx.save()
          ctx.shadowColor = 'rgba(45,138,45,0.9)'
          ctx.shadowBlur = 8
          ctx.fillStyle = '#2d8a2d'
          ctx.beginPath()
          ctx.ellipse(gx, gy, 7, 4, a, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // ── Flow direction arrows (4 around the membrane) ──
      if (sol.dir !== 0) {
        const arrowColor = sol.dir > 0 ? '91,184,255' : '255,136,68'
        const pulse = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2))
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4
          const r1 = sol.dir > 0 ? membraneR + 34 : membraneR - 4
          const r2 = sol.dir > 0 ? membraneR + 10 : membraneR + 22
          const x1 = cx + Math.cos(a) * r1
          const y1 = cy + Math.sin(a) * r1 * 0.92
          const x2 = cx + Math.cos(a) * r2
          const y2 = cy + Math.sin(a) * r2 * 0.92
          ctx.strokeStyle = `rgba(${arrowColor},${pulse})`
          ctx.fillStyle = `rgba(${arrowColor},${pulse})`
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          const ang = Math.atan2(y2 - y1, x2 - x1)
          ctx.beginPath()
          ctx.moveTo(x2, y2)
          ctx.lineTo(x2 - 6 * Math.cos(ang - 0.5), y2 - 6 * Math.sin(ang - 0.5))
          ctx.lineTo(x2 - 6 * Math.cos(ang + 0.5), y2 - 6 * Math.sin(ang + 0.5))
          ctx.closePath()
          ctx.fill()
        }
      }

      // ── Concentration meters (bottom-left) ──
      const meterX = 16
      const meterW = 22
      const meterH = Math.min(120, h * 0.32)
      const meterY = h - meterH - 16
      drawMeter(meterX, meterY, meterW, meterH, s.interiorPct, 'In')
      drawMeter(meterX + meterW + 10, meterY, meterW, meterH, s.exteriorPct, 'Out')
      if (Math.abs(s.interiorPct - s.exteriorPct) < 3) {
        ctx.fillStyle = '#2fe08d'
        ctx.font = 'bold 10px system-ui, sans-serif'
        ctx.fillText('EQUILIBRIUM ⚖️', meterX + meterW - 6, meterY - 6)
      }
    }

    function drawMeter(x, y, w, h, pct, label) {
      const p = clamp(pct, 0, 100) / 100
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(x, y, w, h)
      const grad = ctx.createLinearGradient(0, y + h, 0, y)
      grad.addColorStop(0, '#5bb8ff')
      grad.addColorStop(1, '#ff8844')
      ctx.fillStyle = grad
      ctx.fillRect(x, y + h * (1 - p), w, h * p)
      ctx.strokeStyle = 'rgba(226,236,255,0.4)'
      ctx.strokeRect(x, y, w, h)
      ctx.fillStyle = 'rgba(226,236,255,0.75)'
      ctx.font = '9px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.round(pct)}%`, x + w / 2, y - 4)
      ctx.fillText(label, x + w / 2, y + h + 12)
      ctx.textAlign = 'left'
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [stateRef])

  return (
    <div ref={wrapRef} className="lab-canvas-wrap osmosis-canvas-wrap">
      <canvas ref={canvasRef} className="lab-canvas" role="img" aria-label="A living cell under a microscope, bathed in a chosen solution." />
    </div>
  )
}

export default function OsmosisLab({ lab }) {
  const { experiment, setProgress, setSummary } = lab
  const total = experiment?.steps?.length || 4

  const stateRef = useRef({
    solutionId: null,
    scale: 1,
    targetScale: 1,
    cellState: 'normal',
    lysisT: 0,
    frozen: false,
    plant: false,
    interiorPct: 40,
    exteriorPct: 0,
  })

  const [selected, setSelected] = useState('')
  const [plant, setPlant] = useState(false)
  const [tested, setTested] = useState([])
  const testedPlantRef = useRef(new Set())
  const [testedPlant, setTestedPlant] = useState([])
  const autoTimerRef = useRef(0)

  const choose = useCallback(
    (sol) => {
      stateRef.current.solutionId = sol.id
      stateRef.current.targetScale = sol.targetScale
      stateRef.current.frozen = false
      setSelected(sol.id)

      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = setTimeout(() => {
        setTested((prev) => {
          const next = prev.includes(sol.id) ? prev : [...prev, sol.id]
          const plantDone = stateRef.current.plant ? 1 : 0
          setProgress({ completed: Math.min(total, next.length + plantDone), total })
          setSummary({ precisionAchieved: next.length >= 3 })
          return next
        })
        if (stateRef.current.plant) {
          testedPlantRef.current.add(sol.id)
          setTestedPlant([...testedPlantRef.current])
        }
      }, AUTO_COMPLETE_MS)
    },
    [total, setProgress, setSummary],
  )

  const togglePlant = useCallback(() => {
    setPlant((prev) => {
      const next = !prev
      stateRef.current.plant = next
      if (next && stateRef.current.solutionId) {
        clearTimeout(autoTimerRef.current)
        autoTimerRef.current = setTimeout(() => {
          testedPlantRef.current.add(stateRef.current.solutionId)
          setTestedPlant([...testedPlantRef.current])
          setProgress({ completed: Math.min(total, tested.length + 1), total })
        }, AUTO_COMPLETE_MS)
      }
      return next
    })
  }, [tested.length, total, setProgress])

  useEffect(() => () => clearTimeout(autoTimerRef.current), [])

  const reset = () => {
    clearTimeout(autoTimerRef.current)
    stateRef.current = { solutionId: null, scale: 1, targetScale: 1, cellState: 'normal', lysisT: 0, frozen: false, plant: false, interiorPct: 40, exteriorPct: 0 }
    testedPlantRef.current = new Set()
    setTestedPlant([])
    setSelected('')
    setPlant(false)
    setTested([])
    setProgress({ completed: Math.max(0, Math.min(total, 1)), total })
  }

  const currentSol = SOLUTIONS.find((s) => s.id === selected)

  return (
    <div className="sim osmosis-lab">
      <div className="lab-visualization">
        <CellCanvas stateRef={stateRef} />
        <p className="pour-hint">
          {currentSol
            ? `Cell in ${currentSol.name}${plant ? ' (plant cell)' : ''} — watch for about 10 seconds to record the observation.`
            : 'Select a bathing solution below to begin.'}
        </p>
      </div>

      <div className="control-row">
        <button type="button" className={`btn btn-sm ${!plant ? 'btn-primary' : 'btn-outline'}`} onClick={() => plant && togglePlant()}>
          Animal Cell
        </button>
        <button type="button" className={`btn btn-sm ${plant ? 'btn-primary' : 'btn-outline'}`} onClick={() => !plant && togglePlant()}>
          Plant Cell
        </button>
      </div>

      <GoalTracker
        title="Test each solution"
        goals={[
          { label: 'Distilled water — cell swells (hypotonic)', done: tested.includes('distilled') },
          { label: '0.9% Saline — no change (isotonic)', done: tested.includes('saline') },
          { label: '10% Salt — cell shrinks (hypertonic)', done: tested.includes('salt10') },
          { label: 'Repeat with the Plant Cell view', done: testedPlant.length >= 1 },
        ]}
      />

      <h2>Bathing solutions</h2>
      <div className="chemical-panel">
        {SOLUTIONS.map((sol) => (
          <button
            key={sol.id}
            type="button"
            className={`chemical-item ${selected === sol.id ? 'selected' : ''}`}
            onClick={() => choose(sol)}
          >
            <span className="chemical-swatch" style={{ backgroundColor: `rgb(${sol.extColor.r},${sol.extColor.g},${sol.extColor.b})` }} />
            {sol.name}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-outline btn-full btn-sm" onClick={reset}>
        ↺ Fresh cell
      </button>
    </div>
  )
}
