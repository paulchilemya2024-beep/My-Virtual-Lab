import {
  makeViewport, drawPaneBackground, drawGrid, drawAxes, sampleCurve, drawCurve,
  drawPoint, drawOpenPoint, drawVerticalMarker, clipToPlot,
} from '../plot.js'

// The animated explainer for limits and continuity.
//
// Five of the six scenes share one trick that none of the other explainers in
// this unit use: the CAMERA itself zooms, not just the content. Each zoom
// scene keeps pane 1 fixed (the ordinary full-domain graph) and builds a
// second, independent viewport by hand in pane 2's pixel region, with its
// bounds shrinking around the point of interest as `t` advances — exactly the
// zoom the interactive lab lets a student drive themselves. A smooth curve
// flattens into a straight line under that zoom; a hole, a jump and an
// asymptote do not — and that difference IS what distinguishes them.

const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)))
const lerp = (a, b, t) => a + (b - a) * t

const C = { curve: '#00e5c3', mark: '#f0a500', cyan: '#38d9f8', bad: '#ff5d5d', ink: 'rgba(234, 242, 255, 0.92)' }
const PAD = { left: 52, right: 18, top: 18, bottom: 28 }

function base(ctx, vp, label) {
  drawPaneBackground(ctx, vp, { label })
  drawGrid(ctx, vp)
  drawAxes(ctx, vp)
}

function callout(ctx, px, py, lines, { color = C.ink, accent = C.mark, align = 'left', alpha = 1 } = {}) {
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

// --- the four functions this explainer visits -------------------------------

const smooth = { f: (x) => x * x + 1, a: 1, domain: [-1, 3], range: [-0.5, 11], baseHalfX: 1.6, baseHalfY: 4 }
const hole = { f: (x) => (Math.abs(x - 2) < 1e-12 ? NaN : (x * x - 4) / (x - 2)), a: 2, domain: [0, 4], range: [-0.5, 7], baseHalfX: 1.6, baseHalfY: 3 }
const jump = { f: (x) => (x < 1 ? x : x + 1), a: 1, domain: [-1, 3], range: [-2, 5], baseHalfX: 1.6, baseHalfY: 2.4 }
const asymptote = { f: (x) => 1 / (x - 1), a: 1, domain: [-2, 4], range: [-10, 10], baseHalfX: 1.6, baseHalfY: 9 }

// Builds the zoomed viewport for pane 2 at zoom progress `zt` (0 = starting
// view, 1 = fully zoomed in), ×100 at full zoom — identical math to the
// interactive lab's own zoom slider, so the explainer and the lab agree.
function zoomViewport(fn, zt, width, paneH, centerY) {
  const scale = Math.pow(0.01, zt)
  const halfX = fn.baseHalfX * scale
  const halfY = fn.baseHalfY * scale
  return makeViewport({ width, height: paneH, xMin: fn.a - halfX, xMax: fn.a + halfX, yMin: centerY - halfY, yMax: centerY + halfY, pad: PAD })
}

function drawZoomPane(ctx, stage, fn, zt, centerY, label, { asymptoteLine = false } = {}) {
  const { width, paneH, gap } = stage
  ctx.save()
  ctx.translate(0, paneH + gap)
  const vpZ = zoomViewport(fn, zt, width, paneH, centerY)
  base(ctx, vpZ, label)
  if (asymptoteLine) drawVerticalMarker(ctx, vpZ, fn.a, { color: 'rgba(255, 93, 93, 0.6)', dash: [5, 4], width: 1.6 })
  clipToPlot(ctx, vpZ, () => drawCurve(ctx, vpZ, sampleCurve(fn.f, vpZ, 600), { color: C.curve, width: 2.6 }))
  ctx.restore()
  return vpZ
}

const scenes = [
  {
    id: 'question',
    title: 'Approaching a point without landing on it',
    duration: 19000,
    narration:
      "Forget the function's formula for a moment and just watch two values creep toward x equals one — one sneaking up from the left, one sneaking down from the right. Read off what f of x does as each one gets closer and closer. If both sides are closing in on the very same number, that shared number is called the limit of f as x approaches one — whether or not the function is even defined to do anything official once it actually arrives.",
    view: { xMin: smooth.domain[0], xMax: smooth.domain[1], yMin: smooth.range[0], yMax: smooth.range[1] },
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'f(x) = x² + 1 — watching x → 1 from both sides')
      drawVerticalMarker(ctx, vp, smooth.a, { color: 'rgba(240, 165, 0, 0.4)', dash: [3, 4] })
      clipToPlot(ctx, vp, () => drawCurve(ctx, vp, sampleCurve(smooth.f, vp), { color: C.curve, width: 2.4 }))

      const approach = seg(t, 0.12, 0.85)
      const dLeft = lerp(0.8, 0.01, approach)
      const dRight = lerp(0.8, 0.01, approach)
      const xL = smooth.a - dLeft
      const xR = smooth.a + dRight
      drawPoint(ctx, vp, xL, smooth.f(xL), { color: '#c4b5fd', radius: 5 })
      drawPoint(ctx, vp, xR, smooth.f(xR), { color: C.cyan, radius: 5 })

      const label = seg(t, 0.55, 1)
      if (label > 0) {
        callout(ctx, vp.sx(-0.9), vp.sy(10.4), [
          `f(${xL.toFixed(3)}) = ${smooth.f(xL).toFixed(3)}`,
          `f(${xR.toFixed(3)}) = ${smooth.f(xR).toFixed(3)}`,
          'both → 2',
        ], { accent: C.mark, alpha: label })
      }
    },
  },

  {
    id: 'zoom-smooth',
    title: 'Zoom into a smooth point and it goes flat',
    duration: 23000,
    narration:
      "Here is the real test of what 'smooth' means: zoom in, uniformly, on both axes at once, centred exactly on the point. Watch the curve as the window shrinks around it. It does not stay curved — it straightens out, more and more, the harder you zoom. Push the zoom far enough and the function becomes indistinguishable from a single straight line. That flattening is not a coincidence. It is exactly the property the next unit calls being differentiable — having one well-defined tangent slope at that point.",
    view: { xMin: smooth.domain[0], xMax: smooth.domain[1], yMin: smooth.range[0], yMax: smooth.range[1], lower: { yMin: 0, yMax: 1 } },
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'f(x) = x² + 1')
      drawVerticalMarker(ctx, vp, smooth.a, { color: 'rgba(240, 165, 0, 0.4)', dash: [3, 4] })
      clipToPlot(ctx, vp, () => drawCurve(ctx, vp, sampleCurve(smooth.f, vp), { color: C.curve, width: 2.4 }))

      const zt = seg(t, 0.12, 0.92)
      const vpZ = drawZoomPane(ctx, stage, smooth, zt, smooth.f(smooth.a), `zoomed ×${Math.round(Math.pow(100, zt))} on a = 1`)
      drawPoint(ctx, vpZ, smooth.a, smooth.f(smooth.a), { color: C.mark, radius: 5 })

      const label = seg(t, 0.75, 1)
      if (label > 0) {
        ctx.save()
        ctx.translate(0, stage.paneH + stage.gap)
        callout(ctx, vpZ.sx(smooth.a) - 90, vpZ.sy(smooth.f(smooth.a)) - 50, ['flat. straight. differentiable.'], { accent: C.cyan, alpha: label })
        ctx.restore()
      }
    },
  },

  {
    id: 'zoom-hole',
    title: 'A limit can exist where the function does not',
    duration: 22000,
    narration:
      "This formula divides by zero exactly at x equals two, so the function is simply undefined there — a genuine gap. But watch what zooming reveals: everywhere else, this formula behaves like the plain straight line x plus two, and as you approach x equals two from either side, it keeps heading toward the value four. The limit exists and equals four. The function itself just never shows up to claim it — drawn, correctly, as an open circle. That is a removable discontinuity: a hole in an otherwise perfectly ordinary line.",
    view: { xMin: hole.domain[0], xMax: hole.domain[1], yMin: hole.range[0], yMax: hole.range[1], lower: { yMin: 0, yMax: 1 } },
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'f(x) = (x² − 4) ⁄ (x − 2)')
      drawVerticalMarker(ctx, vp, hole.a, { color: 'rgba(240, 165, 0, 0.4)', dash: [3, 4] })
      clipToPlot(ctx, vp, () => drawCurve(ctx, vp, sampleCurve(hole.f, vp), { color: C.curve, width: 2.4 }))

      const zt = seg(t, 0.12, 0.88)
      const vpZ = drawZoomPane(ctx, stage, hole, zt, 4, `zoomed ×${Math.round(Math.pow(100, zt))} on a = 2`)
      const reveal = seg(t, 0.6, 0.95)
      if (reveal > 0.3) {
        ctx.save()
        ctx.globalAlpha = reveal
        ctx.translate(0, stage.paneH + stage.gap)
        drawOpenPoint(ctx, vpZ, hole.a, 4, { color: C.mark })
        ctx.restore()
      }
    },
  },

  {
    id: 'zoom-jump',
    title: 'A gap that zooming never closes',
    duration: 33000,
    narration:
      "This function is two separate straight pieces: one below x equals one, a different one from x equals one onward. Zoom in on the join, the same way as before. The hole from a moment ago closed up into a single point under enough zoom — this one never does. No matter how far you push in, there is a one-unit gap between where the left piece is heading and where the right piece actually starts. The left limit and the right limit disagree, so the two-sided limit simply does not exist. This is a jump discontinuity.",
    view: { xMin: jump.domain[0], xMax: jump.domain[1], yMin: jump.range[0], yMax: jump.range[1], lower: { yMin: 0, yMax: 1 } },
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'f(x) = x  (x<1)   or   x+1  (x≥1)')
      drawVerticalMarker(ctx, vp, jump.a, { color: 'rgba(240, 165, 0, 0.4)', dash: [3, 4] })
      clipToPlot(ctx, vp, () => drawCurve(ctx, vp, sampleCurve(jump.f, vp), { color: C.curve, width: 2.4 }))

      const zt = seg(t, 0.12, 0.88)
      const vpZ = drawZoomPane(ctx, stage, jump, zt, 1.5, `zoomed ×${Math.round(Math.pow(100, zt))} on a = 1`)
      ctx.save()
      ctx.translate(0, stage.paneH + stage.gap)
      drawOpenPoint(ctx, vpZ, jump.a, 1, { color: C.mark })
      drawPoint(ctx, vpZ, jump.a, 2, { color: C.mark, radius: 5 })
      ctx.restore()
      const label = seg(t, 0.7, 1)
      if (label > 0) {
        ctx.save()
        ctx.translate(0, stage.paneH + stage.gap)
        callout(ctx, vpZ.sx(jump.a) + 14, vpZ.sy(1.5), ['still a gap, at any zoom'], { accent: C.bad, alpha: label })
        ctx.restore()
      }
    },
  },

  {
    id: 'zoom-asymptote',
    title: 'Sometimes it is genuinely unbounded',
    duration: 36000,
    narration:
      "One last case. As x approaches one, this function does not settle on any number at all — it races off toward positive infinity from one side and negative infinity from the other. Zoom in all you like: the curve keeps running straight off the top and the bottom of the frame, every single time. There is no hole to patch and no jump to measure, because there is no finite value anywhere nearby for either side to approach. This is an infinite discontinuity, usually marked with a dashed vertical line — the asymptote the function can get arbitrarily close to but never actually cross.",
    view: { xMin: asymptote.domain[0], xMax: asymptote.domain[1], yMin: asymptote.range[0], yMax: asymptote.range[1], lower: { yMin: 0, yMax: 1 } },
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'f(x) = 1 ⁄ (x − 1)')
      drawVerticalMarker(ctx, vp, asymptote.a, { color: 'rgba(255, 93, 93, 0.5)', dash: [4, 4] })
      clipToPlot(ctx, vp, () => drawCurve(ctx, vp, sampleCurve(asymptote.f, vp), { color: C.curve, width: 2.4 }))

      const zt = seg(t, 0.12, 0.88)
      drawZoomPane(ctx, stage, asymptote, zt, 0, `zoomed ×${Math.round(Math.pow(100, zt))} on a = 1`, { asymptoteLine: true })
    },
  },

  {
    id: 'continuity',
    title: 'Continuity is three things lining up',
    duration: 43000,
    narration:
      "Put it all together and continuity at a point turns out to mean exactly three conditions, all holding at once. The limit has to exist — left and right have to agree. The function itself has to actually be defined there. And the two have to match — the function's value has to equal the limit, not just sit near it. Break any one of those and you get one of the three broken cases you just watched. Every rule you are about to meet for derivatives — tangent lines, the product rule, the chain rule — silently assumes you are standing on a point exactly this well-behaved. That is why checking first is not a formality. It is the foundation everything after this is built on.",
    view: { xMin: smooth.domain[0], xMax: smooth.domain[1], yMin: smooth.range[0], yMax: smooth.range[1] },
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, 'continuous at a: the limit exists, f(a) exists, and they match')
      drawVerticalMarker(ctx, vp, smooth.a, { color: 'rgba(240, 165, 0, 0.4)', dash: [3, 4] })
      clipToPlot(ctx, vp, () => drawCurve(ctx, vp, sampleCurve(smooth.f, vp), { color: C.curve, width: 2.4 }))
      drawPoint(ctx, vp, smooth.a, smooth.f(smooth.a), { color: C.mark, radius: 5.5 })

      const checklist = [
        'limit exists (left = right)',
        'f(a) is defined',
        'f(a) = the limit',
      ]
      const shown = Math.min(checklist.length, Math.floor(seg(t, 0.15, 0.7) * (checklist.length + 1)))
      if (shown > 0) {
        callout(ctx, vp.sx(-0.9), vp.sy(10.6), checklist.slice(0, shown).map((c) => `✓ ${c}`), { accent: '#2fe08d' })
      }
      const forward = seg(t, 0.75, 1)
      if (forward > 0) {
        callout(ctx, vp.sx(1.5), vp.sy(2.6), ['next: what happens at a point', 'exactly this well-behaved?'], { accent: C.cyan, alpha: forward })
      }
    },
  },
]

export const LIMITS_EXPLAINER = {
  id: 'limits',
  title: 'Limits and continuity',
  scenes,
}
