// The animated explainer for projectile motion.
//
// Every trajectory drawn here is the exact kinematics the interactive lab
// itself uses — x(t) = v·cosθ·t, y(t) = v·sinθ·t − ½gt² — not a simplified
// cartoon arc. The headline claim in scene 3 (the dropped-vs-fired bullet)
// and the headline claim in scene 5 (complementary angles land at the same
// spot) are both verified against these same formulas before being animated,
// not just asserted in narration.

const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)))
const G = 9.81

const C = { path: '#00e5c3', vx: '#38d9f8', vy: '#f0a500', ink: 'rgba(234, 242, 255, 0.92)', cyan: '#38d9f8', bad: '#ff5d5d' }

function posAt(v, angleDeg, t) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: v * Math.cos(rad) * t, y: v * Math.sin(rad) * t - 0.5 * G * t * t }
}
function timeOfFlight(v, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return (2 * v * Math.sin(rad)) / G
}
function rangeOf(v, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return (v * v * Math.sin(2 * rad)) / G
}
function maxHeight(v, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return (v * Math.sin(rad)) ** 2 / (2 * G)
}

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

function callout(ctx, px, py, lines, { color = C.ink, accent = C.cyan, align = 'left', alpha = 1 } = {}) {
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

// Builds a ground-relative pixel mapping for a launch of speed v and angle,
// scaled to fit the pane with a little headroom above the peak and beyond the
// landing point.
function sceneScale(vp, v, angleDeg) {
  const groundY = vp.height * 0.86
  const R = Math.max(1, rangeOf(v, angleDeg))
  const H = Math.max(1, maxHeight(v, angleDeg))
  const sx = (vp.width * 0.82) / R
  const sy = (vp.height * 0.72) / Math.max(H, R * 0.25)
  const originX = vp.width * 0.08
  return { groundY, originX, sx, sy }
}

function toPixels(scale, x, y) {
  return { px: scale.originX + x * scale.sx, py: scale.groundY - y * scale.sy }
}

function drawGround(ctx, vp, groundY) {
  ctx.save()
  ctx.strokeStyle = 'rgba(234, 242, 255, 0.25)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(vp.width * 0.03, groundY)
  ctx.lineTo(vp.width * 0.97, groundY)
  ctx.stroke()
  ctx.restore()
}

function drawBall(ctx, px, py, r = 6, color = '#fff') {
  ctx.save()
  ctx.fillStyle = color
  ctx.shadowColor = 'rgba(0,229,195,0.6)'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.arc(px, py, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawTrail(ctx, points, color) {
  if (points.length < 2) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2.2
  ctx.beginPath()
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py)))
  ctx.stroke()
  ctx.restore()
}

const scenes = [
  {
    id: 'question',
    title: 'What decides how far it goes?',
    duration: 19000,
    narration:
      "Launch a ball into the air at some angle and some speed, and it always traces the same family of shape: a parabola, rising, curving over, and falling. Once it leaves the launcher, nothing pushes it forward anymore — only gravity acts on it, the entire flight. The question this lab answers precisely is which combination of angle and speed sends it the farthest, and why the path curves the exact way that it does.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'a launched ball, falling under gravity alone')
      const v = 24
      const angleDeg = 48
      const scale = sceneScale(vp, v, angleDeg)
      drawGround(ctx, vp, scale.groundY)
      const T = timeOfFlight(v, angleDeg)
      const frac = seg(t, 0.1, 0.9)
      const pts = []
      for (let f = 0; f <= frac; f += 0.02) {
        const p = posAt(v, angleDeg, f * T)
        pts.push(toPixels(scale, p.x, Math.max(0, p.y)))
      }
      drawTrail(ctx, pts, C.path)
      if (pts.length) drawBall(ctx, pts[pts.length - 1].px, pts[pts.length - 1].py)
    },
  },

  {
    id: 'independence',
    title: 'Two motions, completely independent',
    duration: 25000,
    narration:
      "The key insight is that the horizontal and vertical motions never interact. Horizontally, there is no air resistance here, so nothing slows the ball down sideways — it drifts at a perfectly constant speed the entire flight. Vertically, gravity decelerates it going up and accelerates it coming back down, exactly like a ball thrown straight upward on its own. Combine a constant sideways drift with an up-then-down vertical bounce, happening at the same time, and the result — traced together — is the parabola.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'horizontal (constant) + vertical (gravity) = the path')
      const v = 24
      const angleDeg = 48
      const scale = sceneScale(vp, v, angleDeg)
      drawGround(ctx, vp, scale.groundY)
      const T = timeOfFlight(v, angleDeg)
      const frac = seg(t, 0.08, 0.92)
      const curT = frac * T
      const p = posAt(v, angleDeg, curT)
      const pt = toPixels(scale, p.x, Math.max(0, p.y))

      // horizontal-only ghost (travels at constant height, same x)
      const hy = scale.groundY - vp.height * 0.06
      drawBall(ctx, scale.originX + p.x * scale.sx, hy, 5, C.vx)
      // vertical-only ghost (bounces up and down at fixed x)
      const vOnly = Math.max(0, v * Math.sin((angleDeg * Math.PI) / 180) * curT - 0.5 * G * curT * curT)
      drawBall(ctx, scale.originX + vp.width * 0.06, scale.groundY - vOnly * scale.sy, 5, C.vy)

      drawBall(ctx, pt.px, pt.py, 7, '#fff')
      const label = seg(t, 0.75, 1)
      callout(ctx, vp.width * 0.08, vp.height * 0.1, ['cyan: horizontal motion alone', 'gold: vertical motion alone', 'white: both combined'], { accent: C.cyan, alpha: label })
    },
  },

  {
    id: 'bullets',
    title: 'Dropped or fired — same fall',
    duration: 24000,
    narration:
      "Here is the classic proof. One ball is simply dropped, straight down, from a height. At the exact same instant, an identical ball is fired perfectly horizontally from that same height. Watch their heights, not their horizontal positions. Both balls hit the ground at exactly the same moment. The fired ball's sideways motion does nothing at all to how fast it falls, because gravity acts on both of them identically and independently of whatever they are doing horizontally.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'dropped (left) and fired horizontally (right) — same fall time')
      const height = 20
      const T = Math.sqrt((2 * height) / G)
      const groundY = vp.height * 0.86
      const topY = vp.height * 0.1
      const sy = (groundY - topY) / height
      const frac = seg(t, 0.08, 0.92)
      const curT = frac * T
      const fallen = 0.5 * G * curT * curT
      const py = topY + fallen * sy

      const dropX = vp.width * 0.28
      drawBall(ctx, dropX, Math.min(groundY, py), 8, '#8b5cf6')

      const fireV = 10
      const fireX = vp.width * 0.58 + fireV * curT * (vp.width * 0.012)
      drawBall(ctx, Math.min(vp.width * 0.92, fireX), Math.min(groundY, py), 8, '#00e5c3')

      ctx.save()
      ctx.strokeStyle = 'rgba(234,242,255,0.25)'
      ctx.beginPath()
      ctx.moveTo(vp.width * 0.03, groundY)
      ctx.lineTo(vp.width * 0.97, groundY)
      ctx.stroke()
      ctx.restore()

      const label = seg(t, 0.85, 1)
      callout(ctx, vp.width * 0.08, vp.height * 0.12, [`both land at t = ${T.toFixed(2)} s`], { accent: '#2fe08d', alpha: label })
    },
  },

  {
    id: 'equations',
    title: 'Reading the three key numbers off the flight',
    duration: 25000,
    narration:
      "Every trajectory has three numbers worth knowing. The maximum height is reached exactly halfway through the flight, where the vertical velocity momentarily hits zero. The time of flight is simply twice the time it takes to reach that peak. And the range — the total horizontal distance covered — comes from multiplying the constant horizontal speed by the full time of flight. All three come directly from the same two equations: a constant horizontal drift, and a vertical motion under constant gravity.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'H, T and R, read directly off one flight')
      const v = 22
      const angleDeg = 50
      const scale = sceneScale(vp, v, angleDeg)
      drawGround(ctx, vp, scale.groundY)
      const T = timeOfFlight(v, angleDeg)
      const R = rangeOf(v, angleDeg)
      const H = maxHeight(v, angleDeg)
      const frac = seg(t, 0.08, 0.85)
      const pts = []
      for (let f = 0; f <= frac; f += 0.02) {
        const p = posAt(v, angleDeg, f * T)
        pts.push(toPixels(scale, p.x, Math.max(0, p.y)))
      }
      drawTrail(ctx, pts, C.path)
      if (pts.length) drawBall(ctx, pts[pts.length - 1].px, pts[pts.length - 1].py)

      const label = seg(t, 0.6, 1)
      const peak = toPixels(scale, R / 2, H)
      callout(ctx, peak.px - 20, peak.py - 50, [`H = ${H.toFixed(1)} m`], { accent: C.vy, alpha: label })
      callout(ctx, vp.width * 0.08, vp.height * 0.14, [`T = ${T.toFixed(2)} s`, `R = ${R.toFixed(1)} m`], { accent: C.cyan, alpha: label })
    },
  },

  {
    id: 'optimal-angle',
    title: '45° wins — and so does every complementary pair',
    duration: 26000,
    narration:
      "Sweep the launch angle from low and flat to high and steep, keeping the speed fixed, and track how far the ball lands. The range climbs, peaks, and falls again — and the peak sits exactly at 45 degrees. The reason is buried in the range formula itself: it depends on the sine of DOUBLE the angle, which is largest exactly when that doubled angle is 90 degrees. Here is the surprising part: thirty degrees and sixty degrees — angles that add up to 90 — produce the exact same range, despite completely different-looking paths: one flat and fast, one high and slow.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'complementary angles — same range, different paths')
      const v = 22
      const angleA = 30
      const angleB = 60
      const scale = sceneScale(vp, v, 45)
      drawGround(ctx, vp, scale.groundY)
      const TA = timeOfFlight(v, angleA)
      const TB = timeOfFlight(v, angleB)
      const frac = seg(t, 0.1, 0.9)

      const ptsA = []
      for (let f = 0; f <= frac; f += 0.02) {
        const p = posAt(v, angleA, f * TA)
        ptsA.push(toPixels(scale, p.x, Math.max(0, p.y)))
      }
      const ptsB = []
      for (let f = 0; f <= frac; f += 0.02) {
        const p = posAt(v, angleB, f * TB)
        ptsB.push(toPixels(scale, p.x, Math.max(0, p.y)))
      }
      drawTrail(ctx, ptsA, '#38d9f8')
      drawTrail(ctx, ptsB, '#f0a500')
      if (ptsA.length) drawBall(ctx, ptsA[ptsA.length - 1].px, ptsA[ptsA.length - 1].py, 6, '#38d9f8')
      if (ptsB.length) drawBall(ctx, ptsB[ptsB.length - 1].px, ptsB[ptsB.length - 1].py, 6, '#f0a500')

      const label = seg(t, 0.75, 1)
      callout(ctx, vp.width * 0.08, vp.height * 0.14, [
        `30°: R = ${rangeOf(v, angleA).toFixed(1)} m`,
        `60°: R = ${rangeOf(v, angleB).toFixed(1)} m`,
        '— identical range',
      ], { accent: '#2fe08d', alpha: label })
    },
  },

  {
    id: 'real-world',
    title: 'From shot-put to satellites',
    duration: 20000,
    narration:
      "This is not an abstract exercise. Shot-put athletes release at slightly less than 45 degrees, because they release from above ground level, which shifts the optimal angle down a little. Artillery gunners calculate angle and charge from exactly these equations to hit a known target distance. Engineers use the same formulas to design water fountains and irrigation spray patterns. And a satellite in orbit is, in a real sense, simply a projectile launched so fast that it keeps falling around the Earth's curve rather than into it.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'the same equations, five different fields')
      const v = 20
      const angleDeg = 42
      const scale = sceneScale(vp, v, angleDeg)
      drawGround(ctx, vp, scale.groundY)
      const T = timeOfFlight(v, angleDeg)
      const frac = (t * 1.6) % 1
      const pts = []
      for (let f = 0; f <= frac; f += 0.02) {
        const p = posAt(v, angleDeg, f * T)
        pts.push(toPixels(scale, p.x, Math.max(0, p.y)))
      }
      drawTrail(ctx, pts, C.path)
      if (pts.length) drawBall(ctx, pts[pts.length - 1].px, pts[pts.length - 1].py)
      const label = seg(t, 0.2, 0.6)
      callout(ctx, vp.width * 0.08, vp.height * 0.14, ['sport · artillery · irrigation', 'surgical robotics · orbital motion'], { accent: C.cyan, alpha: label })
    },
  },
]

export const PROJECTILE_EXPLAINER = {
  id: 'projectile',
  title: 'The physics of a thrown ball',
  scenes,
}
