import {
  drawPaneBackground, drawGrid, drawAxes, sampleCurve, drawCurve,
  drawLineThroughPoint, drawPoint, drawRiemannStrips, clipToPlot,
} from '../plot.js'
import { derivative, riemannSum } from '../numeric.js'

// The animated explainer for Riemann sums and the Fundamental Theorem.
//
// Six scenes. The arc mirrors the derivative explainer on purpose: that one
// opened with a car whose SPEED we could not read off a distance graph
// directly, and closed by sweeping a tangent to build a whole new curve. This
// one closes the loop — it brings the same car back, running the process in
// reverse: given the speed, how far did it actually go? The answer is "add up
// a lot of thin rectangles", and the last scene shows that doing so builds
// exactly the distance curve the earlier lesson differentiated in the first
// place. Odometer and speedometer, tied together by one theorem.

const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)))
const lerp = (a, b, t) => a + (b - a) * t

const C = {
  curve: '#00e5c3',
  fill: 'rgba(0, 229, 195, 0.28)',
  stroke: 'rgba(0, 229, 195, 0.75)',
  accent: '#8b5cf6',
  tangent: '#f0a500',
  ink: 'rgba(234, 242, 255, 0.92)',
  cyan: '#38d9f8',
}

function base(ctx, vp, label) {
  drawPaneBackground(ctx, vp, { label })
  drawGrid(ctx, vp)
  drawAxes(ctx, vp)
}

function plot(ctx, vp, f, opts) {
  clipToPlot(ctx, vp, () => drawCurve(ctx, vp, sampleCurve(f, vp), opts))
}

// The same speech-bubble callout used in the derivative explainer, kept
// self-contained here rather than imported — each explainer file owns its own
// small drawing vocabulary, the same way each interactive lab owns its own
// function list instead of sharing one.
function callout(ctx, px, py, lines, { color = C.ink, accent = C.accent, align = 'left', alpha = 1 } = {}) {
  if (alpha <= 0.01) return
  const rows = Array.isArray(lines) ? lines : [lines]
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace'
  const w = Math.max(...rows.map((r) => ctx.measureText(r).width)) + 22
  const h = rows.length * 18 + 14
  const x = align === 'right' ? px - w : px
  ctx.fillStyle = 'rgba(8, 16, 34, 0.92)'
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.5
  const r = 8
  ctx.beginPath()
  ctx.moveTo(x + r, py)
  ctx.arcTo(x + w, py, x + w, py + h, r)
  ctx.arcTo(x + w, py + h, x, py + h, r)
  ctx.arcTo(x, py + h, x, py, r)
  ctx.arcTo(x, py, x + w, py, r)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  rows.forEach((row, i) => ctx.fillText(row, x + 11, py + 9 + i * 18))
  ctx.restore()
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

// The same cartoon car from the derivative explainer, drawn independently so
// this file has no dependency on that one — each explainer stands alone.
function drawCar(ctx, px, py, scale = 1, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(px, py)
  ctx.scale(scale, scale)
  ctx.shadowColor = 'rgba(0, 229, 195, 0.55)'
  ctx.shadowBlur = 14
  ctx.fillStyle = '#00e5c3'
  roundRectPath(ctx, -16, -9, 32, 13, 4)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#5ffbe2'
  roundRectPath(ctx, -9, -16, 17, 9, 3)
  ctx.fill()
  ctx.fillStyle = '#0c162c'
  ctx.beginPath()
  ctx.arc(-9, 5, 4.2, 0, Math.PI * 2)
  ctx.arc(9, 5, 4.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(234, 242, 255, 0.6)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(-9, 5, 4.2, 0, Math.PI * 2)
  ctx.moveTo(13.2, 5)
  ctx.arc(9, 5, 4.2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

// --- the functions the scenes talk about ----------------------------------

const parabola = (x) => x * x
const parabolaArea = (x) => (x * x * x) / 3 // antiderivative, A(0) = 0

const carSpeed = (t) => 0.8 * t // same speed curve the derivative lesson built
const carDistance = (t) => 0.4 * t * t // its exact antiderivative

const PARABOLA_VIEW = { xMin: 0, xMax: 3, yMin: -1.3, yMax: 10.2 }
const PARABOLA_ACC_VIEW = { yMin: -1.3, yMax: 10.2 } // A(3) = 9, conveniently close to f(3) = 9
const CAR_VIEW = { xMin: 0, xMax: 5.4, yMin: -0.6, yMax: 4.6 }
const CAR_ACC_VIEW = { yMin: -1.2, yMax: 11.6 }

const scenes = [
  {
    id: 'question',
    title: 'What is the area under a curved line?',
    duration: 20000,
    narration:
      "A straight edge is easy — a triangle, a rectangle, a formula from school. But this curve has no such shortcut. There is no simple shape whose area you already know that fits exactly underneath it. So what do you do when the exact method does not exist? You approximate — and if you do it carefully, that approximation can be made as exact as you like.",
    view: PARABOLA_VIEW,
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'f(x) = x² — the area from 0 to 3, shaded')
      const reveal = seg(t, 0.15, 0.55)
      clipToPlot(ctx, vp, () => {
        ctx.save()
        ctx.globalAlpha = 0.22 * reveal
        ctx.fillStyle = C.curve
        ctx.beginPath()
        ctx.moveTo(vp.sx(0), vp.sy(0))
        for (let i = 0; i <= 60; i += 1) {
          const x = (3 * i) / 60
          ctx.lineTo(vp.sx(x), vp.sy(parabola(x)))
        }
        ctx.lineTo(vp.sx(3), vp.sy(0))
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      })
      plot(ctx, vp, parabola, { color: C.curve, width: 2.6 })

      const q = seg(t, 0.55, 0.8)
      if (q > 0) callout(ctx, vp.sx(1.1), vp.sy(7.6), ['area = ?', 'no triangle fits this'], { accent: C.cyan, alpha: q })
    },
  },

  {
    id: 'rectangles',
    title: 'Approximate it with rectangles',
    duration: 23000,
    narration:
      "Here is an idea that always works: slice the region into a handful of thin vertical strips and replace each curved top with a flat one. Every strip is now a plain rectangle, and a rectangle's area is just width times height, something you have known since primary school. Add up all four rectangles and you have a number — not the exact area, but a genuine, honest estimate of it. This is called a Riemann sum.",
    view: PARABOLA_VIEW,
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'four rectangles, each width × height')
      plot(ctx, vp, parabola, { color: C.curve, width: 2.4, alpha: 0.5 })

      const n = 4
      const grow = seg(t, 0.1, 0.75)
      const shown = Math.max(0, Math.min(n, Math.floor(grow * (n + 1))))
      if (shown > 0) {
        drawRiemannStrips(ctx, vp, { a: 0, b: (3 * shown) / n, n: shown, method: 'left', heightFn: parabola, fill: C.fill, stroke: C.stroke })
      }

      const label = seg(t, 0.75, 1)
      if (label > 0) {
        const sum = riemannSum(parabola, 0, 3, n, 'left')
        callout(ctx, vp.sx(0.15), vp.sy(8.4), [
          'sum = f(x₀)Δx + f(x₁)Δx + f(x₂)Δx + f(x₃)Δx',
          `n = 4  →  sum ≈ ${sum.toFixed(2)}`,
        ], { accent: C.accent, alpha: label })
      }
    },
  },

  {
    id: 'limit',
    title: 'More rectangles close the gap',
    duration: 26000,
    narration:
      "Four rectangles leave visible gaps above the curve — an honest estimate, but a rough one. Watch what happens as the number of strips climbs. Each rectangle gets thinner, the gaps shrink, and the shaded area hugs the curve more and more tightly. The running sum ticks upward, homing in on a single number. Mathematicians write that limiting value as an integral: the curly S symbol literally means 'the sum, in the limit as the strips become infinitely thin.'",
    view: PARABOLA_VIEW,
    draw(ctx, stage, t) {
      const { vp } = stage
      const grow = seg(t, 0.08, 0.85)
      const n = Math.max(2, Math.round(lerp(4, 60, grow)))
      base(ctx, vp, `n = ${n} rectangles`)
      drawRiemannStrips(ctx, vp, { a: 0, b: 3, n, method: 'left', heightFn: parabola, fill: C.fill, stroke: C.stroke })
      plot(ctx, vp, parabola, { color: C.curve, width: 2.4 })

      const sum = riemannSum(parabola, 0, 3, n, 'left')
      callout(ctx, vp.sx(0.15), vp.sy(8.4), [`n = ${String(n).padStart(2)}   sum ≈ ${sum.toFixed(3)}`], { accent: C.accent })

      const label = seg(t, 0.85, 1)
      if (label > 0) {
        callout(ctx, vp.sx(1.55), vp.sy(2.2), ['∫₀³ x² dx = 9   ( exactly )'], { accent: C.tangent, align: 'left', alpha: label })
      }
    },
  },

  {
    id: 'methods',
    title: 'Where you sample the strip matters',
    duration: 24000,
    narration:
      "There is more than one honest way to draw the flat top. Sample the curve at the LEFT edge of each strip and, on a rising curve, you undershoot every time. Sample the RIGHT edge and you overshoot every time, by about the same amount. Sample the MIDPOINT instead and the two errors very nearly cancel — at the same number of strips, the midpoint rule lands far closer to the truth. Engineers call this the difference between a crude estimate and an efficient one.",
    view: PARABOLA_VIEW,
    draw(ctx, stage, t) {
      const { vp } = stage
      const n = 6
      const methods = ['left', 'right', 'mid']
      const hold = 1 / methods.length
      const idx = Math.min(methods.length - 1, Math.floor(t / hold))
      const method = methods[idx]
      const label = { left: 'LEFT  — undershoots a rising curve', right: 'RIGHT — overshoots a rising curve', mid: 'MIDPOINT — the errors mostly cancel' }[method]

      base(ctx, vp, `same n = ${n}, different sample point`)
      drawRiemannStrips(ctx, vp, { a: 0, b: 3, n, method, heightFn: parabola, fill: C.fill, stroke: C.stroke })
      plot(ctx, vp, parabola, { color: C.curve, width: 2.4 })

      const sum = riemannSum(parabola, 0, 3, n, method)
      const err = Math.abs(sum - 9)
      callout(ctx, vp.sx(0.15), vp.sy(8.8), [label, `sum ≈ ${sum.toFixed(3)}   error ≈ ${err.toFixed(3)}`], {
        accent: method === 'mid' ? '#2fe08d' : C.accent,
      })
    },
  },

  {
    id: 'accumulation',
    title: 'Sweep the endpoint and you get a new function',
    duration: 24000,
    narration:
      "So far the left edge has stayed fixed at zero while the right edge sat at three. But nothing stops that right edge from moving. Let it sweep from left to right, and at every stopping point measure the area collected so far. That running total is itself a function of x — call it A of x, the accumulation function. Watch it build underneath, one swept position at a time, exactly the way the derivative graph built itself in the earlier lesson.",
    view: { ...PARABOLA_VIEW, lower: PARABOLA_ACC_VIEW },
    draw(ctx, stage, t) {
      const { vp, lower } = stage
      const sweep = seg(t, 0.08, 0.9)
      const x = lerp(0.05, 3, sweep)

      base(ctx, vp, 'f(x) = x²')
      drawRiemannStrips(ctx, vp, { a: 0, b: x, n: Math.max(1, Math.round(x * 24)), method: 'mid', heightFn: parabola, fill: C.fill, stroke: C.stroke })
      plot(ctx, vp, parabola, { color: C.curve, width: 2.4 })

      lower((vpA) => {
        base(ctx, vpA, 'A(x) = x³ ⁄ 3 — the running total, collected one sweep at a time')
        clipToPlot(ctx, vpA, () => {
          drawCurve(ctx, vpA, sampleCurve(parabolaArea, { ...vpA, xMax: Math.max(0.001, x) }), { color: C.accent, width: 3 })
        })
        drawPoint(ctx, vpA, x, parabolaArea(x), { color: C.accent, radius: 5.5, ring: 'rgba(139,92,246,0.3)' })
        if (seg(t, 0.85, 1) > 0.3) {
          callout(ctx, vpA.sx(0.3), vpA.sy(9.1), ['A(x) = x³⁄3'], { accent: C.accent, alpha: seg(t, 0.85, 1) })
        }
      })
    },
  },

  {
    id: 'ftc',
    title: 'The odometer and the speedometer',
    duration: 27000,
    narration:
      "Here is the same car from the very first lesson, but now we are told its speed and asked for its distance — the reverse question. Sweep across time and watch the accumulated-distance curve build underneath, strip by strip, just like the parabola did. Now look closely at its slope at any instant: it exactly matches the speed reading above it. That is the Fundamental Theorem of Calculus. Your speedometer shows the rate; your odometer shows the running total; and the odometer's own rate of change is, always, exactly what the speedometer reads.",
    view: { ...CAR_VIEW, lower: CAR_ACC_VIEW },
    draw(ctx, stage, t) {
      const { vp, lower } = stage

      base(ctx, vp, 'speed: f(t) = 0.8t  —  the speedometer')
      const sweep = seg(t, 0.08, 0.85)
      const tNow = lerp(0.1, 5, sweep)
      drawRiemannStrips(ctx, vp, { a: 0, b: tNow, n: Math.max(1, Math.round(tNow * 10)), method: 'mid', heightFn: carSpeed, fill: C.fill, stroke: C.stroke })
      plot(ctx, vp, carSpeed, { color: C.curve, width: 2.4 })
      drawCar(ctx, vp.sx(tNow), vp.sy(carSpeed(tNow)) - 10, 0.8)

      lower((vpA) => {
        base(ctx, vpA, 'distance: A(t) = 0.4t²  —  the odometer')
        clipToPlot(ctx, vpA, () => {
          drawCurve(ctx, vpA, sampleCurve(carDistance, { ...vpA, xMax: Math.max(0.001, tNow) }), { color: C.accent, width: 3 })
        })
        const slope = derivative(carDistance, tNow)
        const reveal = seg(t, 0.78, 1)
        if (reveal > 0) {
          drawLineThroughPoint(ctx, vpA, tNow, carDistance(tNow), slope, { color: C.tangent, width: 2.4, alpha: reveal })
        }
        drawPoint(ctx, vpA, tNow, carDistance(tNow), { color: C.accent, radius: 5.5, ring: 'rgba(139,92,246,0.3)' })
        if (reveal > 0.4) {
          callout(ctx, vpA.sx(0.3), vpA.sy(10.2), [
            `odometer's slope  = ${slope.toFixed(2)}`,
            `speedometer reads = ${carSpeed(tNow).toFixed(2)}`,
            'A′(t) = f(t)',
          ], { accent: C.tangent, alpha: reveal })
        }
      })
    },
  },
]

export const RIEMANN_EXPLAINER = {
  id: 'riemann',
  title: 'Adding up a lot of thin rectangles',
  scenes,
}
