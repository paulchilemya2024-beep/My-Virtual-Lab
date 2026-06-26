import { useCallback, useEffect, useRef, useState } from 'react'
import { getChemical, rgbToCss, hexToRgb } from './chemicals.js'
import SoundEngine from './sound.js'
import { AnimatedNumber, ResultBadge, GoalTracker } from './Instruments.jsx'

// Cell osmosis — a genuinely separate biology simulation (no beaker/pour). A model
// cell with a semi-permeable membrane sits in a bathing solution the student
// chooses. Water crosses the membrane toward the higher solute concentration, so
// the cell swells in a hypotonic bath, shrinks (crenates) in a hypertonic one, and
// holds steady when the bath is isotonic. The canvas eases the cell volume toward
// the osmotic equilibrium and animates water particles crossing in the right
// direction.

const CELL_SOLUTE = 0.4 // the cell's own internal concentration (0–1 scale)
const FALLBACK = ['Distilled water', 'Salt solution', 'Sugar solution']

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

// Classify a bath of external concentration `b` relative to the cell.
function classify(b) {
  const eqVolume = clamp(CELL_SOLUTE / Math.max(b, 0.04), 0.42, 1.8)
  if (b < CELL_SOLUTE * 0.85) return { tonicity: 'Hypotonic', dir: 1, factor: eqVolume, note: 'water flows in → the cell swells' }
  if (b > CELL_SOLUTE * 1.15) return { tonicity: 'Hypertonic', dir: -1, factor: eqVolume, note: 'water flows out → the cell shrinks' }
  return { tonicity: 'Isotonic', dir: 0, factor: 1, note: 'no net flow → the cell stays the same' }
}

function OsmosisCanvas({ stateRef, soundRef }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')

    const view = { factor: 1, bath: { r: 232, g: 244, b: 250 }, dir: 0 }
    const drops = []
    let dims = { w: 0, h: 0, dpr: 1 }
    let waveClock = 0

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
    let raf = 0
    let spawnClock = 0

    function ease(dt, tau) {
      return 1 - Math.exp(-dt / tau)
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      waveClock += dt
      const s = stateRef.current
      const { w, h } = dims
      const cx = w / 2
      const cy = h / 2
      const baseR = Math.min(w, h) * 0.2

      view.factor += ease(dt, 0.9) * (s.factor - view.factor)
      view.dir = s.dir
      const tb = s.bath
      const k = ease(dt, 0.7)
      view.bath.r += k * (tb.r - view.bath.r)
      view.bath.g += k * (tb.g - view.bath.g)
      view.bath.b += k * (tb.b - view.bath.b)

      const R = baseR * Math.sqrt(view.factor) // area ∝ volume factor

      // Spawn water particles crossing the membrane in the flow direction.
      if (s.dir !== 0) {
        spawnClock += dt
        const moving = Math.abs(view.factor - s.factor) > 0.01
        const interval = moving ? 0.05 : 0.16
        if (spawnClock > interval && drops.length < 80) {
          spawnClock = 0
          const ang = Math.random() * Math.PI * 2
          const startR = s.dir > 0 ? R + 26 + Math.random() * 20 : R - 6
          drops.push({ ang, r: startR, speed: (24 + Math.random() * 16) * (s.dir > 0 ? -1 : 1), life: 1 })
        }
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        d.r += d.speed * dt
        d.life -= dt * 0.5
        const inner = s.dir > 0 ? R - 14 : 6
        const outer = R + 30
        if (d.life <= 0 || d.r < inner || d.r > outer) drops.splice(i, 1)
      }

      draw(cx, cy, R, baseR)
      raf = requestAnimationFrame(frame)
    }

    function draw(cx, cy, R, baseR) {
      const { w, h } = dims
      ctx.clearRect(0, 0, w, h)

      // ── Bath solution (dish) ──
      const b = view.bath
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, rgbToCss({ r: b.r + 8, g: b.g + 8, b: b.b + 8 }, 1))
      bg.addColorStop(1, rgbToCss(b, 1))
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Dish walls.
      ctx.strokeStyle = 'rgba(20,28,46,0.18)'
      ctx.lineWidth = 3
      ctx.strokeRect(10, 10, w - 20, h - 20)

      // Floating motes in the bath (sense of liquid).
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      for (let i = 0; i < 18; i++) {
        const mx = (i * 53) % (w - 30) + 15
        const my = ((i * 97) % (h - 30)) + 15 + Math.sin(waveClock + i) * 4
        ctx.beginPath()
        ctx.arc(mx, my, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Equilibrium / baseline outline (where the cell started) ──
      ctx.save()
      ctx.setLineDash([4, 5])
      ctx.strokeStyle = 'rgba(20,28,46,0.22)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // ── Water particles crossing the membrane ──
      for (const d of drops) {
        const x = cx + Math.cos(d.ang) * d.r
        const y = cy + Math.sin(d.ang) * d.r
        ctx.fillStyle = `rgba(90,160,220,${Math.max(0, d.life) * 0.8})`
        ctx.beginPath()
        ctx.arc(x, y, 2.4, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── The cell ──
      const crenated = view.factor < 0.7
      const swollen = view.factor > 1.4
      // Cytoplasm fill.
      const cellGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R)
      cellGrad.addColorStop(0, 'rgba(140,210,170,0.95)')
      cellGrad.addColorStop(1, 'rgba(70,170,135,0.95)')
      ctx.fillStyle = cellGrad
      ctx.beginPath()
      if (crenated) {
        // Wavy, shrunken membrane (crenation).
        const lobes = 14
        for (let i = 0; i <= lobes; i++) {
          const a = (i / lobes) * Math.PI * 2
          const wobble = 1 + Math.sin(a * 7 + waveClock * 2) * 0.06
          const rr = R * wobble
          const x = cx + Math.cos(a) * rr
          const y = cy + Math.sin(a) * rr
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      } else {
        ctx.arc(cx, cy, R, 0, Math.PI * 2)
      }
      ctx.closePath()
      ctx.fill()

      // Membrane (double ring).
      ctx.strokeStyle = swollen ? 'rgba(40,130,100,0.9)' : 'rgba(40,120,95,0.85)'
      ctx.lineWidth = swollen ? 2 : 3.5
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, R - 4, 0, Math.PI * 2)
      ctx.stroke()

      // Nucleus.
      ctx.fillStyle = 'rgba(45,110,95,0.85)'
      ctx.beginPath()
      ctx.arc(cx + R * 0.18, cy - R * 0.12, R * 0.26, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(30,80,70,0.9)'
      ctx.beginPath()
      ctx.arc(cx + R * 0.22, cy - R * 0.16, R * 0.1, 0, Math.PI * 2)
      ctx.fill()

      // Highlight sheen.
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.beginPath()
      ctx.ellipse(cx - R * 0.35, cy - R * 0.4, R * 0.28, R * 0.16, -0.6, 0, Math.PI * 2)
      ctx.fill()

      // Lysis warning ring when about to burst.
      if (swollen) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160)
        ctx.strokeStyle = `rgba(225,90,60,${0.4 + pulse * 0.4})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, R + 6, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Flow-direction arrows around the membrane.
      if (view.dir !== 0) {
        ctx.save()
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 2
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + waveClock * 0.3
          const r1 = view.dir > 0 ? R + 22 : R - 2
          const r2 = view.dir > 0 ? R + 6 : R + 18
          const x1 = cx + Math.cos(a) * r1
          const y1 = cy + Math.sin(a) * r1
          const x2 = cx + Math.cos(a) * r2
          const y2 = cy + Math.sin(a) * r2
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          // arrowhead at x2,y2
          const head = 5
          const dirA = Math.atan2(y2 - y1, x2 - x1)
          ctx.beginPath()
          ctx.moveTo(x2, y2)
          ctx.lineTo(x2 - head * Math.cos(dirA - 0.5), y2 - head * Math.sin(dirA - 0.5))
          ctx.lineTo(x2 - head * Math.cos(dirA + 0.5), y2 - head * Math.sin(dirA + 0.5))
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateRef])

  // soundRef kept in the signature for parity with the beaker sims; unused visually.
  void soundRef

  return (
    <div ref={wrapRef} className="lab-canvas-wrap osmosis-canvas-wrap">
      <canvas ref={canvasRef} className="lab-canvas" role="img" aria-label="A model cell in a bathing solution. Choose a solution to see water cross the membrane." />
    </div>
  )
}

export default function OsmosisLab({ lab }) {
  const { experiment, consultTutor, pushMessage, setProgress, setSummary } = lab
  const total = experiment?.steps?.length || 4
  const solutions = experiment?.availableChemicals?.length ? experiment.availableChemicals : FALLBACK

  // Canvas reads from this ref; seeded from a literal (eslint react-hooks/refs).
  const stateRef = useRef({ factor: 1, dir: 0, bath: { r: 232, g: 244, b: 250 } })
  const testedRef = useRef(new Set())
  const soundRef = useRef(null)

  const [selected, setSelected] = useState('')
  const [readout, setReadout] = useState({ tonicity: '—', volumePct: 100, note: 'Pick a bathing solution to begin.' })
  const [tested, setTested] = useState([])

  useEffect(() => {
    soundRef.current = new SoundEngine()
    const engine = soundRef.current
    return () => engine.dispose()
  }, [])

  const choose = useCallback(
    (id) => {
      const chem = getChemical(id)
      const b = chem.tonicity ?? 0
      const result = classify(b)
      const bathRgb = chem.tint || hexToRgb(chem.swatch || '#e8f4ff')

      stateRef.current = { factor: result.factor, dir: result.dir, bath: bathRgb }
      setSelected(id)
      soundRef.current?.resume()
      soundRef.current?.clink()

      testedRef.current.add(result.tonicity)
      const list = [...testedRef.current]
      setTested(list)

      const volumePct = Math.round(result.factor * 100)
      setReadout({ tonicity: result.tonicity, volumePct, note: result.note })

      const completed = Math.min(total, list.length + (list.length >= 3 ? 1 : 0))
      setProgress({ completed, total })
      setSummary({ precisionAchieved: list.length >= 3 })

      pushMessage('student', `I placed the cell in ${chem.name}. It looks ${result.tonicity.toLowerCase()} — ${result.note}.`)
      consultTutor('', `placed the model cell in ${chem.name}; the bath is ${result.tonicity.toLowerCase()} and ${result.note}`, {
        solution: chem.name,
        tonicity: result.tonicity,
        cellVolumePercent: volumePct,
      })
    },
    [total, consultTutor, pushMessage, setProgress, setSummary],
  )

  const reset = () => {
    stateRef.current = { factor: 1, dir: 0, bath: { r: 232, g: 244, b: 250 } }
    testedRef.current = new Set()
    setTested([])
    setSelected('')
    setReadout({ tonicity: '—', volumePct: 100, note: 'Pick a bathing solution to begin.' })
    setProgress({ completed: 0, total })
    pushMessage('tutor', 'Fresh cell ready. Try it in distilled water, a salt solution and a sugar solution, and watch which way water flows each time.')
  }

  const tone = readout.tonicity === 'Hypotonic' ? 'warn' : readout.tonicity === 'Hypertonic' ? 'warn' : readout.tonicity === 'Isotonic' ? 'ok' : 'muted'
  const flowText = flowLabel(readout.tonicity)

  return (
    <div className="sim osmosis-lab">
      <div className="lab-visualization">
        <OsmosisCanvas stateRef={stateRef} soundRef={soundRef} />
        <p className="pour-hint">
          {selected ? `Cell in ${getChemical(selected).name}: ${readout.note}.` : 'Select a bathing solution below to immerse the model cell.'}
        </p>
      </div>

      <div className="sim-readouts">
        <div className="readout-chip">
          <span className="readout-label">Tonicity</span>
          <span className="readout-value" style={{ fontSize: '1.15rem' }}>
            <ResultBadge label={readout.tonicity} tone={tone} />
          </span>
          <span className="readout-sub">{flowText}</span>
        </div>
        <div className="readout-chip">
          <span className="readout-label">Cell volume</span>
          <AnimatedNumber className="readout-value" value={readout.volumePct} decimals={0} suffix=" %" />
          <span className="readout-sub">{readout.volumePct > 140 ? 'risk of bursting (lysis)' : readout.volumePct < 70 ? 'crenated (shrunken)' : 'compared to start'}</span>
        </div>
        <div className="readout-chip">
          <span className="readout-label">Cases seen</span>
          <AnimatedNumber className="readout-value" value={tested.length} decimals={0} suffix=" / 3" />
          <span className="readout-sub">{tested.join(' · ') || 'try all three baths'}</span>
        </div>
      </div>

      <GoalTracker
        title="Predict the water flow"
        goals={[
          { label: 'Hypotonic bath — cell swells', done: tested.includes('Hypotonic') },
          { label: 'Hypertonic bath — cell shrinks', done: tested.includes('Hypertonic') },
          { label: 'Isotonic bath — no net change', done: tested.includes('Isotonic') },
        ]}
      />

      <h2>Bathing solutions</h2>
      <div className="chemical-panel">
        {solutions.map((id) => (
          <button
            key={id}
            type="button"
            className={`chemical-item ${selected === id ? 'selected' : ''}`}
            onClick={() => choose(id)}
            title={getChemical(id).hint}
          >
            <span className="chemical-swatch" style={{ backgroundColor: getChemical(id).swatch }} />
            {getChemical(id).name}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-outline btn-full btn-sm" onClick={reset}>
        ↺ Fresh cell
      </button>
    </div>
  )
}

// Tiny helper so the readout sub-text reads naturally for each tonicity.
function flowLabel(tonicity) {
  if (tonicity === 'Hypotonic') return 'water moving in'
  if (tonicity === 'Hypertonic') return 'water moving out'
  if (tonicity === 'Isotonic') return 'no net water movement'
  return 'awaiting a solution'
}
