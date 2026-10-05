import { useEffect, useRef, useState } from 'react'
import {
  makeViewport, sizeCanvas, drawPaneBackground, drawGrid, drawAxes,
  sampleCurve, drawCurve, drawCurveMasked, drawVerticalMarker,
} from '../math/plot.js'
import { derivative, bucketIndex, clamp } from '../math/numeric.js'
import { AnimatedNumber, GoalTracker, ResultBadge } from './Instruments.jsx'

// Derivative Rules: Product & Chain.
//
// Two self-contained halves, switched with a mode picker like the function
// pickers in the other maths labs. Each half has the same two-pane shape the
// whole unit has settled into: pane 1 is a concrete, un-graphed INTUITION for
// why the rule is true (a growing rectangle; a train of gears), pane 2 is the
// FORMAL PROOF, built the same way every reveal in this unit has been built —
// two independently computed quantities, drawn on top of each other, that
// turn out to always agree.
//
// Neither rule is hard-typed as a formula anywhere in this file. The product
// rule's "w'h + wh'" and the chain rule's "f'(g(x))·g'(x)" are both computed
// by calling derivative() twice and multiplying — the same numerical
// derivative every other lab in this unit uses. The ground truth they are
// checked against is derivative() called ONCE on the opaque combined function.
// If those two independent numeric computations agree, the rule is true — not
// asserted, demonstrated.

const BUCKETS = 140
const SPIN_SCALE = 0.55 // visual-only: how fast a unit rate of change spins a dial

const PRODUCT = {
  w: (x) => x + 1,
  h: (x) => x * x,
  domain: [0, 3],
  derivRange: [-3, 36], // A'(x) = 3x² + 2x over [0, 3]
}

const CHAIN = {
  g: (x) => x * x,
  f: (u) => Math.sin(u),
  domain: [0, 2.6],
  derivRange: [-3.4, 3.4], // y'(x) = cos(x²)·2x over [0, 2.6]
}

const startX = (domain) => domain[0] + (domain[1] - domain[0]) * 0.55

const EMPTY_GOALS = {
  productScrubbed: false, sliverShrunk: false, productVerified: false,
  chainScrubbed: false, chainVerified: false, bothRules: false,
}

// The exact same copy shown in the GoalTracker below — kept in one place so
// the live tutor's remarks and the on-screen checklist never drift apart.
const GOAL_LABELS = {
  productScrubbed: 'Drag x in the Product Rule diagram',
  sliverShrunk: 'Shrink Δx until the corner sliver disappears',
  productVerified: 'Reveal and verify the product rule on the graph',
  chainScrubbed: 'Drag x in the Chain Rule diagram',
  chainVerified: 'Reveal and verify the chain rule on the graph',
  bothRules: 'Confirm both rules in the same session',
}

export default function DerivativeRulesLab({ lab }) {
  const { experiment, setProgress, setSummary, tutor } = lab
  const total = experiment?.steps?.length || 6

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)

  const [mode, setMode] = useState('product')
  const domain = mode === 'product' ? PRODUCT.domain : CHAIN.domain
  const [xProduct, setXProduct] = useState(() => startX(PRODUCT.domain))
  const [xChain, setXChain] = useState(() => startX(CHAIN.domain))
  const x = mode === 'product' ? xProduct : xChain
  const setX = mode === 'product' ? setXProduct : setXChain

  const [dxT, setDxT] = useState(0.3) // slider position for the shrinking Δx in product mode
  const [revealedProduct, setRevealedProduct] = useState(false)
  const [revealedChain, setRevealedChain] = useState(false)
  const revealed = mode === 'product' ? revealedProduct : revealedChain

  const [coverageProduct, setCoverageProduct] = useState(0)
  const [coverageChain, setCoverageChain] = useState(0)
  const coverage = mode === 'product' ? coverageProduct : coverageChain

  const visitedProductRef = useRef(new Array(BUCKETS).fill(false))
  const visitedChainRef = useRef(new Array(BUCKETS).fill(false))
  const countProductRef = useRef(0)
  const countChainRef = useRef(0)
  const revealMovedProductRef = useRef(false)
  const revealMovedChainRef = useRef(false)
  const draggingRef = useRef(false)

  const goalsRef = useRef(EMPTY_GOALS)
  const [goals, setGoals] = useState(EMPTY_GOALS)

  // Live mirrors for the continuous animation loop — mirrored every render
  // (LabCanvas's convention) so the mount-once rAF loop always reads current
  // values without needing to be torn down and restarted.
  const modeRef = useRef(mode)
  const xProductRef = useRef(xProduct)
  const xChainRef = useRef(xChain)
  const dxTRef = useRef(dxT)
  const revealedProductRef = useRef(revealedProduct)
  const revealedChainRef = useRef(revealedChain)

  useEffect(() => {
    modeRef.current = mode
    xProductRef.current = xProduct
    xChainRef.current = xChain
    dxTRef.current = dxT
    revealedProductRef.current = revealedProduct
    revealedChainRef.current = revealedChain
  })

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
    setSummary({ precisionAchieved: merged.productVerified && merged.chainVerified })
  }

  // --- scrubbing x (pointer + keyboard), per mode -------------------------

  function visitX(nextX) {
    const [dMin, dMax] = domain
    const clamped = clamp(nextX, dMin, dMax)
    setX(clamped)

    const visitedRef = mode === 'product' ? visitedProductRef : visitedChainRef
    const countRef = mode === 'product' ? countProductRef : countChainRef
    const setCoverage = mode === 'product' ? setCoverageProduct : setCoverageChain

    const idx = bucketIndex(clamped, dMin, dMax, BUCKETS)
    let frac = countRef.current / BUCKETS
    if (!visitedRef.current[idx]) {
      visitedRef.current[idx] = true
      countRef.current += 1
      frac = countRef.current / BUCKETS
      setCoverage(frac)
    }

    if (mode === 'product') {
      if (revealedProduct) revealMovedProductRef.current = true
      commitGoals({
        productScrubbed: countProductRef.current >= 6,
        productVerified: goalsRef.current.productVerified || revealMovedProductRef.current,
        bothRules: goalsRef.current.bothRules || (goalsRef.current.productScrubbed && goalsRef.current.chainScrubbed) || countProductRef.current >= 6 && goalsRef.current.chainScrubbed,
      })
    } else {
      if (revealedChain) revealMovedChainRef.current = true
      commitGoals({
        chainScrubbed: countChainRef.current >= 6,
        chainVerified: goalsRef.current.chainVerified || revealMovedChainRef.current,
        bothRules: goalsRef.current.bothRules || (goalsRef.current.productScrubbed && countChainRef.current >= 6),
      })
    }
    // traced-coverage goals piggyback on the same sweep but are not part of
    // the 6-goal tracker directly — coverage itself is shown as a progress bar.
    void frac
  }

  function changeDx(value) {
    setDxT(value)
    if (value >= 0.75) commitGoals({ sliverShrunk: true })
  }

  function toggleReveal() {
    if (mode === 'product') {
      setRevealedProduct((prev) => {
        const next = !prev
        if (next) revealMovedProductRef.current = false
        return next
      })
    } else {
      setRevealedChain((prev) => {
        const next = !prev
        if (next) revealMovedChainRef.current = false
        return next
      })
    }
  }

  function selectMode(next) {
    if (next === mode) return
    setMode(next)
  }

  function pointerToX(event) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const px = event.clientX - rect.left
    const [dMin, dMax] = domain
    const vp = makeViewport({ width: rect.width, height: 100, xMin: dMin, xMax: dMax, yMin: 0, yMax: 1 })
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
    const [dMin, dMax] = domain
    const step = (dMax - dMin) / (event.shiftKey ? 400 : 60)
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      visitX(x - step)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      visitX(x + step)
    }
  }

  // --- continuous render loop (mount once; reads only refs) ---------------

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return undefined

    let raf = 0
    let last = performance.now()
    const phase = { input: 0, middle: 0, outer: 0, outerRule: 0 }

    function frame(now) {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now

      const cssW = wrap.clientWidth
      if (cssW < 10) {
        raf = requestAnimationFrame(frame)
        return
      }
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
      // A padding-free viewport spanning the full pane — reuses
      // drawPaneBackground's styling for the metaphor pane without needing a
      // second background-drawing routine.
      const vpMeta = makeViewport({ width, height: paneH, xMin: 0, xMax: 1, yMin: 0, yMax: 1, pad: { left: 0, right: 0, top: 0, bottom: 0 } })

      const curMode = modeRef.current
      const curXProduct = xProductRef.current
      const curXChain = xChainRef.current

      // Advance the gear phases using whatever x is currently active in chain
      // mode. Harmless to compute even while in product mode.
      const gPrime = derivative(CHAIN.g, curXChain)
      const fPrimeAtG = derivative(CHAIN.f, CHAIN.g(curXChain))
      const compositeRate = derivative((t) => CHAIN.f(CHAIN.g(t)), curXChain)
      phase.input = (phase.input + SPIN_SCALE * dt) % (Math.PI * 2)
      phase.middle = (phase.middle + SPIN_SCALE * gPrime * dt) % (Math.PI * 2)
      phase.outer = (phase.outer + SPIN_SCALE * compositeRate * dt) % (Math.PI * 2)
      phase.outerRule = (phase.outerRule + SPIN_SCALE * fPrimeAtG * gPrime * dt) % (Math.PI * 2)

      // ---- pane 1: the intuition -----------------------------------------
      if (curMode === 'product') {
        drawPaneBackground(ctx, vpMeta, { label: 'A growing rectangle — area = width × height' })
        drawProductMetaphor(ctx, width, paneH, curXProduct, dxTRef.current)
      } else {
        drawPaneBackground(ctx, vpMeta, { label: 'A chain of rates — x drives u, u drives y' })
        drawChainMetaphor(ctx, width, paneH, curXChain, phase, revealedChainRef.current)
      }

      // ---- pane 2: the proof ----------------------------------------------
      ctx.save()
      ctx.translate(0, paneH + gap)

      if (curMode === 'product') {
        const [dMin, dMax] = PRODUCT.domain
        const vpD = makeViewport({ width, height: paneH, xMin: dMin, xMax: dMax, yMin: PRODUCT.derivRange[0], yMax: PRODUCT.derivRange[1], pad })
        drawPaneBackground(ctx, vpD, { label: "A′(x)   —   sweep x above to trace it" })
        drawGrid(ctx, vpD)
        drawAxes(ctx, vpD)
        drawVerticalMarker(ctx, vpD, curXProduct)

        const areaFn = (t) => PRODUCT.w(t) * PRODUCT.h(t)
        const groundTruth = (t) => derivative(areaFn, t)
        clipCurve(ctx, vpD, () => {
          drawCurve(ctx, vpD, sampleCurve(groundTruth, vpD), { color: '#8b5cf6', width: 1.6, alpha: 0.16 })
          drawCurveMasked(ctx, vpD, groundTruth, visitedProductRef.current, { color: '#a78bfa', width: 3 })
          if (revealedProductRef.current) {
            const ruleFn = (t) => derivative(PRODUCT.w, t) * PRODUCT.h(t) + PRODUCT.w(t) * derivative(PRODUCT.h, t)
            drawCurveMasked(ctx, vpD, ruleFn, visitedProductRef.current, { color: '#f0a500', width: 2 })
          }
        })
      } else {
        const [dMin, dMax] = CHAIN.domain
        const vpD = makeViewport({ width, height: paneH, xMin: dMin, xMax: dMax, yMin: CHAIN.derivRange[0], yMax: CHAIN.derivRange[1], pad })
        drawPaneBackground(ctx, vpD, { label: "y′(x)   —   sweep x above to trace it" })
        drawGrid(ctx, vpD)
        drawAxes(ctx, vpD)
        drawVerticalMarker(ctx, vpD, curXChain)

        const composite = (t) => CHAIN.f(CHAIN.g(t))
        const groundTruth = (t) => derivative(composite, t)
        clipCurve(ctx, vpD, () => {
          drawCurve(ctx, vpD, sampleCurve(groundTruth, vpD), { color: '#8b5cf6', width: 1.6, alpha: 0.16 })
          drawCurveMasked(ctx, vpD, groundTruth, visitedChainRef.current, { color: '#a78bfa', width: 3 })
          if (revealedChainRef.current) {
            const ruleFn = (t) => derivative(CHAIN.f, CHAIN.g(t)) * derivative(CHAIN.g, t)
            drawCurveMasked(ctx, vpD, ruleFn, visitedChainRef.current, { color: '#f0a500', width: 2 })
          }
        })
      }
      ctx.restore()

      raf = requestAnimationFrame(frame)
    }

    // No ResizeObserver needed: this loop re-measures wrap.clientWidth every
    // single animation frame already (it has to, for the continuous gear
    // spin), so a window resize is simply picked up on the next frame.
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // --- readouts -------------------------------------------------------------

  const productW = PRODUCT.w(xProduct)
  const productH = PRODUCT.h(xProduct)
  const productA = productW * productH

  const chainU = CHAIN.g(xChain)
  const chainY = CHAIN.f(chainU)

  return (
    <div className="sim math-lab">
      <div className="math-stage">
        <div
          className="math-canvas-wrap"
          ref={wrapRef}
          tabIndex={0}
          role="application"
          aria-label="Product rule and chain rule visualiser. Use the left and right arrow keys to move x."
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
          {mode === 'product'
            ? 'Drag anywhere on the diagram to move x — watch the rectangle grow. The derivative graph below fills in as you sweep.'
            : 'Drag anywhere on the diagram to move x — the dials spin at a rate matching the current derivative. The derivative graph below fills in as you sweep.'}
        </p>
      </div>

      <div className="math-panel">
        <div className="math-control-group" role="group" aria-label="Rule">
          <span className="math-control-label">Rule</span>
          <div className="math-fn-picker">
            <button type="button" className={`pill ${mode === 'product' ? 'pill-active' : ''}`} onClick={() => selectMode('product')}>
              Product Rule
            </button>
            <button type="button" className={`pill ${mode === 'chain' ? 'pill-active' : ''}`} onClick={() => selectMode('chain')}>
              Chain Rule
            </button>
          </div>
        </div>

        {mode === 'product' ? (
          <div className="sim-readouts">
            <div className="readout-chip">
              <span className="readout-label">width w(x) = x + 1</span>
              <AnimatedNumber className="readout-value" value={productW} decimals={2} />
            </div>
            <div className="readout-chip">
              <span className="readout-label">height h(x) = x²</span>
              <AnimatedNumber className="readout-value" value={productH} decimals={2} />
            </div>
            <div className="readout-chip">
              <span className="readout-label">area A(x) = w·h</span>
              <AnimatedNumber className="readout-value ph-base" value={productA} decimals={2} />
            </div>
          </div>
        ) : (
          <div className="sim-readouts">
            <div className="readout-chip">
              <span className="readout-label">inner u = g(x) = x²</span>
              <AnimatedNumber className="readout-value" value={chainU} decimals={2} />
            </div>
            <div className="readout-chip">
              <span className="readout-label">outer y = f(u) = sin(u)</span>
              <AnimatedNumber className="readout-value ph-base" value={chainY} decimals={2} />
            </div>
            <div className="readout-chip">
              <span className="readout-label">composite</span>
              <span className="readout-value" style={{ fontSize: '1.05rem' }}>y = sin(x²)</span>
            </div>
          </div>
        )}

        <div className="math-controls">
          {mode === 'product' && (
            <div className="math-control-group">
              <span className="math-control-label">
                Shrink Δx — the slice width = <strong>{(0.4 * (PRODUCT.domain[1] - PRODUCT.domain[0]) * Math.pow(0.03, dxT)).toFixed(3)}</strong>
              </span>
              <input type="range" min="0" max="1" step="0.001" value={dxT} onChange={(e) => changeDx(Number(e.target.value))} aria-label="Shrink delta x" />
              <span className="readout-sub">Watch the corner sliver vanish faster than the two side slivers — that is why it drops out of the rule.</span>
            </div>
          )}

          <div className="math-control-group">
            <span className="math-control-label">The Rule, Verified</span>
            <button type="button" className={`btn btn-sm ${revealed ? 'btn-primary' : 'btn-outline'}`} onClick={toggleReveal}>
              {revealed ? 'Hide the rule overlay' : 'Reveal the rule on the graph'}
            </button>
            <span className="readout-sub">
              {revealed
                ? 'Sweep x again — the gold curve is computed from the rule; it traces exactly over the violet ground truth.'
                : mode === 'product'
                  ? "Shows w′(x)·h(x) + w(x)·h′(x) drawn over the true A′(x)."
                  : "Shows f′(g(x))·g′(x) drawn over the true y′(x)."}
            </span>
          </div>

          <div className="math-control-group">
            <span className="math-control-label">{mode === 'product' ? 'A′(x) traced' : 'y′(x) traced'}</span>
            <div className="math-trace-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(coverage * 100)}%` }} />
            </div>
            <span className="readout-sub">{Math.round(coverage * 100)}% of the range swept</span>
          </div>

          {mode === 'chain' && (
            <div className="math-control-group">
              <ResultBadge
                label={Math.abs(compositeDiff(xChain)) < 1e-3 ? 'needles agree' : 'checking…'}
                tone={Math.abs(compositeDiff(xChain)) < 1e-3 ? 'ok' : 'muted'}
              />
              <span className="readout-sub">The ground-truth and rule-based rotation rates, compared directly.</span>
            </div>
          )}
        </div>

        <GoalTracker
          title="Confirm both rules"
          goals={[
            { label: GOAL_LABELS.productScrubbed, done: goals.productScrubbed },
            { label: GOAL_LABELS.sliverShrunk, done: goals.sliverShrunk },
            { label: GOAL_LABELS.productVerified, done: goals.productVerified },
            { label: GOAL_LABELS.chainScrubbed, done: goals.chainScrubbed },
            { label: GOAL_LABELS.chainVerified, done: goals.chainVerified },
            { label: GOAL_LABELS.bothRules, done: goals.bothRules },
          ]}
        />

        <div className="math-realworld">
          <p className="math-realworld-title">Where this shows up</p>
          <p>
            {mode === 'product'
              ? 'Tolerance stacking: if a manufactured part’s width and height both carry small, independent errors, the error in its AREA is not just the sum of the two — it follows the product rule. Engineers use exactly this to predict how measurement uncertainty compounds.'
              : 'Almost every real system is a chain of smaller systems: a sensor’s reading feeds a controller, which drives a motor, which moves a load. The chain rule is how you find the overall sensitivity of the whole stack — multiply the rate at each stage, the same way the three dials multiply their rates here.'}
          </p>
        </div>
      </div>
    </div>
  )
}

// A cheap live check used only for the chain-mode result badge: the two
// independently computed instantaneous rates, differenced. Not part of the
// render loop — just a tiny readout helper.
function compositeDiff(x) {
  const rule = derivative(CHAIN.f, CHAIN.g(x)) * derivative(CHAIN.g, x)
  const truth = derivative((t) => CHAIN.f(CHAIN.g(t)), x)
  return rule - truth
}

// --- pane 1 drawing: the product-rule rectangle -----------------------------

function drawProductMetaphor(ctx, width, paneH, x, dxT) {
  const [dMin, dMax] = PRODUCT.domain
  const maxW = PRODUCT.w(dMax)
  const maxH = PRODUCT.h(dMax)

  const boxX = width * 0.08
  const boxY = paneH * 0.16
  const boxW = width * 0.46
  const boxH = paneH * 0.7
  const scale = Math.min(boxW / (maxW * 1.3), boxH / (maxH * 1.25))

  const dx = Math.max(0.02, 0.4 * (dMax - dMin) * Math.pow(0.03, dxT))
  const xHi = Math.min(dMax, x + dx)
  const w = PRODUCT.w(x)
  const h = PRODUCT.h(x)
  const dw = PRODUCT.w(xHi) - w
  const dh = PRODUCT.h(xHi) - h

  const baseY = boxY + boxH
  const rectX = boxX
  const rectY = baseY - h * scale
  const rectW = w * scale
  const rectH = h * scale

  ctx.save()
  // main rectangle
  ctx.fillStyle = 'rgba(0, 229, 195, 0.28)'
  ctx.strokeStyle = 'rgba(0, 229, 195, 0.85)'
  ctx.lineWidth = 1.6
  ctx.fillRect(rectX, rectY, rectW, rectH)
  ctx.strokeRect(rectX, rectY, rectW, rectH)

  // right sliver: h · dw
  ctx.fillStyle = 'rgba(56, 217, 248, 0.35)'
  ctx.strokeStyle = 'rgba(56, 217, 248, 0.9)'
  ctx.fillRect(rectX + rectW, rectY, dw * scale, rectH)
  ctx.strokeRect(rectX + rectW, rectY, dw * scale, rectH)

  // top sliver: w · dh
  ctx.fillStyle = 'rgba(240, 165, 0, 0.35)'
  ctx.strokeStyle = 'rgba(240, 165, 0, 0.9)'
  ctx.fillRect(rectX, rectY - dh * scale, rectW, dh * scale)
  ctx.strokeRect(rectX, rectY - dh * scale, rectW, dh * scale)

  // corner: dw · dh — the piece that vanishes
  ctx.fillStyle = 'rgba(139, 92, 246, 0.55)'
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.95)'
  ctx.fillRect(rectX + rectW, rectY - dh * scale, dw * scale, dh * scale)
  ctx.strokeRect(rectX + rectW, rectY - dh * scale, dw * scale, dh * scale)

  // baseline
  ctx.strokeStyle = 'rgba(234, 242, 255, 0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(boxX - 6, baseY)
  ctx.lineTo(boxX + boxW, baseY)
  ctx.stroke()

  // legend
  const legendX = boxX + boxW + width * 0.03
  ctx.fillStyle = 'rgba(234, 242, 255, 0.92)'
  ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const lines = [
    `w = ${w.toFixed(2)}   h = ${h.toFixed(2)}`,
    `A = w·h = ${(w * h).toFixed(3)}`,
    '',
    `h·Δw  ≈ ${(h * dw).toFixed(3)}`,
    `w·Δh  ≈ ${(w * dh).toFixed(3)}`,
    `Δw·Δh ≈ ${(dw * dh).toFixed(4)}  →  0`,
    '',
    `ΔA (actual) ≈ ${(PRODUCT.w(xHi) * PRODUCT.h(xHi) - w * h).toFixed(3)}`,
    `sum of the three slivers ≈ ${(h * dw + w * dh + dw * dh).toFixed(3)}`,
  ]
  lines.forEach((line, i) => ctx.fillText(line, legendX, boxY + i * 16))
  ctx.restore()
}

// --- pane 1 drawing: the chain-rule dial train ------------------------------

function drawDial(ctx, cx, cy, r, phase, { color = '#00e5c3', teeth = 10, label, needles = [] } = {}) {
  ctx.save()
  ctx.fillStyle = 'rgba(234, 242, 255, 0.06)'
  ctx.strokeStyle = 'rgba(234, 242, 255, 0.22)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // teeth: small rectangles around the rim, rotating with the dial so the
  // spin is visible even when the needle itself is hard to track.
  ctx.fillStyle = color
  for (let i = 0; i < teeth; i += 1) {
    const a = phase + (i / teeth) * Math.PI * 2
    const tx = cx + Math.cos(a) * r
    const ty = cy + Math.sin(a) * r
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(a)
    ctx.globalAlpha = 0.8
    ctx.fillRect(-2, -4, 4, 8)
    ctx.restore()
  }

  // needle(s)
  needles.forEach(({ angle, color: needleColor, dash, width = 2.6 }) => {
    ctx.strokeStyle = needleColor
    ctx.lineWidth = width
    if (dash) ctx.setLineDash(dash)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(angle) * r * 0.82, cy + Math.sin(angle) * r * 0.82)
    ctx.stroke()
    ctx.setLineDash([])
  })

  ctx.fillStyle = 'rgba(8, 16, 34, 0.9)'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()

  if (label) {
    ctx.fillStyle = 'rgba(234, 242, 255, 0.85)'
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    label.forEach((line, i) => ctx.fillText(line, cx, cy + r + 8 + i * 14))
  }
  ctx.restore()
}

function drawArrow(ctx, x0, y, x1, label) {
  ctx.save()
  ctx.strokeStyle = 'rgba(234, 242, 255, 0.4)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x1 - 7, y - 4)
  ctx.lineTo(x1 - 7, y + 4)
  ctx.closePath()
  ctx.fillStyle = 'rgba(234, 242, 255, 0.5)'
  ctx.fill()
  if (label) {
    ctx.fillStyle = 'rgba(56, 217, 248, 0.95)'
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(label, (x0 + x1) / 2, y - 8)
  }
  ctx.restore()
}

function drawChainMetaphor(ctx, width, paneH, x, phase, revealed) {
  const r = Math.min(46, paneH * 0.22)
  const cy = paneH * 0.42
  const cx1 = width * 0.16
  const cx2 = width * 0.5
  const cx3 = width * 0.84

  const gPrime = derivative(CHAIN.g, x)
  const fPrimeAtG = derivative(CHAIN.f, CHAIN.g(x))

  drawDial(ctx, cx1, cy, r * 0.8, phase.input, {
    color: '#00e5c3',
    teeth: 8,
    label: ['x — the input', 'spins at a steady pace'],
    needles: [{ angle: phase.input, color: '#00e5c3' }],
  })
  drawArrow(ctx, cx1 + r * 0.8 + 8, cy, cx2 - r - 8, `× g′(x) = ${gPrime.toFixed(2)}`)

  drawDial(ctx, cx2, cy, r, phase.middle, {
    color: '#38d9f8',
    teeth: 10,
    label: ['u = g(x) = x²', `spins ${gPrime.toFixed(2)}× as fast`],
    needles: [{ angle: phase.middle, color: '#38d9f8' }],
  })
  drawArrow(ctx, cx2 + r + 8, cy, cx3 - r * 1.1 - 8, `× f′(u) = ${fPrimeAtG.toFixed(2)}`)

  const outerNeedles = [{ angle: phase.outer, color: '#a78bfa', width: 3 }]
  if (revealed) {
    outerNeedles.push({ angle: phase.outerRule, color: '#f0a500', dash: [4, 4], width: 2 })
  }
  drawDial(ctx, cx3, cy, r * 1.1, phase.outer, {
    color: '#8b5cf6',
    teeth: 12,
    label: ['y = f(g(x)) = sin(x²)', revealed ? 'violet = measured · gold = ruled' : 'the true combined rate'],
    needles: outerNeedles,
  })

  ctx.save()
  ctx.fillStyle = 'rgba(234, 242, 255, 0.55)'
  ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(`x = ${x.toFixed(2)}`, cx1, cy + r + 34)
  ctx.restore()
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
