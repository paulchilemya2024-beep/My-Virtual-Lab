import { drawPaneBackground, drawGrid, drawAxes, sampleCurve, drawCurve, clipToPlot } from '../plot.js'
import { derivative } from '../numeric.js'

// The animated explainer for the product rule and the chain rule.
//
// Six scenes in two halves. The product-rule half reuses the growing
// rectangle from the interactive lab — three slivers of area, one of which
// visibly shrinks away as Δx shrinks. The chain-rule half reuses the dial
// train — rates multiplying along a chain of linked machines. Both halves end
// the same way every reveal in this unit has ended: two independently
// computed curves, drawn on top of each other, landing exactly together.

const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)))
const lerp = (a, b, t) => a + (b - a) * t

const C = {
  curve: '#00e5c3',
  rule: '#f0a500',
  truth: '#8b5cf6',
  cyan: '#38d9f8',
  ink: 'rgba(234, 242, 255, 0.92)',
}

function base(ctx, vp, label) {
  drawPaneBackground(ctx, vp, { label })
  drawGrid(ctx, vp)
  drawAxes(ctx, vp)
}

// For the cartoon-diagram scenes (the rectangle, the dial train), which use a
// throwaway 0..1 viewport purely to get a background box + label — a real
// coordinate grid drawn under a free-form illustration would just be clutter,
// so those scenes call this instead of base().
function baseMeta(ctx, vp, label) {
  drawPaneBackground(ctx, vp, { label })
}

function callout(ctx, px, py, lines, { color = C.ink, accent = C.rule, align = 'left', alpha = 1 } = {}) {
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

// --- the functions this explainer talks about -------------------------------

const w = (x) => x + 1
const h = (x) => x * x
const area = (x) => w(x) * h(x)

const g = (x) => x * x
const f = (u) => Math.sin(u)
const composite = (x) => f(g(x))

function drawRectangleDiagram(ctx, x0, y0, boxW, boxH, x, dx, { showCorner = true } = {}) {
  const maxW = w(3)
  const maxH = h(3)
  const scale = Math.min(boxW / (maxW * 1.3), boxH / (maxH * 1.25))
  const curW = w(x)
  const curH = h(x)
  const dw = w(x + dx) - curW
  const dh = h(x + dx) - curH

  const baseY = y0 + boxH
  const rectX = x0
  const rectY = baseY - curH * scale
  const rectW = curW * scale
  const rectH = curH * scale

  ctx.save()
  ctx.fillStyle = 'rgba(0, 229, 195, 0.28)'
  ctx.strokeStyle = 'rgba(0, 229, 195, 0.85)'
  ctx.lineWidth = 1.6
  ctx.fillRect(rectX, rectY, rectW, rectH)
  ctx.strokeRect(rectX, rectY, rectW, rectH)

  ctx.fillStyle = 'rgba(56, 217, 248, 0.35)'
  ctx.strokeStyle = 'rgba(56, 217, 248, 0.9)'
  ctx.fillRect(rectX + rectW, rectY, dw * scale, rectH)
  ctx.strokeRect(rectX + rectW, rectY, dw * scale, rectH)

  ctx.fillStyle = 'rgba(240, 165, 0, 0.35)'
  ctx.strokeStyle = 'rgba(240, 165, 0, 0.9)'
  ctx.fillRect(rectX, rectY - dh * scale, rectW, dh * scale)
  ctx.strokeRect(rectX, rectY - dh * scale, rectW, dh * scale)

  if (showCorner) {
    ctx.fillStyle = 'rgba(139, 92, 246, 0.55)'
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.95)'
    ctx.fillRect(rectX + rectW, rectY - dh * scale, dw * scale, dh * scale)
    ctx.strokeRect(rectX + rectW, rectY - dh * scale, dw * scale, dh * scale)
  }

  ctx.strokeStyle = 'rgba(234, 242, 255, 0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0 - 6, baseY)
  ctx.lineTo(x0 + boxW, baseY)
  ctx.stroke()
  ctx.restore()

  return { dw, dh, w: curW, h: curH }
}

function drawDial(ctx, cx, cy, r, angle, { color = '#00e5c3', teeth = 10, extraAngle = null, extraColor = '#f0a500' } = {}) {
  ctx.save()
  ctx.fillStyle = 'rgba(234, 242, 255, 0.06)'
  ctx.strokeStyle = 'rgba(234, 242, 255, 0.22)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = color
  for (let i = 0; i < teeth; i += 1) {
    const a = angle + (i / teeth) * Math.PI * 2
    const tx = cx + Math.cos(a) * r
    const ty = cy + Math.sin(a) * r
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(a)
    ctx.fillRect(-2, -4, 4, 8)
    ctx.restore()
  }

  ctx.strokeStyle = color
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(angle) * r * 0.8, cy + Math.sin(angle) * r * 0.8)
  ctx.stroke()

  if (extraAngle != null) {
    ctx.strokeStyle = extraColor
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(extraAngle) * r * 0.8, cy + Math.sin(extraAngle) * r * 0.8)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.fillStyle = 'rgba(8, 16, 34, 0.9)'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()
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
    ctx.fillStyle = C.cyan
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(label, (x0 + x1) / 2, y - 8)
  }
  ctx.restore()
}

const PRODUCT_DERIV_VIEW = { xMin: 0, xMax: 3, yMin: -3, yMax: 36 }
const CHAIN_DERIV_VIEW = { xMin: 0, xMax: 2.6, yMin: -3.4, yMax: 3.4 }

const scenes = [
  {
    id: 'question',
    title: 'What if two things are changing at once?',
    duration: 21000,
    narration:
      "You already know how to differentiate a sum: differentiate each piece separately and add the results. But a PRODUCT is a different story. If a rectangle's width and its height are both growing at the same time, its area is growing too — but not just by adding the two growth rates. Multiplying two changing quantities needs its own rule, and the cleanest way to find it is to literally watch a rectangle grow.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      baseMeta(ctx, vp, 'a rectangle whose width AND height are both increasing')
      const x = lerp(0.3, 2.2, seg(t, 0.15, 0.85))
      drawRectangleDiagram(ctx, vp.width * 0.1, vp.height * 0.15, vp.width * 0.5, vp.height * 0.65, x, 0.35, { showCorner: false })
      const label = seg(t, 0.7, 1)
      if (label > 0) {
        callout(ctx, vp.width * 0.64, vp.height * 0.3, ['A = w(x) · h(x)', 'dA/dx = ?'], { accent: C.cyan, alpha: label })
      }
    },
  },

  {
    id: 'slivers',
    title: 'Grow it by a tiny step and count the new area',
    duration: 25000,
    narration:
      "Step x forward by a small amount. The new area splits into exactly three new pieces. A tall thin sliver on the right, with the old height and a new width — that contributes height times the width change. A wide thin sliver on top, with the old width and a new height — that contributes width times the height change. And one tiny corner piece where both changes overlap. As that step shrinks toward zero, watch the corner — it shrinks away far faster than the other two, because it depends on BOTH changes at once.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const x = 1.6
      const shrink = seg(t, 0.35, 0.95)
      const dx = lerp(0.55, 0.03, shrink)
      baseMeta(ctx, vp, 'the three new pieces of area')
      const { dw, dh, w: curW, h: curH } = drawRectangleDiagram(ctx, vp.width * 0.08, vp.height * 0.14, vp.width * 0.46, vp.height * 0.66, x, dx, { showCorner: true })

      const legendX = vp.width * 0.6
      callout(ctx, legendX, vp.height * 0.18, [
        `h·Δw  ≈ ${(curH * dw).toFixed(3)}`,
        `w·Δh  ≈ ${(curW * dh).toFixed(3)}`,
        `Δw·Δh ≈ ${(dw * dh).toFixed(4)}`,
      ], { accent: C.rule })
    },
  },

  {
    id: 'rule',
    title: 'The corner vanishes — the rule survives',
    duration: 22000,
    narration:
      "Divide every piece by the step size and let that step shrink to nothing. The first two pieces settle on definite values — those become h times the rate w changes, plus w times the rate h changes. But the corner piece has a step size multiplied by ANOTHER step size — a quantity so small it vanishes even faster than the other two, and in the limit it contributes nothing at all. What survives is the product rule: the derivative of w times h is w-prime times h, plus w times h-prime.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      baseMeta(ctx, vp, 'in the limit, only two terms survive')
      const x = 1.6
      const dx = 0.03
      drawRectangleDiagram(ctx, vp.width * 0.08, vp.height * 0.14, vp.width * 0.46, vp.height * 0.66, x, dx, { showCorner: seg(t, 0.4, 0.7) < 1 })
      const reveal = seg(t, 0.5, 1)
      if (reveal > 0) {
        callout(ctx, vp.width * 0.6, vp.height * 0.25, [
          '(w · h)′ = w′·h + w·h′',
          '',
          'the corner → 0, this does not',
        ], { accent: C.rule, alpha: reveal })
      }
    },
  },

  {
    id: 'product-check',
    title: 'Confirmed — two computations, one answer',
    duration: 18000,
    narration:
      "Here is the proof, not asserted but shown. One curve is measured directly from the whole area function, with no shortcut. The other is built purely from the product rule — multiply the two derivatives into the formula and plot that instead. Sweep across and watch them trace over each other exactly. That agreement, everywhere, is what it means for a rule to be true.",
    view: PRODUCT_DERIV_VIEW,
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, "A′(x) — ground truth (violet) vs. the rule (gold)")
      const sweep = seg(t, 0.1, 0.9)
      const xEdge = lerp(0.05, 3, sweep)
      const groundTruth = (x) => derivative(area, x)
      const ruleFn = (x) => derivative(w, x) * h(x) + w(x) * derivative(h, x)
      clipToPlot(ctx, vp, () => {
        drawCurve(ctx, vp, sampleCurve(groundTruth, { ...vp, xMax: Math.max(0.001, xEdge) }), { color: C.truth, width: 3 })
        drawCurve(ctx, vp, sampleCurve(ruleFn, { ...vp, xMax: Math.max(0.001, xEdge) }), { color: C.rule, width: 1.6, dash: [5, 4] })
      })
    },
  },

  {
    id: 'chain',
    title: 'A chain of rates',
    duration: 23000,
    narration:
      "Now a different kind of combination. x drives an inner quantity u, and u drives an outer quantity y — a function fed into another function. Picture three linked dials. The first turns at a steady pace, representing x itself. It drives the second, which turns faster or slower depending on how quickly u responds to x. That second dial drives a third, which depends on how quickly y responds to u. The overall speed of that final dial is not a sum of the two rates — it is their product.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      baseMeta(ctx, vp, 'x drives u = g(x); u drives y = f(u)')
      const spin = t * 6
      const x = 1.4
      const gP = derivative(g, x)
      const fP = derivative(f, g(x))
      const r = Math.min(46, vp.height * 0.22)
      const cy = vp.height * 0.45
      const cx1 = vp.width * 0.16
      const cx2 = vp.width * 0.5
      const cx3 = vp.width * 0.84
      drawDial(ctx, cx1, cy, r * 0.8, spin, { color: C.curve, teeth: 8 })
      drawArrow(ctx, cx1 + r * 0.8 + 8, cy, cx2 - r - 8, `× g′ = ${gP.toFixed(2)}`)
      drawDial(ctx, cx2, cy, r, spin * gP, { color: C.cyan, teeth: 10 })
      drawArrow(ctx, cx2 + r + 8, cy, cx3 - r * 1.1 - 8, `× f′ = ${fP.toFixed(2)}`)
      drawDial(ctx, cx3, cy, r * 1.1, spin * gP * fP, { color: C.truth, teeth: 12 })
    },
  },

  {
    id: 'chain-check',
    title: 'The chain rule, confirmed the same way',
    duration: 22000,
    narration:
      "Multiply the two individual rates together — how fast y responds to u, times how fast u responds to x — and you get the overall rate of y with respect to x. The same proof as before applies here: measure the combined function's rate directly, with no shortcut, and compare it against the two rates multiplied. They trace over each other exactly. Sensor feeding controller feeding motor; this is how an engineer finds the overall sensitivity of the whole stack from the sensitivity of each link alone.",
    view: CHAIN_DERIV_VIEW,
    draw(ctx, stage, t) {
      const { vp } = stage
      base(ctx, vp, "y′(x) — ground truth (violet) vs. f′(g(x))·g′(x) (gold)")
      const sweep = seg(t, 0.1, 0.9)
      const xEdge = lerp(0.05, 2.6, sweep)
      const groundTruth = (x) => derivative(composite, x)
      const ruleFn = (x) => derivative(f, g(x)) * derivative(g, x)
      clipToPlot(ctx, vp, () => {
        drawCurve(ctx, vp, sampleCurve(groundTruth, { ...vp, xMax: Math.max(0.001, xEdge) }), { color: C.truth, width: 3 })
        drawCurve(ctx, vp, sampleCurve(ruleFn, { ...vp, xMax: Math.max(0.001, xEdge) }), { color: C.rule, width: 1.6, dash: [5, 4] })
      })
      const label = seg(t, 0.8, 1)
      if (label > 0) {
        callout(ctx, vp.sx(0.3), vp.sy(2.9), ['every real system is a chain', 'of smaller systems — multiply the links'], { accent: C.cyan, alpha: label })
      }
    },
  },
]

export const DERIVATIVE_RULES_EXPLAINER = {
  id: 'derivative-rules',
  title: 'The product rule and the chain rule',
  scenes,
}
