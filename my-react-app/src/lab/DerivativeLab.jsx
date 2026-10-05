import { useEffect, useRef, useState } from 'react'
import {
  makeViewport, sizeCanvas, drawPaneBackground, drawGrid, drawAxes,
  sampleCurve, drawCurve, drawCurveMasked, drawLineThroughPoint,
  drawPoint, drawVerticalMarker, drawSlopeTriangle,
} from '../math/plot.js'
import { derivative, secantSlope, findStationaryPoints, bucketIndex, clamp } from '../math/numeric.js'
import { AnimatedNumber, GoalTracker, ResultBadge } from './Instruments.jsx'

// Tangent Tracer — the first lab of the calculus unit.
//
// The whole lesson is the vertical alignment between the two panes. The top
// pane shows f with a draggable point and its tangent line; the bottom pane
// shows f', and it DRAWS ITSELF as the student sweeps the point across. The
// moment the derivative graph appears under their finger as a consequence of
// the tangent tilting is the moment "the derivative is a function" stops being
// a sentence and becomes an observation.
//
// The secant line (violet, dashed) sits underneath the tangent with an
// adjustable gap h. Shrinking h collapses the secant onto the tangent, which is
// the definition of the derivative shown as a physical convergence rather than
// as a limit written on a board.

const BUCKETS = 140 // resolution of the "have I swept here yet" mask
const TRACE_TARGET = 0.6 // fraction of the x-range needed to count as traced

// Start the point off-centre so the very first drag does not land the student
// on the parabola's stationary point by accident.
const startX = (fn) => fn.domain[0] + (fn.domain[1] - fn.domain[0]) * 0.62

const EMPTY_GOALS = {
  scrubbed: false, converged: false, traced: false,
  stationary: false, signs: false, secondFn: false,
}

// The exact same copy shown in the GoalTracker below — kept in one place so
// the live tutor's remarks and the on-screen checklist never drift apart.
const GOAL_LABELS = {
  scrubbed: 'Drag the point along the curve',
  converged: 'Shrink h below 0.1 — watch the secant become the tangent',
  traced: `Sweep ${Math.round(TRACE_TARGET * 100)}% of the range to trace f′`,
  stationary: 'Land on a stationary point, where f′(x) = 0',
  signs: 'Visit a rising part (f′ > 0) and a falling part (f′ < 0)',
  secondFn: 'Compare a second function',
}

const FUNCTIONS = [
  {
    id: 'parabola',
    label: 'x²',
    expr: 'f(x) = x²',
    derivExpr: "f'(x) = 2x",
    f: (x) => x * x,
    domain: [-3, 3],
    range: [-1.2, 9.5],
    dRange: [-6.5, 6.5],
    realWorld:
      'A stone dropped from rest falls x² -style: distance grows with the square of time. Its derivative, 2x, is the speed — which is why a fall that lasts twice as long ends twice as fast, not four times.',
  },
  {
    id: 'cubic',
    label: 'x³ − 3x',
    expr: 'f(x) = x³ − 3x',
    derivExpr: "f'(x) = 3x² − 3",
    f: (x) => x * x * x - 3 * x,
    domain: [-2.6, 2.6],
    range: [-4.2, 4.2],
    dRange: [-4, 12],
    realWorld:
      'Bending a loaded beam gives a cubic deflection curve. Engineers differentiate it to find the slope of the beam, and differentiate again to find where the bending stress peaks — the point most likely to fail.',
  },
  {
    id: 'sine',
    label: 'sin x',
    expr: 'f(x) = sin x',
    derivExpr: "f'(x) = cos x",
    f: Math.sin,
    domain: [-6.6, 6.6],
    range: [-1.7, 1.7],
    dRange: [-1.7, 1.7],
    realWorld:
      'Mains electricity is a sine wave. Its derivative is a cosine — the same shape shifted a quarter turn. That quarter-turn shift is exactly why voltage and current fall out of step in circuits with coils and capacitors.',
  },
  {
    id: 'decay',
    label: 'e^(−x/2)',
    expr: 'f(x) = e^(−x/2)',
    derivExpr: "f'(x) = −½·e^(−x/2)",
    f: (x) => Math.exp(-x / 2),
    domain: [0, 8],
    range: [-0.15, 1.2],
    dRange: [-0.62, 0.12],
    realWorld:
      'You have already run this curve. The flask cooling in your titration lab, the bulb dimming in the circuit lab, and a charging capacitor all follow it. Notice that f′ is a scaled copy of f — a quantity whose rate of change is proportional to itself. That single property is what makes this shape appear everywhere in engineering.',
  },
]

export default function DerivativeLab({ lab }) {
  const { experiment, setProgress, setSummary, tutor } = lab
  const total = experiment?.steps?.length || 6

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)

  const [fnId, setFnId] = useState(FUNCTIONS[0].id)
  const fn = FUNCTIONS.find((item) => item.id === fnId) || FUNCTIONS[0]

  const [x, setX] = useState(() => startX(FUNCTIONS[0]))
  const [hT, setHT] = useState(0.35) // slider position; h is derived on a log scale
  const h = 2 * Math.pow(0.001, hT)

  // Stationary points are recomputed on the (rare) function switch rather than
  // on every render — scanning for sign changes in f' is not free.
  const [stationary, setStationary] = useState(() =>
    findStationaryPoints(FUNCTIONS[0].f, FUNCTIONS[0].domain[0], FUNCTIONS[0].domain[1]),
  )

  const [coverage, setCoverage] = useState(0)
  const visitedRef = useRef(new Array(BUCKETS).fill(false))
  const visitedCountRef = useRef(0)

  // Goals persist across function switches, so a student can satisfy the
  // stationary-point goal on the cubic and the rest wherever they like.
  const goalsRef = useRef(EMPTY_GOALS)
  const [goals, setGoals] = useState(EMPTY_GOALS)
  const signsRef = useRef(new Set())
  const fnsSeenRef = useRef(new Set([FUNCTIONS[0].id]))
  const draggingRef = useRef(false)

  const [xMin, xMax] = fn.domain
  const fx = fn.f(x)
  const slope = derivative(fn.f, x)
  const sec = secantSlope(fn.f, x, h)

  // Merges goal updates and only re-renders when something actually flipped,
  // so a continuous drag does not churn state on every pointer sample.
  function commitGoals(next) {
    const merged = { ...goalsRef.current, ...next }
    const changed = Object.keys(merged).some((key) => merged[key] !== goalsRef.current[key])
    if (!changed) return
    // Tell the tutor about any goal that just flipped true — never a goal
    // that was already true, so re-dragging back over one already met
    // doesn't ask twice (useTutor also de-dupes by key as a second guard).
    Object.keys(merged).forEach((key) => {
      if (merged[key] && !goalsRef.current[key]) tutor.notifyGoal(key, GOAL_LABELS[key])
    })
    goalsRef.current = merged
    setGoals(merged)
    const completed = Object.values(merged).filter(Boolean).length
    setProgress({ completed: Math.min(total, completed), total })
    setSummary({ precisionAchieved: merged.converged && merged.stationary })
  }

  // Every scrub marks a bucket and re-evaluates the goals that depend on where
  // the student has been. Goals are checked on every move, not only on newly
  // visited buckets, so returning to a stationary point still counts.
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

    const d = derivative(fn.f, clamped)
    if (Number.isFinite(d)) {
      if (d > 0.05) signsRef.current.add('pos')
      else if (d < -0.05) signsRef.current.add('neg')
    }

    commitGoals({
      scrubbed: visitedCountRef.current >= 6,
      traced: goalsRef.current.traced || frac >= TRACE_TARGET,
      signs: signsRef.current.size >= 2,
      stationary: goalsRef.current.stationary || stationary.some((sp) => Math.abs(sp.x - clamped) < 0.12),
    })
  }

  // Shrinking the secant gap below 0.1 is what "the limit as h -> 0" looks like.
  function changeH(value) {
    setHT(value)
    if (2 * Math.pow(0.001, value) <= 0.1) commitGoals({ converged: true })
  }

  // Switching functions clears the trace mask — a different f means a different
  // f' to uncover — but leaves the earned goals alone.
  function selectFunction(id) {
    const next = FUNCTIONS.find((item) => item.id === id)
    if (!next || id === fnId) return
    fnsSeenRef.current.add(id)
    visitedRef.current = new Array(BUCKETS).fill(false)
    visitedCountRef.current = 0
    setCoverage(0)
    setFnId(id)
    setX(startX(next))
    setStationary(findStationaryPoints(next.f, next.domain[0], next.domain[1]))
    commitGoals({ secondFn: fnsSeenRef.current.size >= 2 })
  }

  // --- pointer + keyboard scrubbing --------------------------------------

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

  // --- rendering ----------------------------------------------------------

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
      const vpD = makeViewport({ width, height: paneH, xMin, xMax, yMin: fn.dRange[0], yMax: fn.dRange[1], pad })

      // ---- top pane: f, tangent, secant --------------------------------
      drawPaneBackground(ctx, vpF, { label: fn.expr })
      drawGrid(ctx, vpF)
      drawAxes(ctx, vpF)
      drawVerticalMarker(ctx, vpF, x)

      clipCurve(ctx, vpF, () => {
        drawCurve(ctx, vpF, sampleCurve(fn.f, vpF), { color: '#00e5c3', width: 2.6 })
      })

      if (Number.isFinite(fx)) {
        // Secant first so the tangent reads on top of it.
        if (Number.isFinite(sec)) {
          drawLineThroughPoint(ctx, vpF, x, fx, sec, { color: '#8b5cf6', width: 1.8, dash: [6, 5], alpha: 0.95 })
          const x2 = x + h
          const y2 = fn.f(x2)
          if (Number.isFinite(y2)) {
            drawPoint(ctx, vpF, x2, y2, { color: '#c4b5fd', radius: 4, ring: null })
          }
        }
        drawSlopeTriangle(ctx, vpF, x, fx, slope, (xMax - xMin) * 0.11)
        drawLineThroughPoint(ctx, vpF, x, fx, slope, { color: '#f0a500', width: 2.4 })
        drawPoint(ctx, vpF, x, fx, { color: '#ffffff', radius: 5.5, label: `(${x.toFixed(2)}, ${fx.toFixed(2)})` })
      }

      // Stationary points, marked so they can be hunted for.
      stationary.forEach((sp) => {
        drawPoint(ctx, vpF, sp.x, sp.y, { color: 'rgba(47, 224, 141, 0.95)', radius: 3.5, ring: 'rgba(47, 224, 141, 0.2)' })
      })

      // ---- bottom pane: f' ---------------------------------------------
      ctx.save()
      ctx.translate(0, paneH + gap)

      drawPaneBackground(ctx, vpD, { label: `${fn.derivExpr}   —   sweep the point above to draw it` })
      drawGrid(ctx, vpD)
      drawAxes(ctx, vpD)
      drawVerticalMarker(ctx, vpD, x)

      const dFn = (v) => derivative(fn.f, v)
      // The full derivative curve, very faint: a hint of what is being uncovered.
      clipCurve(ctx, vpD, () => {
        drawCurve(ctx, vpD, sampleCurve(dFn, vpD), { color: '#8b5cf6', width: 1.6, alpha: 0.16 })
        drawCurveMasked(ctx, vpD, dFn, visitedRef.current, { color: '#a78bfa', width: 3 })
      })

      if (Number.isFinite(slope)) {
        drawPoint(ctx, vpD, x, slope, {
          color: '#f0a500',
          radius: 5.5,
          ring: 'rgba(240, 165, 0, 0.3)',
          label: `f′ = ${slope.toFixed(2)}`,
        })
      }
      ctx.restore()
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  })

  // --- readouts -----------------------------------------------------------

  const trend = slope > 0.05 ? 'increasing' : slope < -0.05 ? 'decreasing' : 'stationary — f′ ≈ 0'
  const gapToTangent = Number.isFinite(sec) && Number.isFinite(slope) ? Math.abs(sec - slope) : NaN

  return (
    <div className="sim math-lab">
      <div className="math-stage">
        <div
          className="math-canvas-wrap"
          ref={wrapRef}
          tabIndex={0}
          role="application"
          aria-label={`Graph of ${fn.expr} with its derivative. Use the left and right arrow keys to move the point.`}
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
          Drag anywhere on the graph to move the point — or focus it and use ← / → (hold Shift for fine steps).
          The derivative graph below fills in as you sweep.
        </p>
      </div>

      <div className="math-panel">
        <div className="sim-readouts">
          <div className="readout-chip">
            <span className="readout-label">x</span>
            <AnimatedNumber className="readout-value" value={x} decimals={2} />
          </div>
          <div className="readout-chip">
            <span className="readout-label">f(x)</span>
            <AnimatedNumber className="readout-value" value={Number.isFinite(fx) ? fx : 0} decimals={2} />
          </div>
          <div className="readout-chip">
            <span className="readout-label">f′(x) — tangent slope</span>
            <AnimatedNumber className="readout-value ph-base" value={Number.isFinite(slope) ? slope : 0} decimals={2} />
            <span className="readout-sub">{trend}</span>
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

          <div className="math-control-group">
            <span className="math-control-label">
              Secant gap h = <strong>{h < 0.01 ? h.toFixed(4) : h.toFixed(3)}</strong>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={hT}
              onChange={(e) => changeH(Number(e.target.value))}
              aria-label="Secant gap h"
            />
            <div className="math-secant-readout">
              <span>
                secant slope <strong>{Number.isFinite(sec) ? sec.toFixed(3) : '—'}</strong>
              </span>
              <span>
                tangent slope <strong>{Number.isFinite(slope) ? slope.toFixed(3) : '—'}</strong>
              </span>
              <ResultBadge
                label={
                  !Number.isFinite(gapToTangent) ? 'no secant'
                    : gapToTangent < 0.01 ? 'secant ≈ tangent'
                      : gapToTangent < 0.1 ? 'closing in'
                        : 'far apart'
                }
                tone={gapToTangent < 0.01 ? 'ok' : gapToTangent < 0.1 ? 'warn' : 'muted'}
              />
            </div>
          </div>

          <div className="math-control-group">
            <span className="math-control-label">Derivative traced</span>
            <div className="math-trace-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(coverage * 100)}%` }} />
            </div>
            <span className="readout-sub">{Math.round(coverage * 100)}% of the range swept</span>
          </div>
        </div>

        <GoalTracker
          title="Build the derivative"
          goals={[
            { label: GOAL_LABELS.scrubbed, done: goals.scrubbed },
            { label: GOAL_LABELS.converged, done: goals.converged },
            { label: GOAL_LABELS.traced, done: goals.traced },
            { label: GOAL_LABELS.stationary, done: goals.stationary },
            { label: GOAL_LABELS.signs, done: goals.signs },
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
