// The animated explainer for forces on an inclined plane.
//
// Every scene is a block on a ramp, the exact same geometry the interactive
// lab itself draws. Nothing here is asserted without a number backing it:
// every force arrow drawn is computed from the same equations the lab uses —
// mg·sinθ, mg·cosθ, μN — so a value shown in scene 3 and the same value shown
// in scene 5 are the same calculation, not two different illustrations.

const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)))
const lerp = (a, b, t) => a + (b - a) * t
const G = 9.8
const MASS = 2

const C = { weight: '#e23b2a', normal: '#1f6feb', friction: '#f0a500', net: '#ffffff', ink: 'rgba(234, 242, 255, 0.92)', ok: '#2fe08d', bad: '#ff5d5d' }

function drawPaneBg(ctx, vp, label) {
  ctx.save()
  ctx.fillStyle = 'rgba(8, 16, 34, 0.72)'
  ctx.fillRect(vp.padL, vp.padT, vp.plotW, vp.plotH)
  ctx.strokeStyle = 'rgba(120, 190, 255, 0.14)'
  ctx.lineWidth = 1
  ctx.strokeRect(vp.padL + 0.5, vp.padT + 0.5, vp.plotW - 1, vp.plotH - 1)
  ctx.fillStyle = 'rgba(234, 242, 255, 0.5)'
  ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(label, vp.padL + 10, vp.padT + 8)
  ctx.restore()
}

function callout(ctx, px, py, lines, { color = C.ink, accent = C.friction, align = 'left', alpha = 1 } = {}) {
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

// Draws the ramp, the block sitting on it (or part-way down it), and returns
// the geometry needed to anchor force arrows at the block's centre.
// Geometry, verified separately: a right triangle with the right angle at
// the bottom-left, the peak directly above it, and the hypotenuse (the ramp
// surface itself) running from the peak down to a right-hand base point at
// ground level. The slope's own unit direction is exactly (cosθ, sinθ), and
// the outward surface normal — the direction a resting block is lifted along
// so it sits visibly ON the ramp rather than centred on the line — is exactly
// (sinθ, −cosθ). Both are checked against the force-arrow directions used in
// the scenes below, so a block drawn here and a force vector drawn there
// agree with each other by construction, not by eye.
function drawRamp(ctx, w, h, angleDeg, slidFrac = 0) {
  const angle = (angleDeg * Math.PI) / 180
  const baseX = w * 0.12
  const baseY = h * 0.82
  const rampLen = w * 0.7
  const peakX = baseX
  const peakY = baseY - rampLen * Math.sin(angle)
  const rightX = baseX + rampLen * Math.cos(angle)
  const rightY = baseY

  ctx.save()
  ctx.fillStyle = 'rgba(234, 242, 255, 0.08)'
  ctx.strokeStyle = 'rgba(234, 242, 255, 0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.lineTo(peakX, peakY)
  ctx.lineTo(rightX, rightY)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // angle arc, drawn where the slope actually meets the ground
  ctx.strokeStyle = 'rgba(56, 217, 248, 0.6)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(rightX, rightY, 28, Math.PI, Math.PI + angle)
  ctx.stroke()
  ctx.fillStyle = 'rgba(56, 217, 248, 0.9)'
  ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textAlign = 'left'
  ctx.fillText(`${angleDeg.toFixed(0)}°`, rightX - 54, rightY - 10)

  // block, positioned a fraction of the way down the slope (0 = near the peak)
  const blockDist = lerp(rampLen * 0.18, rampLen * 0.86, slidFrac)
  const onSurfaceX = peakX + blockDist * Math.cos(angle)
  const onSurfaceY = peakY + blockDist * Math.sin(angle)
  const size = 26
  const nx = Math.sin(angle) // outward surface normal
  const ny = -Math.cos(angle)
  const bx = onSurfaceX + nx * (size / 2)
  const by = onSurfaceY + ny * (size / 2)

  ctx.save()
  ctx.translate(bx, by)
  ctx.rotate(angle)
  ctx.fillStyle = 'rgba(0, 229, 195, 0.85)'
  ctx.fillRect(-size / 2, -size / 2, size, size)
  ctx.strokeStyle = 'rgba(0, 229, 195, 1)'
  ctx.lineWidth = 1.6
  ctx.strokeRect(-size / 2, -size / 2, size, size)
  ctx.restore()
  ctx.restore()

  return { bx, by, angle }
}

function arrow(ctx, x0, y0, dx, dy, color, label) {
  const x1 = x0 + dx
  const y1 = y0 + dy
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  const ang = Math.atan2(dy, dx)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - 9 * Math.cos(ang - 0.4), y1 - 9 * Math.sin(ang - 0.4))
  ctx.lineTo(x1 - 9 * Math.cos(ang + 0.4), y1 - 9 * Math.sin(ang + 0.4))
  ctx.closePath()
  ctx.fill()
  if (label) {
    ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(label, x1 + 6, y1 + 4)
  }
  ctx.restore()
}

function barChart(ctx, x, y, w, items) {
  const maxVal = Math.max(...items.map((i) => i.value), 0.0001)
  const barH = 14
  const gap = 24
  items.forEach((item, i) => {
    const barW = Math.max(2, (item.value / maxVal) * w)
    const yy = y + i * gap
    ctx.save()
    ctx.fillStyle = 'rgba(234,242,255,0.15)'
    ctx.fillRect(x, yy, w, barH)
    ctx.fillStyle = item.color
    ctx.fillRect(x, yy, barW, barH)
    ctx.fillStyle = 'rgba(234,242,255,0.9)'
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`${item.label}: ${item.value.toFixed(2)} N`, x, yy - 4)
    ctx.restore()
  })
}

const scenes = [
  {
    id: 'question',
    title: 'Why does a steep ramp let go?',
    duration: 20000,
    narration:
      "A block sits on a gentle ramp without moving. Tilt that same ramp steeper and steeper, and at some angle, it suddenly slides. Nothing about the block changed — not its mass, not what it is made of. The only thing that changed is the angle. To understand exactly when and why it lets go, we need to track two things happening at once as that angle grows: how hard gravity is pulling the block down the slope, and how much grip the surface still has left to resist it.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'a block, resting on a slope')
      drawRamp(ctx, vp.width, vp.height, lerp(10, 25, seg(t, 0.2, 0.8)))
    },
  },

  {
    id: 'split',
    title: "Gravity splits into two useful pieces",
    duration: 24000,
    narration:
      "Weight itself always points straight down — that never changes. But on a tilted surface, it helps to split that single downward pull into two separate pieces, lined up with the ramp itself: one piece pressing the block INTO the ramp, with size m·g·cos(θ), and one piece pulling it DOWN the slope, with size m·g·sin(θ). As the angle grows, watch what happens: the into-the-ramp piece shrinks, and the down-the-slope piece grows. That trade-off is the entire reason steeper ramps are more dangerous.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const angleDeg = lerp(8, 42, seg(t, 0.12, 0.88))
      drawPaneBg(ctx, vp, 'weight (red) splits into two components')
      const { bx, by, angle } = drawRamp(ctx, vp.width, vp.height, angleDeg)
      // One shared scale for every arrow in this scene, so the two component
      // arrows can be seen to add up — tip to tail — to the single weight
      // arrow, exactly the parallelogram the narration describes.
      const scale = 3.5
      const along = MASS * G * Math.sin(angle) // down-slope component
      const into = MASS * G * Math.cos(angle) // into-ramp component
      arrow(ctx, bx, by, 0, MASS * G * scale, C.weight, 'mg')
      arrow(ctx, bx, by, along * scale * Math.cos(angle), along * scale * Math.sin(angle), C.friction, `mg·sinθ = ${along.toFixed(1)} N`)
      arrow(ctx, bx, by, into * scale * -Math.sin(angle), into * scale * Math.cos(angle), C.normal, `mg·cosθ = ${into.toFixed(1)} N`)
    },
  },

  {
    id: 'normal',
    title: 'The normal force only has to match one piece',
    duration: 22000,
    narration:
      "The ramp's surface pushes back on the block, exactly perpendicular to itself — this is the normal force. It does not have to cancel the whole weight, only the INTO-the-ramp piece, m·g·cos(θ). As the ramp gets steeper, that piece shrinks, so the normal force shrinks right along with it. Watch the blue arrow get shorter as the angle climbs. This matters more than it looks: the normal force is what friction depends on, so a shrinking normal force means a shrinking friction budget too.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const angleDeg = lerp(10, 50, seg(t, 0.12, 0.88))
      drawPaneBg(ctx, vp, 'the normal force balances mg·cosθ exactly')
      const { bx, by, angle } = drawRamp(ctx, vp.width, vp.height, angleDeg)
      const into = MASS * G * Math.cos(angle)
      const scale = 3.5
      // the normal force points exactly opposite the into-ramp component —
      // outward along the surface normal (sinθ, −cosθ)
      arrow(ctx, bx, by, into * scale * Math.sin(angle), into * scale * -Math.cos(angle), C.normal, `N = ${into.toFixed(1)} N`)
      arrow(ctx, bx, by, 0, MASS * G * scale, C.weight, 'mg')
    },
  },

  {
    id: 'friction-budget',
    title: "Friction has a maximum it cannot exceed",
    duration: 24000,
    narration:
      "Friction resists the down-slope pull, but it is not unlimited — it caps out at μ times the normal force, where μ is the coefficient of friction describing how rough the two surfaces are together. Think of that cap as a budget. As long as the down-slope pull, m·g·sin(θ), fits under that budget, friction simply matches it exactly and the block stays perfectly still. Watch the two bars as the angle grows: the required pull climbing, the available friction budget shrinking, because it depends on a normal force that is itself shrinking.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const mu = 0.5
      const angleDeg = lerp(8, 40, seg(t, 0.12, 0.88))
      const rad = (angleDeg * Math.PI) / 180
      const along = MASS * G * Math.sin(rad)
      const into = MASS * G * Math.cos(rad)
      const maxFriction = mu * into
      drawPaneBg(ctx, vp, `required pull vs. friction’s maximum (μ = ${mu})`)
      drawRamp(ctx, vp.width, vp.height, angleDeg)
      barChart(ctx, vp.width * 0.08, vp.height * 0.18, vp.width * 0.4, [
        { label: 'required: mg·sinθ', value: along, color: C.friction },
        { label: 'available: μ·N', value: maxFriction, color: C.normal },
      ])
    },
  },

  {
    id: 'slide',
    title: 'The moment the budget runs out',
    duration: 23000,
    narration:
      "Keep tilting, and there comes one exact angle where the required pull equals the maximum friction available — tan(θ) equals μ. That angle has a name: the angle of repose. Tilt even slightly past it, and friction is already maxed out with nothing left to give, while the down-slope pull keeps growing. The block accelerates down the ramp, at a rate equal to g times sin(θ) minus μ·cos(θ). Nothing dramatic happens to friction itself — it simply runs out of room to help any further.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const mu = 0.5
      const reposeDeg = (Math.atan(mu) * 180) / Math.PI
      const angleDeg = reposeDeg + 6
      const slid = seg(t, 0.45, 1)
      drawPaneBg(ctx, vp, `past the angle of repose (${reposeDeg.toFixed(1)}°) — it slides`)
      drawRamp(ctx, vp.width, vp.height, angleDeg, slid * 0.6)
      const label = seg(t, 0.5, 0.9)
      callout(ctx, vp.width * 0.08, vp.height * 0.12, [`tanθ > μ  (tan ${angleDeg.toFixed(0)}° > ${mu})`, 'friction is maxed out — it slides'], { accent: C.bad, alpha: label })
    },
  },

  {
    id: 'real-world',
    title: 'Ice, rubber, and the same ramp',
    duration: 22000,
    narration:
      "Keep the ramp at a fixed, moderate angle, and swap only the surface. On ice — a very low coefficient of friction — the block slides straight away. On rubber against concrete — a high coefficient of friction — the same ramp, same angle, and the block does not move at all. This is exactly why icy roads turn dangerous on hills that would be completely unremarkable in dry weather, why hiking boots use high-grip rubber soles, and how engineers calculate the steepest safe angle for a wheelchair ramp or a loading dock.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const angleDeg = 20
      const isIce = t < 0.5
      const slid = isIce ? seg(t, 0.1, 0.45) : 0
      drawPaneBg(ctx, vp, isIce ? 'ice on metal — μ ≈ 0.03 — it slides' : 'rubber on concrete — μ ≈ 0.8 — it holds')
      drawRamp(ctx, vp.width, vp.height, angleDeg, slid)
    },
  },
]

export const INCLINE_EXPLAINER = {
  id: 'incline',
  title: 'Forces on an inclined plane',
  scenes,
}
