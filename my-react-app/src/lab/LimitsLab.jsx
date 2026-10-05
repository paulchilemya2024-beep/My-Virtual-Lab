import { useEffect, useRef, useState } from 'react'
import {
  makeViewport, sizeCanvas, drawPaneBackground, drawGrid, drawAxes,
  sampleCurve, drawCurve, drawPoint, drawOpenPoint, drawVerticalMarker,
} from '../math/plot.js'
import { bucketIndex, clamp } from '../math/numeric.js'
import { AnimatedNumber, GoalTracker, ResultBadge } from './Instruments.jsx'

// Limits & Continuity Explorer.
//
// Pane 1 is the ordinary full-domain graph. Pane 2 is the SAME function,
// zoomed uniformly (both axes shrink together) onto the point of interest, a.
// That uniform zoom is the whole lesson: zoom into a smooth point and the
// curve flattens into a straight line — an early, concrete look at what
// "differentiable" will mean in the next unit. Zoom into a jump and the gap
// never closes, at any magnification. Zoom into a hole and you find a
// perfectly straight line with one point missing. Zoom into an asymptote and
// the curve simply keeps running off the screen, however far you push in.
//
// Nothing about which "kind" of behaviour a function has is hard-coded. Left
// and right limits are sampled numerically just off the point, the same way
// every other lab in this unit samples numerically rather than symbolically,
// and the continuous / hole / jump / infinite classification is DERIVED from
// those two samples plus the function's own value at the point.

const BUCKETS = 140
const EPS = 1e-4 // how far off `a` left/right samples are taken
// |value| beyond this counts as "diverges". At EPS = 1e-4, the asymptote
// example (1/(x-a)) samples to roughly ±10000 just off the point — this
// threshold sits a full order of magnitude below that and a full order of
// magnitude above every other function's normal range, so the classification
// has real margin on both sides rather than resting on a knife-edge value.
const INF_THRESHOLD = 1000
const CLOSE_FRACTION = 0.03 // how close to `a` counts as "approached" it

const FUNCTIONS = [
  {
    id: 'continuous',
    label: 'x² + 1',
    expr: 'f(x) = x² + 1',
    f: (x) => x * x + 1,
    a: 1,
    domain: [-1, 3],
    range: [-0.5, 11],
    baseHalfX: 1.6,
    baseHalfY: 4,
    realWorld:
      'Most physical quantities you measure directly — position, temperature, pressure — behave like this everywhere: no sudden jumps, no missing values. It is the baseline every other case in this lab breaks from, and the reason engineers can trust a sensor reading without worrying the true value "skipped" somewhere between samples.',
  },
  {
    id: 'hole',
    label: '(x² − 4) / (x − 2)',
    expr: 'f(x) = (x² − 4) ⁄ (x − 2)',
    f: (x) => (Math.abs(x - 2) < 1e-12 ? NaN : (x * x - 4) / (x - 2)),
    a: 2,
    domain: [0, 4],
    range: [-0.5, 7],
    baseHalfX: 1.6,
    baseHalfY: 3,
    realWorld:
      'A formula that looks broken at one exact input, when the quantity it describes is not broken there at all — an average-velocity formula dividing by a time interval that shrinks toward zero is exactly this shape. The "hole" is an artifact of how the formula was written, not a real gap in the underlying physics.',
  },
  {
    id: 'jump',
    label: 'a two-piece step',
    expr: 'f(x) = x  (x<1)   or   x+1  (x≥1)',
    f: (x) => (x < 1 ? x : x + 1),
    a: 1,
    domain: [-1, 3],
    range: [-2, 5],
    baseHalfX: 1.6,
    baseHalfY: 2.4,
    realWorld:
      'A thermostat-controlled heater switching fully on or off, or a tax bracket, or postage priced by weight band — the value genuinely jumps between two regimes with nothing in between. No amount of zooming closes a gap like this, which is exactly what makes it a real discontinuity rather than a rendering artifact.',
  },
  {
    id: 'asymptote',
    label: '1 / (x − 1)',
    expr: 'f(x) = 1 ⁄ (x − 1)',
    f: (x) => 1 / (x - 1),
    a: 1,
    domain: [-2, 4],
    range: [-10, 10],
    baseHalfX: 1.6,
    baseHalfY: 9,
    realWorld:
      'Resistance in a circuit as a component approaches a critical value, or an inverse-square force as distance shrinks toward zero — the model predicts something literally unbounded. That is usually the model telling you, honestly, that it stops describing anything physical right at that point.',
  },
]

const startX = (fn) => fn.a - (fn.domain[1] - fn.domain[0]) * 0.3

const EMPTY_GOALS = {
  scrubbed: false, approachedBoth: false, zoomedIn: false,
  allFourSeen: false, distinctTypesSeen: false, continuousContrast: false,
}

// Classifies a function's behaviour at `a` from three numeric samples — no
// per-function metadata says what "kind" it is; this derives it.
function classify(fn) {
  const left = fn.f(fn.a - EPS)
  const right = fn.f(fn.a + EPS)
  const atA = fn.f(fn.a)
  const leftFinite = Number.isFinite(left) && Math.abs(left) < INF_THRESHOLD
  const rightFinite = Number.isFinite(right) && Math.abs(right) < INF_THRESHOLD
  if (!leftFinite || !rightFinite) return { kind: 'infinite', left, right, atA, limit: NaN }
  if (Math.abs(left - right) > 1e-2) return { kind: 'jump', left, right, atA, limit: NaN }
  const limit = (left + right) / 2
  if (!Number.isFinite(atA) || Math.abs(atA - limit) > 1e-2) return { kind: 'hole', left, right, atA, limit }
  return { kind: 'continuous', left, right, atA, limit }
}

const KIND_LABEL = {
  continuous: 'Continuous at a',
  hole: 'Removable discontinuity — a hole',
  jump: 'Jump discontinuity',
  infinite: 'Infinite discontinuity — an asymptote',
}
const KIND_TONE = { continuous: 'ok', hole: 'warn', jump: 'warn', infinite: 'danger' }

export default function LimitsLab({ lab }) {
  const { experiment, setProgress, setSummary, tutor } = lab
  const total = experiment?.steps?.length || 6

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)

  const [fnId, setFnId] = useState(FUNCTIONS[0].id)
  const fn = FUNCTIONS.find((item) => item.id === fnId) || FUNCTIONS[0]

  // The exact same copy shown in the GoalTracker below — kept in one place so
  // the live tutor's remarks and the on-screen checklist never drift apart.
  // One entry is dynamic (depends on the current function's point of
  // interest), so unlike the other labs this lives inside the component.
  const GOAL_LABELS = {
    scrubbed: 'Drag x across the current function',
    approachedBoth: `Approach a = ${fn.a} from both the left and the right`,
    zoomedIn: 'Zoom in past ×50 on the point of interest',
    allFourSeen: 'Visit all four functions',
    distinctTypesSeen: 'Find at least two different kinds of behaviour',
    continuousContrast: 'Zoom into the smooth function and watch it flatten',
  }

  const [x, setX] = useState(() => startX(FUNCTIONS[0]))
  const [zoomT, setZoomT] = useState(0)

  const [coverage, setCoverage] = useState(0)
  const visitedRef = useRef(new Array(BUCKETS).fill(false))
  const visitedCountRef = useRef(0)
  const approachedLeftRef = useRef(false)
  const approachedRightRef = useRef(false)

  const fnsSeenRef = useRef(new Set())
  const classificationsSeenRef = useRef(new Set())
  const draggingRef = useRef(false)

  const goalsRef = useRef(EMPTY_GOALS)
  const [goals, setGoals] = useState(EMPTY_GOALS)

  const [xMin, xMax] = fn.domain
  const info = classify(fn)

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
    setSummary({ precisionAchieved: merged.distinctTypesSeen && merged.zoomedIn })
  }

  function visitX(nextX) {
    const clamped = clamp(nextX, xMin, xMax)
    setX(clamped)

    const idx = bucketIndex(clamped, xMin, xMax, BUCKETS)
    if (!visitedRef.current[idx]) {
      visitedRef.current[idx] = true
      visitedCountRef.current += 1
      setCoverage(visitedCountRef.current / BUCKETS)
    }

    const tolerance = (xMax - xMin) * CLOSE_FRACTION
    if (clamped < fn.a && fn.a - clamped <= tolerance) approachedLeftRef.current = true
    if (clamped > fn.a && clamped - fn.a <= tolerance) approachedRightRef.current = true
    if (Math.abs(clamped - fn.a) <= tolerance / 4) {
      approachedLeftRef.current = true
      approachedRightRef.current = true
    }

    if (visitedCountRef.current >= 6) fnsSeenRef.current.add(fnId)

    commitGoals({
      scrubbed: visitedCountRef.current >= 6,
      approachedBoth: goalsRef.current.approachedBoth || (approachedLeftRef.current && approachedRightRef.current),
      allFourSeen: fnsSeenRef.current.size >= 4,
    })
  }

  function changeZoom(value) {
    setZoomT(value)
    if (value >= 0.8) {
      classificationsSeenRef.current.add(info.kind)
      commitGoals({
        zoomedIn: true,
        distinctTypesSeen: classificationsSeenRef.current.size >= 2,
        continuousContrast: goalsRef.current.continuousContrast || (fnId === 'continuous'),
      })
    }
  }

  function selectFunction(id) {
    const next = FUNCTIONS.find((item) => item.id === id)
    if (!next || id === fnId) return
    visitedRef.current = new Array(BUCKETS).fill(false)
    visitedCountRef.current = 0
    approachedLeftRef.current = false
    approachedRightRef.current = false
    setCoverage(0)
    setZoomT(0)
    setFnId(id)
    setX(startX(next))
  }

  // --- pointer + keyboard scrubbing ---------------------------------------

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

      // ---- pane 1: the full-domain graph ---------------------------------
      const vpF = makeViewport({ width, height: paneH, xMin, xMax, yMin: fn.range[0], yMax: fn.range[1], pad })
      drawPaneBackground(ctx, vpF, { label: fn.expr })
      drawGrid(ctx, vpF)
      drawAxes(ctx, vpF)
      drawVerticalMarker(ctx, vpF, fn.a, { color: 'rgba(240, 165, 0, 0.4)', dash: [3, 4] })
      drawVerticalMarker(ctx, vpF, x)
      clipCurve(ctx, vpF, () => drawCurve(ctx, vpF, sampleCurve(fn.f, vpF), { color: '#00e5c3', width: 2.4 }))
      const fx = fn.f(x)
      if (Number.isFinite(fx)) drawPoint(ctx, vpF, x, fx, { color: '#ffffff', radius: 5 })

      // the zoom window, drawn as a highlighted rectangle on pane 1 so the
      // connection to pane 2 below is visible rather than implied
      const scale = Math.pow(0.01, zoomT)
      const halfX = fn.baseHalfX * scale
      const halfY = fn.baseHalfY * scale
      const centerY = Number.isFinite(info.limit) ? info.limit : (Number.isFinite(info.atA) ? info.atA : 0)
      ctx.save()
      ctx.strokeStyle = 'rgba(56, 217, 248, 0.7)'
      ctx.lineWidth = 1.4
      ctx.setLineDash([4, 3])
      const zx0 = vpF.sx(clamp(fn.a - halfX, xMin, xMax))
      const zx1 = vpF.sx(clamp(fn.a + halfX, xMin, xMax))
      const zy0 = vpF.sy(clamp(centerY + halfY, fn.range[0], fn.range[1]))
      const zy1 = vpF.sy(clamp(centerY - halfY, fn.range[0], fn.range[1]))
      ctx.strokeRect(Math.min(zx0, zx1), Math.min(zy0, zy1), Math.abs(zx1 - zx0), Math.abs(zy1 - zy0))
      ctx.restore()

      // ---- pane 2: the uniformly zoomed window ---------------------------
      ctx.save()
      ctx.translate(0, paneH + gap)

      const vpZ = makeViewport({
        width, height: paneH,
        xMin: fn.a - halfX, xMax: fn.a + halfX,
        yMin: centerY - halfY, yMax: centerY + halfY,
        pad,
      })
      drawPaneBackground(ctx, vpZ, { label: `zoomed ×${Math.round(1 / scale)} on a = ${fn.a}` })
      drawGrid(ctx, vpZ)
      drawAxes(ctx, vpZ)

      if (info.kind === 'infinite') {
        drawVerticalMarker(ctx, vpZ, fn.a, { color: 'rgba(255, 93, 93, 0.6)', dash: [5, 4], width: 1.6 })
      }
      clipCurve(ctx, vpZ, () => drawCurve(ctx, vpZ, sampleCurve(fn.f, vpZ, 600), { color: '#00e5c3', width: 2.6 }))

      // the open/filled circles showing exactly what the point of interest
      // does and does not include
      if (info.kind === 'hole') {
        drawOpenPoint(ctx, vpZ, fn.a, info.limit, { color: '#f0a500' })
      } else if (info.kind === 'jump') {
        const atAIsLeft = Math.abs(fn.f(fn.a) - info.left) < 1e-2
        drawOpenPoint(ctx, vpZ, fn.a, atAIsLeft ? info.right : info.left, { color: '#f0a500' })
        drawPoint(ctx, vpZ, fn.a, fn.f(fn.a), { color: '#f0a500', radius: 5 })
      } else if (info.kind === 'continuous') {
        drawPoint(ctx, vpZ, fn.a, fn.f(fn.a), { color: '#f0a500', radius: 5 })
      }

      if (Number.isFinite(fx) && Math.abs(fx - centerY) < halfY * 1.3) {
        drawPoint(ctx, vpZ, x, fx, { color: '#ffffff', radius: 4.5, ring: 'rgba(255,255,255,0.18)' })
      }
      ctx.restore()
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  })

  // --- readouts -------------------------------------------------------------

  const leftLabel = Number.isFinite(info.left) ? (Math.abs(info.left) >= INF_THRESHOLD ? (info.left > 0 ? '→ +∞' : '→ −∞') : info.left.toFixed(3)) : '—'
  const rightLabel = Number.isFinite(info.right) ? (Math.abs(info.right) >= INF_THRESHOLD ? (info.right > 0 ? '→ +∞' : '→ −∞') : info.right.toFixed(3)) : '—'
  const atALabel = Number.isFinite(info.atA) ? info.atA.toFixed(3) : 'undefined'

  return (
    <div className="sim math-lab">
      <div className="math-stage">
        <div
          className="math-canvas-wrap"
          ref={wrapRef}
          tabIndex={0}
          role="application"
          aria-label={`Graph of ${fn.expr} with a zoom window centred on x = ${fn.a}. Use the left and right arrow keys to move the point.`}
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
          Drag to move x toward the dashed line at a = {fn.a} from either side — or focus the graph and use ← / →.
          The dashed box on pane 1 is exactly what pane 2 zooms into.
        </p>
      </div>

      <div className="math-panel">
        <div className="sim-readouts">
          <div className="readout-chip">
            <span className="readout-label">left limit — x → a⁻</span>
            <span className="readout-value" style={{ fontSize: '1.05rem' }}>{leftLabel}</span>
          </div>
          <div className="readout-chip">
            <span className="readout-label">right limit — x → a⁺</span>
            <span className="readout-value" style={{ fontSize: '1.05rem' }}>{rightLabel}</span>
          </div>
          <div className="readout-chip">
            <span className="readout-label">f(a) — actually defined?</span>
            <span className="readout-value" style={{ fontSize: '1.05rem' }}>{atALabel}</span>
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
              Zoom on a = {fn.a} — ×<strong>{Math.round(Math.pow(100, zoomT))}</strong>
            </span>
            <input type="range" min="0" max="1" step="0.001" value={zoomT} onChange={(e) => changeZoom(Number(e.target.value))} aria-label="Zoom level" />
            <ResultBadge label={KIND_LABEL[info.kind]} tone={KIND_TONE[info.kind]} />
          </div>

          <div className="math-control-group">
            <span className="math-control-label">x swept</span>
            <div className="math-trace-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(coverage * 100)}%` }} />
            </div>
            <span className="readout-sub">{Math.round(coverage * 100)}% of the domain swept</span>
          </div>

          <div className="math-control-group">
            <span className="math-control-label">x</span>
            <AnimatedNumber className="readout-value" value={x} decimals={3} />
          </div>
        </div>

        <GoalTracker
          title="Find every kind of behaviour"
          goals={[
            { label: GOAL_LABELS.scrubbed, done: goals.scrubbed },
            { label: GOAL_LABELS.approachedBoth, done: goals.approachedBoth },
            { label: GOAL_LABELS.zoomedIn, done: goals.zoomedIn },
            { label: GOAL_LABELS.allFourSeen, done: goals.allFourSeen },
            { label: GOAL_LABELS.distinctTypesSeen, done: goals.distinctTypesSeen },
            { label: GOAL_LABELS.continuousContrast, done: goals.continuousContrast },
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

// Small local helper: clip to a viewport's plot rect while drawing curves, so
// a steep function cannot paint over the axis labels.
function clipCurve(ctx, vp, fn) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(vp.padL, vp.padT, vp.plotW, vp.plotH)
  ctx.clip()
  fn()
  ctx.restore()
}
