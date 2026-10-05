// The animated explainer for the simple pendulum.
//
// Every swing drawn here uses the exact small-angle formula the interactive
// lab itself uses — θ(t) = θ₀·cos(ωt), ω = √(g/L) — so a pendulum that looks
// like it is swinging twice as fast in this explainer really does have twice
// the angular frequency, not just a faster-looking animation.

const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)))

const C = { bob: '#f0a500', string: 'rgba(234, 242, 255, 0.5)', ke: '#1f6feb', pe: '#f0a500', ink: 'rgba(234, 242, 255, 0.92)', cyan: '#38d9f8' }

const GRAVITIES = { earth: 9.81, moon: 1.62, mars: 3.72, jupiter: 24.79 }

function period(L, g) {
  return 2 * Math.PI * Math.sqrt(L / g)
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

// Draws one pendulum at angle `theta` (radians, 0 = hanging straight down),
// pivoted at (px, py), with a given string length (pixels) and bob radius
// (pixels, purely cosmetic — never affects the physics).
function drawPendulum(ctx, px, py, theta, stringLen, bobR, color = C.bob) {
  const bx = px + stringLen * Math.sin(theta)
  const by = py + stringLen * Math.cos(theta)
  ctx.save()
  ctx.strokeStyle = 'rgba(234, 242, 255, 0.35)'
  ctx.lineWidth = 1.2
  ctx.setLineDash([3, 4])
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(px, py + stringLen + bobR)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = 'rgba(234,242,255,0.5)'
  ctx.beginPath()
  ctx.arc(px, py, 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = C.string
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(bx, by)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(bx, by, bobR, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
  return { bx, by }
}

function energyBars(ctx, x, y, w, barH, keFrac) {
  const peFrac = 1 - keFrac
  ctx.save()
  ctx.fillStyle = 'rgba(234,242,255,0.15)'
  ctx.fillRect(x, y, w, barH)
  ctx.fillRect(x, y + barH + 8, w, barH)
  ctx.fillStyle = C.ke
  ctx.fillRect(x, y, w * keFrac, barH)
  ctx.fillStyle = C.pe
  ctx.fillRect(x, y + barH + 8, w * peFrac, barH)
  ctx.fillStyle = 'rgba(234,242,255,0.85)'
  ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textAlign = 'left'
  ctx.fillText(`KE ${(keFrac * 100).toFixed(0)}%`, x, y - 4)
  ctx.fillText(`PE ${(peFrac * 100).toFixed(0)}%`, x, y + barH + 4)
  ctx.restore()
}

const scenes = [
  {
    id: 'question',
    title: 'Two bobs, two different masses',
    duration: 20000,
    narration:
      "Here are two pendulums, hung from strings of the exact same length — but one bob is far heavier than the other. Release them from the same angle, at the same moment. Before you watch them swing: which one do you expect to swing faster? Gravity pulls harder on the heavier one, so it seems like it should win the race. Watch closely, and see if that is actually what happens.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'same length, same angle — different mass')
      const L = 9.81
      const theta0 = 0.5
      const omega = Math.sqrt(9.81 / L)
      const theta = theta0 * Math.cos(omega * t * 3)
      const stringLen = vp.height * 0.42
      const py = vp.height * 0.16
      drawPendulum(ctx, vp.width * 0.32, py, theta, stringLen, 10, '#8b5cf6')
      drawPendulum(ctx, vp.width * 0.68, py, theta, stringLen, 20, '#f0a500')
      const label = seg(t, 0.55, 0.9)
      callout(ctx, vp.width * 0.08, vp.height * 0.78, ['light bob', 'heavy bob', '— which wins?'], { accent: C.cyan, alpha: label })
    },
  },

  {
    id: 'mass-cancels',
    title: 'The two effects cancel exactly',
    duration: 25000,
    narration:
      "They swing together, perfectly in step, the entire time. This is not a coincidence — it is the same reason a heavier object does not fall faster than a lighter one. Gravity does pull harder on the heavier bob, but that same bob also resists being accelerated more, exactly in proportion to its extra mass. Those two effects — a bigger pull, and a bigger resistance to that pull — cancel each other out perfectly, every time. Mass genuinely does not appear anywhere in the formula for a pendulum's period.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'mass cancels — identical motion, different weight')
      const L = 9.81
      const theta0 = 0.5
      const omega = Math.sqrt(9.81 / L)
      const theta = theta0 * Math.cos(omega * t * 6)
      const stringLen = vp.height * 0.42
      const py = vp.height * 0.16
      drawPendulum(ctx, vp.width * 0.32, py, theta, stringLen, 10, '#8b5cf6')
      drawPendulum(ctx, vp.width * 0.68, py, theta, stringLen, 20, '#f0a500')
      const label = seg(t, 0.3, 0.7)
      callout(ctx, vp.width * 0.22, vp.height * 0.78, ['T = 2π√(L ⁄ g)', '— no mass anywhere'], { accent: '#2fe08d', alpha: label })
    },
  },

  {
    id: 'length',
    title: 'Length matters — but only by its square root',
    duration: 24000,
    narration:
      "Now keep the mass fixed and change the string length instead. A longer pendulum does swing more slowly — but not in direct proportion. Double the length, and the period only grows by the square root of two, about one point four one times, not two times. Quadruple the length, and NOW the period doubles. That square-root relationship is baked directly into the formula, and it is why clock-makers can fine-tune a pendulum clock's rate with a tiny adjustment to its length, rather than a large one.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'double the length → period × √2, not × 2')
      const g = 9.81
      const shortL = 0.6
      const longL = 1.2
      const omegaShort = Math.sqrt(g / shortL)
      const omegaLong = Math.sqrt(g / longL)
      const theta0 = 0.5
      const py = vp.height * 0.1
      const shortLen = vp.height * 0.32
      const longLen = vp.height * 0.64
      const thetaShort = theta0 * Math.cos(omegaShort * t * 5)
      const thetaLong = theta0 * Math.cos(omegaLong * t * 5)
      drawPendulum(ctx, vp.width * 0.3, py, thetaShort, shortLen, 12, '#38d9f8')
      drawPendulum(ctx, vp.width * 0.72, py, thetaLong, longLen, 12, '#8b5cf6')
      const label = seg(t, 0.55, 0.9)
      callout(ctx, vp.width * 0.08, vp.height * 0.85, [
        `short: T = ${period(shortL, g).toFixed(2)} s`,
        `long (2×L): T = ${period(longL, g).toFixed(2)} s  (×${(period(longL, g) / period(shortL, g)).toFixed(3)})`,
      ], { accent: C.cyan, alpha: label })
    },
  },

  {
    id: 'gravity',
    title: 'The same pendulum, four worlds',
    duration: 24000,
    narration:
      "Keep the string length and the mass fixed, and change only the planet. On the Moon, where gravity is roughly a sixth of Earth's, the same pendulum swings noticeably slower — weaker gravity means a weaker restoring pull every time it swings away from the bottom. On Jupiter, with far stronger gravity, the same pendulum swings noticeably faster. Gravity sits in the denominator, under the square root — so a bigger g always means a shorter period, and a smaller g always means a longer one.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'same L, same mass — different gravity')
      const L = 1
      const theta0 = 0.5
      const planets = Object.entries(GRAVITIES)
      const idx = Math.min(planets.length - 1, Math.floor(t * planets.length))
      const [name, g] = planets[idx]
      const omega = Math.sqrt(g / L)
      const localT = t - idx / planets.length
      const theta = theta0 * Math.cos(omega * localT * planets.length * 6)
      const stringLen = vp.height * 0.46
      const py = vp.height * 0.14
      drawPendulum(ctx, vp.width * 0.5, py, theta, stringLen, 14)
      callout(ctx, vp.width * 0.08, vp.height * 0.8, [`${name}:  g = ${g.toFixed(2)} m/s²`, `T = 2π√(1/${g.toFixed(2)}) = ${period(L, g).toFixed(2)} s`], { accent: C.cyan })
    },
  },

  {
    id: 'energy',
    title: 'Energy trades back and forth, never lost',
    duration: 23000,
    narration:
      "Watch one swing in slow motion and track two quantities: kinetic energy, the energy of motion, and gravitational potential energy, the energy of height. At the very bottom of the swing, the bob moves at its fastest — all kinetic, almost no potential. At the very top of each side, the bob is momentarily still — all potential, no kinetic at all. Add the two together at any instant during the swing, ignoring air resistance, and the total never changes. The pendulum is not losing energy; it is simply trading one form for the other, continuously.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'kinetic ⇄ potential — the total stays constant')
      const L = 9.81
      const theta0 = 0.6
      const omega = Math.sqrt(9.81 / L)
      const theta = theta0 * Math.cos(omega * t * 6)
      const keFrac = (Math.cos(theta) - Math.cos(theta0)) / (1 - Math.cos(theta0))
      const stringLen = vp.height * 0.42
      drawPendulum(ctx, vp.width * 0.3, vp.height * 0.1, theta, stringLen, 14)
      energyBars(ctx, vp.width * 0.58, vp.height * 0.22, vp.width * 0.32, 16, Math.max(0, Math.min(1, keFrac)))
    },
  },

  {
    id: 'real-world',
    title: 'Clocks and the ground shaking beneath them',
    duration: 32000,
    narration:
      "This formula is not just classroom physics. A pendulum clock keeps time using exactly this period, and jewellers adjust its rate with a tiny screw that changes the bob's effective length by a fraction of a millimetre — never by changing its weight, because that would do nothing at all. The same idea, flipped around, is at the heart of some seismometers: a heavy pendulum suspended with a very long natural period barely moves when the ground shakes suddenly, and that lag between the swinging mass and the shaking ground is exactly what gets measured.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      drawPaneBg(ctx, vp, 'a pendulum clock, ticking')
      const L = 1
      const g = 9.81
      const theta0 = 0.35
      const omega = Math.sqrt(g / L)
      const theta = theta0 * Math.cos(omega * t * 6)
      drawPendulum(ctx, vp.width * 0.5, vp.height * 0.12, theta, vp.height * 0.55, 13)
      const label = seg(t, 0.4, 0.8)
      callout(ctx, vp.width * 0.1, vp.height * 0.82, ['a 1-metre pendulum on Earth', `ticks once every ${(period(L, g) / 2).toFixed(2)} s`], { accent: C.cyan, alpha: label })
    },
  },
]

export const PENDULUM_EXPLAINER = {
  id: 'pendulum',
  title: 'Why mass does not matter, but length and gravity do',
  scenes,
}
