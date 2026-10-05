import { useEffect, useRef, useState } from 'react'
import {
  makeViewport, sizeCanvas, drawPaneBackground, drawGrid, drawAxes,
  sampleCurve, drawCurve, drawCurveMasked, drawVerticalMarker, drawRiemannStrips,
} from '../math/plot.js'
import { riemannSum, derivative, bucketIndex, clamp } from '../math/numeric.js'
import { AnimatedNumber, GoalTracker, ResultBadge } from './Instruments.jsx'

// Riemann Sum → the Fundamental Theorem of Calculus.
//
// Pane 1 shows f(x) with the Riemann strips shaded between a (the domain's
// left edge) and a draggable right endpoint x — exactly the rectangles a
// textbook draws, at whatever n and method the student picks. Pane 2 shows
// the accumulation function A(x) = ∫ₐˣ f(t) dt, and like the derivative lab's
// f' pane, it draws itself as the student sweeps x across.
//
// The payoff is the "Reveal" toggle: it overlays a second curve onto PANE 1 —
// not some pre-written formula, but derivative(A, t) computed numerically from
// the same accumulation function pane 2 is building. Watching that overlay
// land exactly on f(x) *is* the Fundamental Theorem of Calculus, shown as a
// coincidence the student can verify rather than a rule to memorise.

const BUCKETS = 140
const TRACE_TARGET = 0.6
const N_MAX = 60
const METHODS = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'mid', label: 'Midpoint' },
  { id: 'trap', label: 'Trapezoid' },
]

// Start partway in so there is already a visible strip of area to look at.
const startX = (fn) => fn.domain[0] + (fn.domain[1] - fn.domain[0]) * 0.55

const EMPTY_GOALS = {
  scrubbed: false, converged: false, traced: false,
  methodsCompared: false, ftcSeen: false, secondFn: false,
}

// The exact same copy shown in the GoalTracker below — kept in one place so
// the live tutor's remarks and the on-screen checklist never drift apart.
const GOAL_LABELS = {
  scrubbed: 'Drag x to sweep the shaded area',
  converged: 'Raise n until the sum settles on the exact area',
  traced: `Sweep ${Math.round(TRACE_TARGET * 100)}% of the range to trace A(x)`,
  methodsCompared: 'Compare at least two Riemann methods',
  ftcSeen: 'Reveal A′(x) and watch it land on f(x)',
  secondFn: 'Compare a second function',
}

const FUNCTIONS = [
  {
    id: 'ramp',
    label: 'x',
    expr: 'f(x) = x',
    antiderivExpr: 'A(x) = x² ⁄ 2',
    f: (x) => x,
    exactArea: (x) => (x * x) / 2,
    domain: [0, 4],
    range: [-0.5, 4.6],
    aRange: [-0.8, 8.8],
    realWorld:
      "A speed that climbs steadily from zero, like a car accelerating at a constant rate. The area under this velocity graph up to time x is the distance travelled — the reverse of the derivative lab, where differentiating a distance curve gave back a speed. Integration undoes differentiation.",
  },
  {
    id: 'parabola',
    label: 'x²',
    expr: 'f(x) = x²',
    antiderivExpr: 'A(x) = x³ ⁄ 3',
    f: (x) => x * x,
    exactArea: (x) => (x * x * x) / 3,
    domain: [0, 3],
    range: [-1, 9.9],
    aRange: [-1, 9.9],
    realWorld:
      "This is the shape of power delivered by many ramping systems — a motor spinning up, a charging circuit. The area under a power curve up to time x is the total energy delivered: integration is exactly how a rate (watts) becomes a total (joules).",
  },
  {
    id: 'wave',
    label: 'sin x + 1.5',
    expr: 'f(x) = sin(x) + 1.5',
    antiderivExpr: 'A(x) = −cos(x) + 1.5x + 1',
    f: (x) => Math.sin(x) + 1.5,
    exactArea: (x) => -Math.cos(x) + 1.5 * x + 1,
    domain: [0, 2 * Math.PI],
    range: [-0.2, 2.8],
    aRange: [-0.5, 10.2],
    realWorld:
      "A tide height oscillating around a baseline, always flowing in the same direction. The area under the curve up to a given time is the total volume that has passed — the same trick an engineer uses to turn a wavy flow-rate reading into a total.",
  },
  {
    id: 'decay',
    label: 'e^(−x/2)',
    expr: 'f(x) = e^(−x/2)',
    antiderivExpr: 'A(x) = 2 − 2e^(−x/2)',
    f: (x) => Math.exp(-x / 2),
    exactArea: (x) => 2 - 2 * Math.exp(-x / 2),
    domain: [0, 8],
    range: [-0.15, 1.2],
    aRange: [-0.2, 2.3],
    realWorld:
      "You met this curve in the derivative lab as something decaying — a cooling flask, a dimming bulb, a discharging capacitor. Integrating it answers a different question: not \"how fast is it dropping right now\" but \"how much has come out in total so far\" — the total heat lost, the total charge delivered, the total dose absorbed.",
  },
]

export default function RiemannLab({ lab }) {
  const { experiment, setProgress, setSummary, tutor } = lab
  const total = experiment?.steps?.length || 6

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)

  const [fnId, setFnId] = useState(FUNCTIONS[0].id)
  const fn = FUNCTIONS.find((item) => item.id === fnId) || FUNCTIONS[0]
  const a = fn.domain[0]

  const [x, setX] = useState(() => startX(FUNCTIONS[0]))
  const [n, setN] = useState(6)
  const [method, setMethod] = useState('left')
  const [revealed, setRevealed] = useState(false)

  const [coverage, setCoverage] = useState(0)
  const visitedRef = useRef(new Array(BUCKETS).fill(false))
  const visitedCountRef = useRef(0)

  const goalsRef = useRef(EMPTY_GOALS)
  const [goals, setGoals] = useState(EMPTY_GOALS)
  const methodsSeenRef = useRef(new Set(['left']))
  const fnsSeenRef = useRef(new Set([FUNCTIONS[0].id]))
  const revealMovedRef = useRef(false)
  const draggingRef = useRef(false)

  const [xMin, xMax] = fn.domain
  const sum = riemannSum(fn.f, a, x, n, method)
  const exact = fn.exactArea(x) - fn.exactArea(a)
  const fullExact = fn.exactArea(xMax) - fn.exactArea(a)
  const errorAbs = Number.isFinite(sum) && Number.isFinite(exact) ? Math.abs(sum - exact) : NaN

  function commitGoals(next) {
    const merged = { ...goalsRef.current, ...next }
    const changed = Object.keys(merged).some((key) => merged[key] !== goalsRef.current[key])
    if (!changed) return
    Object.keys(merged).forEach((key) => {
      if (merged[key] && !goalsRef.current[key]) tutor.notifyGoal(key, GOAL_LABELS[key])
    })
    goalsRef.current = merged
    setGoals(merged)
    const completed = Object.values(merged).filter(Boolean).length
    setProgress({ completed: Math.min(total, completed), total })
    setSummary({ precisionAchieved: merged.converged && merged.ftcSeen })
  }

  // A Riemann sum counts as "settled" once it is within 3% of the whole
  // range's exact area, on a strip wide enough to mean something — guards
  // against the trivial near-zero agreement right at x = a.
  function checkConverged(nextN, nextMethod, atX) {
    const s = riemannSum(fn.f, a, atX, nextN, nextMethod)
    const e = fn.exactArea(atX) - fn.exactArea(a)
    const tol = Math.max(1e-6, Math.abs(fullExact) * 0.03)
    const wideEnough = atX - a >= (xMax - a) * 0.15
    return wideEnough && Number.isFinite(s) && Math.abs(s - e) <= tol
  }

  function visitX(nextX) {
    const clamped = clamp(nextX, xMin, xMax)
    setX(clamped)

    const idx = bucketIndex(clamped, xMin, xMax, BUCKETS)
    let frac = visitedCountRef.current / BUCKETS
    if (!visitedRef.current[idx]) {
      visitedRef.current[idx] = true
      visitedCountRef.current += 1
      frac = visitedCountRef.current / BUCKETS
      setCoverage(frac)
    }

    if (revealed) revealMovedRef.current = true

    commitGoals({
      scrubbed: visitedCountRef.current >= 6,
      traced: goalsRef.current.traced || frac >= TRACE_TARGET,
      converged: goalsRef.current.converged || checkConverged(n, method, clamped),
      ftcSeen: goalsRef.current.ftcSeen || revealMovedRef.current,
    })
  }

  function changeN(value) {
    setN(value)
    commitGoals({ converged: goalsRef.current.converged || checkConverged(value, method, x) })
  }

  function changeMethod(id) {
    methodsSeenRef.current.add(id)
    setMethod(id)
    commitGoals({
      methodsCompared: methodsSeenRef.current.size >= 2,
      converged: goalsRef.current.converged || checkConverged(n, id, x),
    })
  }

  function toggleReveal() {
    setRevealed((prev) => {
      const next = !prev
      if (next) revealMovedRef.current = false // require a sweep AFTER revealing
      return next
    })
  }

  function selectFunction(id) {
    const next = FUNCTIONS.find((item) => item.id === id)
    if (!next || id === fnId) return
    fnsSeenRef.current.add(id)
    visitedRef.current = new Array(BUCKETS).fill(false)
    visitedCountRef.current = 0
    revealMovedRef.current = false
    setCoverage(0)
    setRevealed(false)
    setFnId(id)
    setX(startX(next))
    commitGoals({ secondFn: fnsSeenRef.current.size >= 2 })
  }

  // --- pointer + keyboard scrubbing (pane 1 only) -------------------------

  function pointerToX(event) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const px = event.clientX - rect.left
    const vp = makeViewport({ width: rect.width, height: 100, xMin, xMax, yMin: 0, yMax: 1 })
    return vp.wx(px)
  }

  function handlePointerDown(event) {
    draggingRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const next = pointerToX(event)
    if (next != null) visitX(next)
  }

  function handlePointerMove(event) {
    if (!draggingRef.current) return
    const next = pointerToX(event)
    if (next != null) visitX(next)
  }

  function handlePointerUp(event) {
    draggingRef.current = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  function handleKeyDown(event) {
    const step = (xMax - xMin) / (event.shiftKey ? 400 : 60)
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      visitX(x - step)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      visitX(x + step)
    }
  }

  // --- rendering ------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return undefined

    function draw() {
      const cssW = wrap.clientWidth
      if (cssW < 10) return
      const cssH = Math.max(400, Math.min(640, cssW * 0.74))
      const { ctx, width, height } = sizeCanvas(canvas, cssW, cssH)

      ctx.clearRect(0, 0, width, height)
      const bg = ctx.createLinearGradient(0, 0, 0, height)
      bg.addColorStop(0, '#0c162c')
      bg.addColorStop(1, '#080f1e')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      const gap = 16
      const paneH = (height - gap) / 2
      const pad = { left: 52, right: 18, top: 18, bottom: 30 }

      const vpF = makeViewport({ width, height: paneH, xMin, xMax, yMin: fn.range[0], yMax: fn.range[1], pad })
      const vpA = makeViewport({ width, height: paneH, xMin, xMax, yMin: fn.aRange[0], yMax: fn.aRange[1], pad })

      // ---- top pane: f(x) + the Riemann strips ---------------------------
      drawPaneBackground(ctx, vpF, { label: `${fn.expr}   —   shaded: the ${method} sum, n = ${n}` })
      drawGrid(ctx, vpF)
      drawAxes(ctx, vpF)
      drawVerticalMarker(ctx, vpF, x)

      drawRiemannStrips(ctx, vpF, { a, b: x, n, method, heightFn: fn.f })

      clipCurve(ctx, vpF, () => {
        drawCurve(ctx, vpF, sampleCurve(fn.f, vpF), { color: '#00e5c3', width: 2.6 })
        // The FTC overlay: A'(t) computed numerically from the SAME accumulation
        // function pane 2 draws, not from a hand-typed derivative formula — so
        // this really is the two sides of the theorem landing on each other.
        if (revealed) {
          const aPrime = (t) => derivative(fn.exactArea, t)
          drawCurveMasked(ctx, vpF, aPrime, visitedRef.current, { color: '#8b5cf6', width: 2 })
        }
      })

      // ---- bottom pane: A(x), drawing itself as x sweeps -----------------
      ctx.save()
      ctx.translate(0, paneH + gap)

      drawPaneBackground(ctx, vpA, { label: `${fn.antiderivExpr}   —   sweep x above to build it` })
      drawGrid(ctx, vpA)
      drawAxes(ctx, vpA)
      drawVerticalMarker(ctx, vpA, x)

      const accFn = (t) => fn.exactArea(t) - fn.exactArea(a)
      clipCurve(ctx, vpA, () => {
        drawCurve(ctx, vpA, sampleCurve(accFn, vpA), { color: '#8b5cf6', width: 1.6, alpha: 0.16 })
        drawCurveMasked(ctx, vpA, accFn, visitedRef.current, { color: '#a78bfa', width: 3 })
      })
      ctx.restore()
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  })

  // --- readouts -------------------------------------------------------------

  const converganceLabel = !Number.isFinite(errorAbs) ? '—'
    : errorAbs <= Math.max(1e-6, Math.abs(fullExact) * 0.01) ? 'matches the exact area'
      : errorAbs <= Math.abs(fullExact) * 0.05 ? 'closing in'
        : 'still rough'
  const convergenceTone = !Number.isFinite(errorAbs) ? 'muted'
    : errorAbs <= Math.abs(fullExact) * 0.01 ? 'ok'
      : errorAbs <= Math.abs(fullExact) * 0.05 ? 'warn'
        : 'muted'

  return (
    <div className="sim math-lab">
      <div className="math-stage">
        <div
          className="math-canvas-wrap"
          ref={wrapRef}
          tabIndex={0}
          role="application"
          aria-label={`Graph of ${fn.expr} with its Riemann sum and accumulation function. Use the left and right arrow keys to move the endpoint.`}
          onKeyDown={handleKeyDown}
        >
          <canvas
            ref={canvasRef}
            className="math-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>
        <p className="sim-hint">
          Drag anywhere on the graph to move the right-hand endpoint — or focus it and use ← / → (hold Shift for fine steps).
          The accumulation graph below fills in as you sweep.
        </p>
      </div>

      <div className="math-panel">
        <div className="sim-readouts">
          <div className="readout-chip">
            <span className="readout-label">x</span>
            <AnimatedNumber className="readout-value" value={x} decimals={2} />
          </div>
          <div className="readout-chip">
            <span className="readout-label">Riemann sum</span>
            <AnimatedNumber className="readout-value" value={Number.isFinite(sum) ? sum : 0} decimals={3} />
          </div>
          <div className="readout-chip">
            <span className="readout-label">Exact area — A(x)</span>
            <AnimatedNumber className="readout-value ph-base" value={Number.isFinite(exact) ? exact : 0} decimals={3} />
          </div>
        </div>

        <div className="math-controls">
          <div className="math-control-group" role="group" aria-label="Function">
            <span className="math-control-label">Function</span>
            <div className="math-fn-picker">
              {FUNCTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`pill ${item.id === fnId ? 'pill-active' : ''}`}
                  onClick={() => selectFunction(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="math-control-group" role="group" aria-label="Method">
            <span className="math-control-label">Method</span>
            <div className="math-fn-picker">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`pill ${m.id === method ? 'pill-active' : ''}`}
                  onClick={() => changeMethod(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="math-control-group">
            <span className="math-control-label">
              Strips n = <strong>{n}</strong>
            </span>
            <input
              type="range"
              min="1"
              max={N_MAX}
              step="1"
              value={n}
              onChange={(e) => changeN(Number(e.target.value))}
              aria-label="Number of strips"
            />
            <div className="math-secant-readout">
              <span>
                sum <strong>{Number.isFinite(sum) ? sum.toFixed(3) : '—'}</strong>
              </span>
              <span>
                exact <strong>{Number.isFinite(exact) ? exact.toFixed(3) : '—'}</strong>
              </span>
              <ResultBadge label={converganceLabel} tone={convergenceTone} />
            </div>
          </div>

          <div className="math-control-group">
            <span className="math-control-label">Accumulation traced</span>
            <div className="math-trace-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(coverage * 100)}%` }} />
            </div>
            <span className="readout-sub">{Math.round(coverage * 100)}% of the range swept</span>
          </div>

          <div className="math-control-group">
            <span className="math-control-label">The Fundamental Theorem</span>
            <button type="button" className={`btn btn-sm ${revealed ? 'btn-primary' : 'btn-outline'}`} onClick={toggleReveal}>
              {revealed ? 'Hide A′(x) overlay' : 'Reveal A′(x) on f(x)'}
            </button>
            <span className="readout-sub">
              {revealed ? 'Sweep x again — the violet curve is A′(x), traced live.' : 'Shows the derivative of the area graph drawn over f itself.'}
            </span>
          </div>
        </div>

        <GoalTracker
          title="Build the integral"
          goals={[
            { label: GOAL_LABELS.scrubbed, done: goals.scrubbed },
            { label: GOAL_LABELS.converged, done: goals.converged },
            { label: GOAL_LABELS.traced, done: goals.traced },
            { label: GOAL_LABELS.methodsCompared, done: goals.methodsCompared },
            { label: GOAL_LABELS.ftcSeen, done: goals.ftcSeen },
            { label: GOAL_LABELS.secondFn, done: goals.secondFn },
          ]}
        />

        <div className="math-realworld">
          <p className="math-realworld-title">Where this shows up</p>
          <p>{fn.realWorld}</p>
        </div>
      </div>
    </div>
  )
}

// Small local helper: clip to a viewport's plot rect while drawing curves, so a
// steep function cannot paint over the axis labels.
function clipCurve(ctx, vp, fn) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(vp.padL, vp.padT, vp.plotW, vp.plotH)
  ctx.clip()
  fn()
  ctx.restore()
}
