import {
  drawPaneBackground, drawGrid, drawAxes, sampleCurve, drawCurve,
  drawLineThroughPoint, drawPoint, clipToPlot,
} from '../plot.js'
import { derivative } from '../numeric.js'

// The animated explainer for the derivative.
//
// Six scenes, drawn live rather than streamed as video. Each scene owns its
// viewport, its animation, and the sentence the narrator says over it. The
// arc is deliberate: start with a question the student already cares about
// (how fast am I going *right now*), build the one thing they can actually
// measure (a secant), shrink it until it becomes the thing they cannot
// (a tangent), then show that doing this everywhere produces a whole new
// curve — and finish by pointing at a shape they have already met in their
// chemistry and physics labs.

// --- tiny timing + drawing helpers ----------------------------------------

// Maps the scene's global progress t onto a 0..1 sub-window, so one scene can
// run several beats in sequence.
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)))
const lerp = (a, b, t) => a + (b - a) * t

const C = {
  curve: '#00e5c3',
  tangent: '#f0a500',
  secant: '#8b5cf6',
  ink: 'rgba(234, 242, 255, 0.92)',
  dim: 'rgba(234, 242, 255, 0.55)',
  good: '#2fe08d',
  bad: '#ff5d5d',
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

// A rounded callout box anchored at a screen point — the cartoon speech-bubble
// that carries the number being talked about.
function callout(ctx, px, py, lines, { color = C.ink, accent = C.tangent, align = 'left', alpha = 1 } = {}) {
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

// Rounded rectangle via arcTo rather than ctx.roundRect, which needs a browser
// newer than many of the budget Android phones this app is built for.
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

// A small cartoon car, because scene one is about a journey and a dot is not
// a journey.
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

// Dashed rise/run legs under a secant, the classic "slope = rise over run".
function riseRun(ctx, vp, x0, y0, x1, y1, alpha) {
  if (alpha <= 0.01) return
  clipToPlot(ctx, vp, () => {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = C.cyan
    ctx.lineWidth = 1.8
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(vp.sx(x0), vp.sy(y0))
    ctx.lineTo(vp.sx(x1), vp.sy(y0))
    ctx.lineTo(vp.sx(x1), vp.sy(y1))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = C.cyan
    ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('run = h', (vp.sx(x0) + vp.sx(x1)) / 2, vp.sy(y0) + 7)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('rise', vp.sx(x1) + 8, (vp.sy(y0) + vp.sy(y1)) / 2)
    ctx.restore()
  })
}

// --- the functions the scenes talk about ----------------------------------

const car = (t) => 0.4 * t * t // distance travelled, metres, after t seconds
const carSpeed = (t) => 0.8 * t // its exact derivative
const cubic = (x) => x * x * x - 3 * x
const decay = (x) => Math.exp(-x / 2)

const CAR_VIEW = { xMin: 0, xMax: 5.4, yMin: -0.6, yMax: 11.6 }

// --- scenes ----------------------------------------------------------------

const scenes = [
  {
    id: 'question',
    title: 'Average speed is not the speed right now',
    duration: 26000,
    narration:
      'Here is a car pulling away from rest. After five seconds it has travelled ten metres, so its average speed was two metres per second. But watch the car — it is clearly not moving at two metres per second the whole time. It starts slowly and ends fast. At the very last instant it is doing four metres per second, twice the average. Average speed describes a whole journey. What we want is the speed at one single moment.',
    view: CAR_VIEW,
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'distance travelled (m) against time (s)')

      // The car drives out along the curve, leaving its path behind.
      const drive = seg(t, 0, 0.4)
      const tx = lerp(0, 5, drive)
      clipToPlot(ctx, vp, () => {
        drawCurve(ctx, vp, sampleCurve(car, { ...vp, xMax: Math.max(0.001, tx) }), { color: C.curve, width: 3 })
      })
      plot(ctx, vp, car, { color: C.curve, width: 2, alpha: 0.22 })
      drawCar(ctx, vp.sx(tx), vp.sy(car(tx)) - 6, 0.95)

      // The average-speed secant across the whole five seconds.
      const avg = seg(t, 0.42, 0.62)
      if (avg > 0) {
        drawLineThroughPoint(ctx, vp, 0, 0, 2, { color: C.secant, width: 2.4, dash: [7, 5], alpha: avg })
        drawPoint(ctx, vp, 0, 0, { color: '#c4b5fd', radius: 4.5, ring: null })
        drawPoint(ctx, vp, 5, 10, { color: '#c4b5fd', radius: 4.5, ring: null })
        callout(ctx, vp.sx(0.35), vp.sy(8.6), ['average speed', '10 m ÷ 5 s = 2 m/s'], { accent: C.secant, alpha: avg })
      }

      // The tangent at the final instant — visibly steeper.
      const inst = seg(t, 0.66, 0.9)
      if (inst > 0) {
        drawLineThroughPoint(ctx, vp, 5, 10, 4, { color: C.tangent, width: 2.8, alpha: inst })
        drawPoint(ctx, vp, 5, 10, { color: '#fff', radius: 5.5 })
        callout(ctx, vp.sx(5.15), vp.sy(4.4), ['speed right now', '4 m/s'], { accent: C.tangent, align: 'right', alpha: inst })
      }
    },
  },

  {
    id: 'secant',
    title: 'Start with a slope you can actually measure',
    duration: 30000,
    narration:
      'You cannot measure a slope at a single point directly, because slope needs two points. So take two. Here is the curve at three seconds, and here it is again a gap of h later. Join them with a straight line. That line is called a secant, and its slope is easy: the rise divided by the run. The rise is f of x plus h, minus f of x. The run is simply h. That fraction is the difference quotient, and it is the whole of calculus in one expression.',
    view: CAR_VIEW,
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'a secant line through two points')
      plot(ctx, vp, car, { color: C.curve, width: 2.6 })

      const x0 = 3
      const h = 1.5
      const y0 = car(x0)
      const y1 = car(x0 + h)

      const a = seg(t, 0, 0.22)
      const b = seg(t, 0.2, 0.42)
      const line = seg(t, 0.42, 0.64)
      const legs = seg(t, 0.64, 0.84)
      const label = seg(t, 0.84, 1)

      if (line > 0) {
        drawLineThroughPoint(ctx, vp, x0, y0, (y1 - y0) / h, { color: C.secant, width: 2.6, alpha: line })
      }
      riseRun(ctx, vp, x0, y0, x0 + h, y1, legs)

      if (a > 0) drawPoint(ctx, vp, x0, y0, { color: '#fff', radius: 5.5 * a, label: a > 0.9 ? 'x' : null })
      if (b > 0) drawPoint(ctx, vp, x0 + h, y1, { color: '#c4b5fd', radius: 5.5 * b, ring: 'rgba(139,92,246,0.3)', label: b > 0.9 ? 'x + h' : null })

      callout(ctx, vp.sx(0.25), vp.sy(10.6), [
        'slope of the secant',
        '( f(x+h) − f(x) ) ÷ h',
        `= (${y1.toFixed(1)} − ${y0.toFixed(1)}) ÷ ${h} = ${((y1 - y0) / h).toFixed(2)}`,
      ], { accent: C.secant, alpha: label })
    },
  },

  {
    id: 'limit',
    title: 'Now shrink the gap toward zero',
    duration: 30000,
    narration:
      'Here is the beautiful part. Watch what happens as I shrink h. The second point slides back along the curve toward the first, and the secant line pivots. The gap closes, and the difference quotient settles down. It is not falling to zero — it is homing in on two point four. When h finally becomes too small to see, the secant has become the line that just grazes the curve at that one point. That is the tangent, and its slope, two point four, is the derivative.',
    view: CAR_VIEW,
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'the secant collapsing onto the tangent')
      plot(ctx, vp, car, { color: C.curve, width: 2.6 })

      const x0 = 3
      const y0 = car(x0)
      const exact = carSpeed(x0) // 2.4

      // Hold at h = 1.5 briefly, shrink for most of the scene, then rest.
      const shrink = seg(t, 0.12, 0.82)
      const h = Math.max(0.02, lerp(1.5, 0.02, shrink))
      const y1 = car(x0 + h)
      const slope = (y1 - y0) / h

      // The target tangent, faint, so the convergence has something to land on.
      drawLineThroughPoint(ctx, vp, x0, y0, exact, { color: C.tangent, width: 2.6, alpha: 0.28 + 0.72 * seg(t, 0.75, 1) })
      drawLineThroughPoint(ctx, vp, x0, y0, slope, { color: C.secant, width: 2.6, alpha: 1 - 0.55 * seg(t, 0.82, 1) })
      drawPoint(ctx, vp, x0 + h, y1, { color: '#c4b5fd', radius: 5, ring: 'rgba(139,92,246,0.3)' })
      drawPoint(ctx, vp, x0, y0, { color: '#fff', radius: 5.5 })

      callout(ctx, vp.sx(0.25), vp.sy(11.1), [
        `h            = ${h.toFixed(3)}`,
        `secant slope = ${slope.toFixed(3)}`,
        `tangent      = ${exact.toFixed(3)}`,
      ], { accent: seg(t, 0.75, 1) > 0.5 ? C.tangent : C.secant })

      const land = seg(t, 0.86, 1)
      if (land > 0) {
        callout(ctx, vp.sx(5.15), vp.sy(3.2), ["f′(3) = 2.4"], { accent: C.tangent, align: 'right', alpha: land })
      }
    },
  },

  {
    id: 'function',
    title: 'Do it everywhere and you get a new curve',
    duration: 31000,
    narration:
      'So far we have one number, at one point. But every point on this curve has its own tangent with its own slope. So let us sweep across and collect them all. Watch the lower graph. Each position contributes one value — the steepness of the curve above it. By the time we reach the end, we have not found a number. We have drawn an entire new function. This is the derivative, written f dash of x, and for our car it is the speedometer reading at every moment of the journey.',
    view: { ...CAR_VIEW, lower: { yMin: -0.6, yMax: 5 } },
    draw(ctx, stage, t) {
      const { vp, lower } = stage
      base(ctx, vp, 'f(x) — with its tangent sweeping across')
      plot(ctx, vp, car, { color: C.curve, width: 2.6 })

      const sweep = seg(t, 0.08, 0.92)
      const x = lerp(0.05, 5.2, sweep)
      const y = car(x)
      const m = carSpeed(x)

      drawLineThroughPoint(ctx, vp, x, y, m, { color: C.tangent, width: 2.6 })
      drawPoint(ctx, vp, x, y, { color: '#fff', radius: 5.5, label: `slope ${m.toFixed(2)}` })

      lower((vpD) => {
        base(ctx, vpD, "f′(x) — collected one tangent at a time")
        // Only the part already swept is drawn, so the curve builds up.
        clipToPlot(ctx, vpD, () => {
          drawCurve(ctx, vpD, sampleCurve(carSpeed, { ...vpD, xMax: Math.max(0.001, x) }), { color: C.secant, width: 3 })
        })
        drawPoint(ctx, vpD, x, m, { color: C.tangent, radius: 5.5, ring: 'rgba(240,165,0,0.3)' })
        if (seg(t, 0.9, 1) > 0.3) {
          callout(ctx, vpD.sx(0.3), vpD.sy(4.6), ["f′(x) = 0.8x"], { accent: C.secant, alpha: seg(t, 0.9, 1) })
        }
      })
    },
  },

  {
    id: 'reading',
    title: 'The derivative tells you the shape',
    duration: 33000,
    narration:
      'Once you have f dash, you can read the original curve without looking at it. Where f dash sits above the axis, the slope is positive and the curve is climbing. Where f dash drops below the axis, the slope is negative and the curve is falling. And exactly where f dash crosses zero, the tangent is flat — the curve has stopped climbing and is about to fall, or the reverse. Those crossings are the peaks and the valleys. This is why engineers differentiate and solve for zero when they want the strongest shape or the lowest cost.',
    view: { xMin: -2.3, xMax: 2.3, yMin: -3.4, yMax: 3.4, lower: { yMin: -4, yMax: 7 } },
    draw(ctx, stage, t) {
      const { vp, lower } = stage
      const dCubic = (x) => derivative(cubic, x)

      base(ctx, vp, 'f(x) = x³ − 3x')

      // Shade the rising and falling stretches as the scene reveals them.
      const reveal = seg(t, 0.1, 0.7)
      const edge = lerp(-2.3, 2.3, reveal)
      clipToPlot(ctx, vp, () => {
        ctx.save()
        const step = (vp.xMax - vp.xMin) / 220
        for (let x = vp.xMin; x < edge; x += step) {
          const up = dCubic(x) > 0
          ctx.fillStyle = up ? 'rgba(47, 224, 141, 0.11)' : 'rgba(255, 93, 93, 0.11)'
          ctx.fillRect(vp.sx(x), vp.padT, Math.ceil(vp.sx(x + step) - vp.sx(x)) + 1, vp.plotH)
        }
        ctx.restore()
      })
      plot(ctx, vp, cubic, { color: C.curve, width: 2.8 })

      // Mark the two stationary points once the sweep has passed them.
      const marks = seg(t, 0.55, 0.8)
      if (marks > 0) {
        [[-1, cubic(-1), 'maximum'], [1, cubic(1), 'minimum']].forEach(([sx, sy, kind]) => {
          drawPoint(ctx, vp, sx, sy, { color: C.good, radius: 5.5, ring: 'rgba(47,224,141,0.25)', label: marks > 0.6 ? kind : null })
          drawLineThroughPoint(ctx, vp, sx, sy, 0, { color: C.good, width: 1.6, dash: [5, 5], alpha: marks * 0.8 })
        })
      }

      lower((vpD) => {
        base(ctx, vpD, "f′(x) = 3x² − 3")
        clipToPlot(ctx, vpD, () => {
          drawCurve(ctx, vpD, sampleCurve(dCubic, { ...vpD, xMax: Math.max(vpD.xMin + 0.001, edge) }), { color: C.secant, width: 3 })
        })
        if (marks > 0) {
          [-1, 1].forEach((sx) => drawPoint(ctx, vpD, sx, 0, { color: C.good, radius: 5, ring: 'rgba(47,224,141,0.25)' }))
          callout(ctx, vpD.sx(-0.45), vpD.sy(5.8), ["f′ = 0 here"], { accent: C.good, alpha: marks })
        }
      })
    },
  },

  {
    id: 'worlds',
    title: 'One curve you have already met',
    duration: 30000,
    narration:
      'Here is one last curve, and you have run it before without knowing it. Look at its derivative: it is the same shape, just flipped and scaled. That means its rate of change is proportional to how much is left. A flask far above room temperature loses heat quickly, then slows as it gets closer. That is your titration lab cooling down. It is also the bulb dimming in your circuit lab, a capacitor charging, and a radioactive sample decaying. Four different worlds, one derivative. That is what calculus buys you.',
    view: { xMin: 0, xMax: 8, yMin: -0.12, yMax: 1.18, lower: { yMin: -0.62, yMax: 0.12 } },
    draw(ctx, stage, t) {
      const { vp, lower } = stage
      const dDecay = (x) => derivative(decay, x)

      base(ctx, vp, 'f(x) = e^(−x/2)')
      plot(ctx, vp, decay, { color: C.curve, width: 2.8 })

      const sweep = seg(t, 0.1, 0.68)
      const x = lerp(0.05, 7.9, sweep)
      drawLineThroughPoint(ctx, vp, x, decay(x), dDecay(x), { color: C.tangent, width: 2.4 })
      drawPoint(ctx, vp, x, decay(x), { color: '#fff', radius: 5.5 })

      const names = seg(t, 0.72, 1)
      if (names > 0) {
        callout(ctx, vp.sx(3.4), vp.sy(0.95), [
          'cooling flask · dimming bulb',
          'charging capacitor · decay',
        ], { accent: C.cyan, alpha: names })
      }

      lower((vpD) => {
        base(ctx, vpD, "f′(x) = −½ · e^(−x/2)   — the same shape, scaled")
        clipToPlot(ctx, vpD, () => {
          drawCurve(ctx, vpD, sampleCurve(dDecay, { ...vpD, xMax: Math.max(0.001, x) }), { color: C.secant, width: 3 })
        })
        drawPoint(ctx, vpD, x, dDecay(x), { color: C.tangent, radius: 5.5, ring: 'rgba(240,165,0,0.3)' })
      })
    },
  },
]

export const DERIVATIVES_EXPLAINER = {
  id: 'derivatives',
  title: 'What a derivative actually is',
  scenes,
}
