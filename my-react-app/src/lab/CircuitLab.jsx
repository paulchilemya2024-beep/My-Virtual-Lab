import { useCallback, useEffect, useRef, useState } from 'react'

// ── Test materials ───────────────────────────────────────────────────────────
// `conductivity` 0..1 drives how brightly the bulb glows (metals bright, graphite
// dim, saltwater medium, insulators off). `result` is the label shown to the
// student. The science explanations are kept short for the sidebar.
const MATERIALS = [
  { id: 'copper', name: 'Copper wire', emoji: '🟠', conductivity: 1, result: 'Conductor',
    why: 'A metal with a sea of free electrons — exactly why copper is used for real wiring.' },
  { id: 'iron', name: 'Iron nail', emoji: '🔩', conductivity: 0.85, result: 'Conductor',
    why: 'Iron is a metal, so its free electrons let current flow easily.' },
  { id: 'aluminium', name: 'Aluminium foil', emoji: '🟦', conductivity: 0.9, result: 'Conductor',
    why: 'Another metal — light, cheap and conductive, used in power lines.' },
  { id: 'steel', name: 'Steel spoon', emoji: '🥄', conductivity: 0.8, result: 'Conductor',
    why: 'Steel is mostly iron, so it conducts like other metals.' },
  { id: 'graphite', name: 'Pencil graphite', emoji: '✏️', conductivity: 0.35, result: 'Conductor (poor)',
    why: 'Graphite is carbon with some free electrons — it conducts, but with high resistance, so the bulb is dim.' },
  { id: 'saltwater', name: 'Saltwater', emoji: '🧂', conductivity: 0.5, result: 'Conductor',
    why: 'Dissolved salt makes ions that carry charge through the water.' },
  { id: 'distilled', name: 'Distilled water', emoji: '💧', conductivity: 0.04, result: 'Insulator',
    why: 'Pure water has almost no ions, so it barely conducts at all.' },
  { id: 'wood', name: 'Wooden stick', emoji: '🪵', conductivity: 0, result: 'Insulator',
    why: 'Dry wood has no free charges to move, so no current flows.' },
  { id: 'rubber', name: 'Rubber eraser', emoji: '🧽', conductivity: 0, result: 'Insulator',
    why: 'Rubber traps its electrons — that is why it coats wires and tools for safety.' },
  { id: 'plastic', name: 'Plastic ruler', emoji: '📏', conductivity: 0, result: 'Insulator',
    why: 'Plastic is a polymer insulator with no free electrons.' },
]

const COMPLETE_AT = 6

export default function CircuitLab({ lab }) {
  const { consultTutor, pushMessage, setProgress, setSummary } = lab

  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [placed, setPlaced] = useState(null) // material id currently in the gap
  const [tested, setTested] = useState([]) // [{...material}] in test order
  const [dragging, setDragging] = useState(null) // { id, x, y }

  const placedRef = useRef(null)
  const brightnessTargetRef = useRef(0)
  const congratulatedRef = useRef(false)

  const placeMaterial = useCallback(
    (id) => {
      const mat = MATERIALS.find((m) => m.id === id)
      if (!mat) return
      setPlaced(id)
      placedRef.current = mat
      brightnessTargetRef.current = mat.conductivity
      const conductive = mat.conductivity > 0.05

      const already = tested.some((m) => m.id === id)
      const count = already ? tested.length : tested.length + 1
      if (!already) setTested((prev) => [...prev, mat])

      setProgress({ completed: Math.min(count, COMPLETE_AT), total: COMPLETE_AT })
      if (count >= COMPLETE_AT && !congratulatedRef.current) {
        congratulatedRef.current = true
        setSummary({ precisionAchieved: true })
        pushMessage('tutor', `Great — you've tested ${count} materials! You can see the pattern: metals conduct, and most non-metals don't. Submit your results when you're ready.`)
      }

      pushMessage('student', `I placed the ${mat.name.toLowerCase()} in the gap.`)
      consultTutor('', `tested "${mat.name}" — it is a ${mat.result.toLowerCase()} (the bulb ${conductive ? 'lit up' : 'stayed off'})`, {
        materialTested: mat.name,
        result: mat.result,
        conducts: conductive,
        materialsTested: count,
      })
    },
    [consultTutor, pushMessage, setProgress, setSummary, tested],
  )

  // ── Drag-and-drop (pointer events → works with mouse and touch) ──
  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => setDragging((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
    const onUp = (e) => {
      const canvas = canvasRef.current
      let dropped = false
      if (canvas) {
        const r = canvas.getBoundingClientRect()
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        // A near-stationary release (a tap) also counts as "place it".
        const moved = Math.hypot(e.clientX - dragging.startX, e.clientY - dragging.startY)
        if (inside || moved < 8) {
          placeMaterial(dragging.id)
          dropped = true
        }
      }
      void dropped
      setDragging(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, placeMaterial])

  function startDrag(e, id) {
    e.preventDefault()
    setDragging({ id, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY })
  }

  // ── Canvas animation loop ──
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    let brightness = 0
    let flow = 0
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
      brightness += (1 - Math.exp(-dt / 0.35)) * (brightnessTargetRef.current - brightness)
      flow += dt * (0.6 + brightness * 2)
      draw(brightness, flow)
      raf = requestAnimationFrame(frame)
    }

    function draw(bright, flowPhase) {
      const { w, h } = dims
      ctx.clearRect(0, 0, w, h)
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, '#eef3f8')
      bg.addColorStop(1, '#e3eaf1')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      const m = 46
      const x1 = m
      const x2 = w - m
      const y1 = m + 6
      const y2 = h - m
      const cx = (x1 + x2) / 2
      const bulbX = cx
      const bulbY = y1
      const gapX = cx
      const gapY = y2
      const gapHalf = Math.min(46, (x2 - x1) * 0.12)
      const batX = x1
      const batY = (y1 + y2) / 2
      const conductive = bright > 0.04

      // ── Wires (drawn as segments leaving room for components) ──
      ctx.lineWidth = 4
      ctx.strokeStyle = conductive ? '#1f6feb' : 'rgba(20,28,46,0.5)'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      // top wire: bulb→right→down→gap right end
      ctx.moveTo(bulbX + 26, y1)
      ctx.lineTo(x2, y1)
      ctx.lineTo(x2, y2)
      ctx.lineTo(gapX + gapHalf, y2)
      // gap left end → bottom-left → up → battery bottom
      ctx.moveTo(gapX - gapHalf, y2)
      ctx.lineTo(x1, y2)
      ctx.lineTo(x1, batY + 22)
      // battery top → up → top-left → bulb left
      ctx.moveTo(x1, batY - 22)
      ctx.lineTo(x1, y1)
      ctx.lineTo(bulbX - 26, y1)
      ctx.stroke()

      // ── Moving electrons when current flows ──
      if (conductive) {
        drawElectrons(x1, x2, y1, y2, batX, batY, bulbX, gapX, gapHalf, flowPhase, bright)
      }

      // ── Battery ──
      ctx.save()
      ctx.translate(batX, batY)
      ctx.fillStyle = '#0A0F1E'
      ctx.fillRect(-9, -22, 18, 12) // long terminal block
      ctx.fillRect(-5, 10, 10, 12)
      ctx.lineWidth = 4
      ctx.strokeStyle = '#0A0F1E'
      ctx.beginPath(); ctx.moveTo(-16, -10); ctx.lineTo(16, -10); ctx.stroke() // + plate (long)
      ctx.beginPath(); ctx.moveTo(-9, 10); ctx.lineTo(9, 10); ctx.stroke() // - plate (short)
      ctx.fillStyle = 'rgba(20,28,46,0.6)'
      ctx.font = 'bold 14px ui-monospace, monospace'
      ctx.fillText('+', -28, -6)
      ctx.fillText('–', -26, 18)
      ctx.restore()

      // ── Bulb ──
      drawBulb(bulbX, bulbY, bright)

      // ── Gap / test zone ──
      drawGap(gapX, gapY, gapHalf, conductive)
    }

    function drawElectrons(x1, x2, y1, y2, batX, batY, bulbX, gapX, gapHalf, phase, bright) {
      // Build the conducting path as a polyline and march dots along it.
      const path = [
        [batX, batY - 22], [x1, y1], [bulbX - 26, y1],
        [bulbX + 26, y1], [x2, y1], [x2, y2],
        [gapX + gapHalf, y2], [gapX - gapHalf, y2], [x1, y2], [batX, batY + 22],
      ]
      const segs = []
      let totalLen = 0
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i]
        const b = path[i + 1]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        segs.push({ a, b, len, start: totalLen })
        totalLen += len
      }
      ctx.fillStyle = `rgba(255, 213, 79, ${0.5 + bright * 0.5})`
      const n = 22
      for (let k = 0; k < n; k++) {
        let d = ((phase * 90 + (k / n) * totalLen) % totalLen)
        const seg = segs.find((s) => d >= s.start && d < s.start + s.len) || segs[0]
        const t = (d - seg.start) / seg.len
        const px = seg.a[0] + (seg.b[0] - seg.a[0]) * t
        const py = seg.a[1] + (seg.b[1] - seg.a[1]) * t
        ctx.beginPath()
        ctx.arc(px, py, 2.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawBulb(x, y, bright) {
      ctx.save()
      if (bright > 0.04) {
        const glow = ctx.createRadialGradient(x, y, 4, x, y, 70 * (0.5 + bright))
        glow.addColorStop(0, `rgba(255, 220, 120, ${0.9 * bright})`)
        glow.addColorStop(1, 'rgba(255, 220, 120, 0)')
        ctx.fillStyle = glow
        ctx.beginPath(); ctx.arc(x, y, 70 * (0.5 + bright), 0, Math.PI * 2); ctx.fill()
      }
      // Glass
      ctx.beginPath()
      ctx.arc(x, y, 20, 0, Math.PI * 2)
      ctx.fillStyle = bright > 0.04
        ? `rgb(${255},${230 - 40 * (1 - bright)},${120 + 60 * bright})`
        : 'rgba(255,255,255,0.85)'
      ctx.fill()
      ctx.lineWidth = 2.5
      ctx.strokeStyle = 'rgba(20,28,46,0.55)'
      ctx.stroke()
      // Filament
      ctx.strokeStyle = bright > 0.04 ? '#ff8a00' : 'rgba(20,28,46,0.4)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x - 8, y + 6)
      ctx.lineTo(x - 3, y - 4)
      ctx.lineTo(x + 2, y + 4)
      ctx.lineTo(x + 7, y - 5)
      ctx.stroke()
      // Base
      ctx.fillStyle = 'rgba(20,28,46,0.7)'
      ctx.fillRect(x - 9, y + 18, 18, 8)
      ctx.restore()
    }

    function drawGap(x, y, half, conductive) {
      // Wire stubs into the gap
      ctx.strokeStyle = conductive ? '#1f6feb' : 'rgba(20,28,46,0.5)'
      ctx.lineWidth = 4
      // terminals (little balls)
      ctx.fillStyle = 'rgba(20,28,46,0.65)'
      ctx.beginPath(); ctx.arc(x - half, y, 5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(x + half, y, 5, 0, Math.PI * 2); ctx.fill()

      const mat = placedRef.current
      if (mat) {
        // Draw the placed material bridging the gap.
        ctx.save()
        ctx.fillStyle = conductive ? '#caa46a' : '#9aa3af'
        ctx.strokeStyle = 'rgba(20,28,46,0.5)'
        ctx.lineWidth = 2
        const w = half * 2 + 10
        ctx.beginPath()
        ctx.roundRect(x - w / 2, y - 12, w, 24, 6)
        ctx.fill()
        ctx.stroke()
        ctx.font = '16px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(mat.emoji, x, y)
        ctx.restore()
        ctx.textAlign = 'start'
        ctx.textBaseline = 'alphabetic'
        // Insulator → red X near the bulb path
        if (!conductive) {
          ctx.strokeStyle = '#e23b2a'
          ctx.lineWidth = 4
          const ex = x
          const ey = y - 34
          ctx.beginPath(); ctx.moveTo(ex - 9, ey - 9); ctx.lineTo(ex + 9, ey + 9); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(ex + 9, ey - 9); ctx.lineTo(ex - 9, ey + 9); ctx.stroke()
        }
      } else {
        // Empty gap hint
        ctx.fillStyle = 'rgba(20,28,46,0.45)'
        ctx.font = '12px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillText('drop a material here', x, y + 30)
        ctx.textAlign = 'start'
      }
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="sim circuit-lab">
      <div ref={wrapRef} className="lab-canvas-wrap circuit-canvas-wrap">
        <canvas ref={canvasRef} className="lab-canvas" role="img" aria-label="Electric circuit with a battery, bulb and a gap to test materials." />
      </div>
      <p className="pour-hint">Drag a material onto the circuit gap (or tap it) to test whether it conducts.</p>

      <h2>Test materials</h2>
      <div className="material-tray">
        {MATERIALS.map((mat) => {
          const done = tested.some((t) => t.id === mat.id)
          return (
            <button
              key={mat.id}
              type="button"
              className={`material-chip ${placed === mat.id ? 'active' : ''} ${done ? 'done' : ''}`}
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => startDrag(e, mat.id)}
              title={mat.name}
            >
              <span className="material-emoji" aria-hidden="true">{mat.emoji}</span>
              {mat.name}
              {done && <span className="material-check" aria-hidden="true">✓</span>}
            </button>
          )
        })}
      </div>

      {placed && (() => {
        const mat = MATERIALS.find((m) => m.id === placed)
        const conductive = mat.conductivity > 0.05
        return (
          <div className={`result-panel ${conductive ? 'is-conductor' : 'is-insulator'}`}>
            <div className="result-panel-head">
              <strong>{mat.name}</strong>
              <span className={`result-badge ${conductive ? 'badge-on' : 'badge-off'}`}>{mat.result}</span>
            </div>
            <p>{mat.why}</p>
          </div>
        )
      })()}

      <h2>Results</h2>
      <div className="results-table">
        <div className="results-row results-head">
          <span>Material</span><span>Result</span><span>Why</span>
        </div>
        {tested.length === 0 && <p className="text-muted results-empty">No materials tested yet — drop one into the gap.</p>}
        {tested.map((mat) => {
          const conductive = mat.conductivity > 0.05
          return (
            <div key={mat.id} className="results-row">
              <span>{mat.emoji} {mat.name}</span>
              <span className={conductive ? 'ph-base' : 'ph-acid'}>{mat.result}</span>
              <span className="results-why">{mat.why}</span>
            </div>
          )
        })}
      </div>

      {dragging && (
        <div className="drag-ghost" style={{ left: dragging.x, top: dragging.y }}>
          {MATERIALS.find((m) => m.id === dragging.id)?.emoji}
        </div>
      )}
    </div>
  )
}
