// The animated explainer for circuit conductivity.
//
// No x-y graph in this one — conductivity is not a curve, it is a property of
// a material. So every scene is a small cartoon circuit: battery, wires, a
// bulb, and a gap where a material gets swapped in. The one borrowed idea
// from the maths explainers is the same honesty principle: nothing here is
// just asserted. The bulb's brightness is driven by the exact same "ease
// toward a target" formula the interactive lab itself uses, so what plays
// here is a preview of the real thing, not a simplified cartoon of it.

const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)))
const lerp = (a, b, t) => a + (b - a) * t

const C = {
  wire: 'rgba(234, 242, 255, 0.5)',
  copper: '#f0a500',
  bulbOff: 'rgba(234, 242, 255, 0.12)',
  ink: 'rgba(234, 242, 255, 0.92)',
  cyan: '#38d9f8',
  bad: '#ff5d5d',
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

// The circuit diagram every scene shares: battery (left) — wire up and over —
// bulb (top) — wire down to a gap (right) — wire back to the battery. The gap
// is where a material gets swapped in.
function drawCircuitBase(ctx, w, h) {
  const left = w * 0.18
  const right = w * 0.82
  const top = h * 0.22
  const bottom = h * 0.82
  const midX = w * 0.5

  ctx.save()
  ctx.strokeStyle = C.wire
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(left, bottom)
  ctx.lineTo(left, top)
  ctx.lineTo(midX - 26, top)
  ctx.moveTo(midX + 26, top)
  ctx.lineTo(right, top)
  ctx.lineTo(right, bottom * 0.62)
  ctx.stroke()

  // battery symbol, bottom-left
  ctx.beginPath()
  ctx.moveTo(left - 16, bottom)
  ctx.lineTo(left + 16, bottom)
  ctx.moveTo(left, bottom)
  ctx.lineTo(left, bottom + 28)
  ctx.lineTo(midX, bottom + 28)
  ctx.stroke()
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(left - 9, bottom + 10)
  ctx.lineTo(left - 9, bottom + 18)
  ctx.stroke()
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(left + 9, bottom + 6)
  ctx.lineTo(left + 9, bottom + 22)
  ctx.stroke()

  ctx.restore()
  return { left, right, top, bottom, midX }
}

function drawBulb(ctx, cx, cy, brightness) {
  ctx.save()
  const glow = 6 + brightness * 34
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glow)
  grad.addColorStop(0, `rgba(255, 221, 120, ${0.1 + brightness * 0.75})`)
  grad.addColorStop(1, 'rgba(255, 221, 120, 0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(cx, cy, glow, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = C.wire
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, 16, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = `rgba(255, 221, 120, ${0.15 + brightness * 0.75})`
  ctx.beginPath()
  ctx.arc(cx, cy, 16, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = `rgba(90, 60, 10, ${0.4 + brightness * 0.4})`
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(cx - 6, cy + 6)
  ctx.lineTo(cx - 2, cy - 5)
  ctx.lineTo(cx + 3, cy + 4)
  ctx.lineTo(cx + 7, cy - 6)
  ctx.stroke()
  ctx.restore()
}

// The gap where a material is tested, plus the material drawn inside it.
function drawGap(ctx, right, top, bottom, kind, electronPhase) {
  const gapY0 = top
  const gapY1 = bottom * 0.62
  const gx = right

  ctx.save()
  if (kind === 'none') {
    ctx.strokeStyle = 'rgba(255, 93, 93, 0.55)'
    ctx.lineWidth = 3
    ctx.setLineDash([3, 5])
    ctx.beginPath()
    ctx.moveTo(gx, gapY0 + 10)
    ctx.lineTo(gx, gapY1 - 10)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
    return
  }

  const w = 26
  ctx.fillStyle = kind === 'conductor' ? 'rgba(0, 229, 195, 0.18)' : kind === 'partial' ? 'rgba(240, 165, 0, 0.16)' : 'rgba(139, 92, 246, 0.12)'
  ctx.strokeStyle = kind === 'conductor' ? 'rgba(0, 229, 195, 0.7)' : kind === 'partial' ? 'rgba(240, 165, 0, 0.6)' : 'rgba(139, 92, 246, 0.5)'
  ctx.lineWidth = 1.6
  roundRectPath(ctx, gx - w / 2, gapY0 + 6, w, gapY1 - gapY0 - 12, 6)
  ctx.fill()
  ctx.stroke()

  // free electrons drift (conductor/partial) or sit locked in place (insulator)
  const n = kind === 'conductor' ? 7 : kind === 'partial' ? 4 : 5
  for (let i = 0; i < n; i += 1) {
    const baseY = lerp(gapY0 + 14, gapY1 - 14, i / Math.max(1, n - 1))
    const drift = kind === 'insulator' ? 0 : Math.sin(electronPhase * 2 + i) * (kind === 'conductor' ? 7 : 3)
    ctx.fillStyle = kind === 'conductor' ? '#00e5c3' : kind === 'partial' ? '#f0a500' : 'rgba(234, 242, 255, 0.4)'
    ctx.beginPath()
    ctx.arc(gx + drift, baseY, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

const scenes = [
  {
    id: 'question',
    title: 'One gap, one dark bulb',
    duration: 19000,
    narration:
      "Here is the simplest possible circuit: a battery, a bulb, and a loop of wire — except the loop has a gap in it. The bulb is dark. Not dim, not flickering — completely dark, because a circuit is a single continuous loop, and a single break anywhere stops current everywhere, the same way cutting one link breaks an entire chain. The question for this lab is simple: what has to be true about whatever goes into that gap for the bulb to light up again?",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const w = vp.width
      const h = vp.height
      drawPaneBackground(ctx, vp, 'a broken loop — the bulb cannot light')
      const { right, top, bottom, midX } = drawCircuitBase(ctx, w, h)
      drawBulb(ctx, midX, top, 0)
      drawGap(ctx, right, top, bottom, 'none', t * 4)
      const label = seg(t, 0.5, 0.85)
      callout(ctx, w * 0.12, h * 0.68, ['a complete LOOP is required', '— one gap stops it everywhere'], { accent: C.bad, alpha: label })
    },
  },

  {
    id: 'conductor',
    title: 'A sea of free electrons closes the loop',
    duration: 23000,
    narration:
      "Slide a strip of copper into the gap. The bulb lights up immediately, and brightly. Copper is a conductor, which means its outer electrons are not locked to any single atom — they form a loose, shared sea of charge that can drift together whenever the battery pushes. That drifting sea is the current. The battery does not create electrons from nothing; it simply gives the ones already present in the wire a shove, and because the loop is now complete, that shove travels all the way around.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const w = vp.width
      const h = vp.height
      const bright = seg(t, 0.2, 0.55)
      drawPaneBackground(ctx, vp, 'copper — a sea of free electrons')
      const { right, top, bottom, midX } = drawCircuitBase(ctx, w, h)
      drawBulb(ctx, midX, top, bright)
      drawGap(ctx, right, top, bottom, 'conductor', t * 5)
      const label = seg(t, 0.6, 1)
      callout(ctx, w * 0.1, h * 0.1, ['free electrons drift together', 'under the battery’s push'], { accent: '#00e5c3', alpha: label })
    },
  },

  {
    id: 'insulator',
    title: 'Locked electrons, no current',
    duration: 35000,
    narration:
      "Now swap in a strip of rubber instead. The bulb goes dark again, instantly — not because the loop is open this time, but because rubber has no free charge to drift. Every one of its electrons is tightly locked to its own atom or molecule, with none left over to carry a current. That is what makes something an insulator: not an absence of electrons, but an absence of FREE ones. It is exactly why electrical wires are copper on the inside and rubber or plastic on the outside — one layer carries the current, the other guarantees it stays inside the wire.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const w = vp.width
      const h = vp.height
      drawPaneBackground(ctx, vp, 'rubber — every electron stays locked in place')
      const { right, top, bottom, midX } = drawCircuitBase(ctx, w, h)
      drawBulb(ctx, midX, top, 0)
      drawGap(ctx, right, top, bottom, 'insulator', 0)
      const label = seg(t, 0.4, 0.8)
      callout(ctx, w * 0.08, h * 0.1, ['no free charge to carry current', '— the bulb stays dark'], { accent: C.bad, alpha: label })
    },
  },

  {
    id: 'partial',
    title: 'Some materials sit in between',
    duration: 23000,
    narration:
      "Not everything is purely one or the other. Slide in a strip of graphite and the bulb glows — dimly. Graphite does conduct, but its charge carriers move with much more difficulty than copper's, so less current gets through and the bulb only half-lights. Try saltwater next, and it conducts too — but not with electrons at all. The dissolved salt splits into charged sodium and chlorine ions, and THOSE ions drift through the liquid and carry the current instead. Two completely different carriers, the same basic idea: something has to be free to move.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const w = vp.width
      const h = vp.height
      const bright = 0.4
      drawPaneBackground(ctx, vp, 'graphite — weaker carriers, a dimmer bulb')
      const { right, top, bottom, midX } = drawCircuitBase(ctx, w, h)
      drawBulb(ctx, midX, top, bright)
      drawGap(ctx, right, top, bottom, 'partial', t * 2.5)
      const label = seg(t, 0.5, 0.9)
      callout(ctx, w * 0.08, h * 0.1, ['conducts, but weakly', '— this is RESISTANCE'], { accent: '#f0a500', alpha: label })
    },
  },

  {
    id: 'brightness-scale',
    title: 'Brightness is conductivity, made visible',
    duration: 25000,
    narration:
      "Line every material up on one scale from zero to one, and the bulb's brightness traces it exactly: copper and aluminium sit near the top, barely dimmer than a perfect conductor; graphite and saltwater sit in the middle, glowing but clearly weaker; and distilled water sits so close to zero it barely registers at all. The bulb does not snap between on and off — its brightness eases smoothly toward whatever the current material allows, which is exactly how a real filament actually responds, warming up and cooling down rather than flicking instantly.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const w = vp.width
      const h = vp.height
      drawPaneBackground(ctx, vp, 'conductivity, 0 to 1 — the bulb tracks it smoothly')

      const materials = [
        { label: 'copper', value: 1.0 },
        { label: 'aluminium', value: 0.9 },
        { label: 'graphite', value: 0.35 },
        { label: 'saltwater', value: 0.5 },
        { label: 'distilled water', value: 0.04 },
        { label: 'wood', value: 0 },
      ]
      const idx = Math.min(materials.length - 1, Math.floor(t * materials.length))
      const m = materials[idx]
      const localT = seg(t, idx / materials.length, (idx + 0.8) / materials.length)
      const bright = lerp(0, m.value, Math.min(1, localT * 3))

      const { midX, top } = drawCircuitBase(ctx, w, h)
      drawBulb(ctx, midX, top, bright)

      const barX = w * 0.12
      const barY = h * 0.72
      const barW = w * 0.76
      ctx.save()
      ctx.strokeStyle = 'rgba(234,242,255,0.25)'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(barX, barY)
      ctx.lineTo(barX + barW, barY)
      ctx.stroke()
      ctx.strokeStyle = '#00e5c3'
      ctx.beginPath()
      ctx.moveTo(barX, barY)
      ctx.lineTo(barX + barW * m.value, barY)
      ctx.stroke()
      ctx.fillStyle = 'rgba(234,242,255,0.9)'
      ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${m.label}  —  conductivity ${m.value.toFixed(2)}`, w / 2, barY + 28)
      ctx.restore()
    },
  },

  {
    id: 'real-world',
    title: 'Why your wires look the way they do',
    duration: 32000,
    narration:
      "This is the whole reason a household electrical cable is built the way it is: a copper core to carry the current efficiently, wrapped in a rubber or plastic sheath to make sure that current goes nowhere except where it is wanted. It is why electricians wear rubber-soled boots and rubber gloves — insulation between them and a live wire. And it is why saltwater is treated as genuinely dangerous near electronics, even though pure water barely conducts at all: it is never really the water itself, it is what is dissolved in it.",
    view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
    draw(ctx, stage, t) {
      const { vp } = stage
      const w = vp.width
      const h = vp.height
      drawPaneBackground(ctx, vp, 'a real wire, in cross-section')

      const cx = w * 0.5
      const cy = h * 0.5
      const outerR = Math.min(w, h) * 0.3
      const innerR = outerR * 0.42
      ctx.save()
      ctx.fillStyle = 'rgba(234, 242, 255, 0.14)'
      ctx.strokeStyle = 'rgba(234, 242, 255, 0.4)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#f0a500'
      ctx.beginPath()
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      const label1 = seg(t, 0.25, 0.55)
      const label2 = seg(t, 0.55, 0.85)
      callout(ctx, cx + outerR + 14, cy - 40, ['rubber / plastic', 'an insulating sheath'], { accent: 'rgba(234,242,255,0.6)', alpha: label1 })
      callout(ctx, cx - 70, cy + outerR * 0.3, ['copper core', 'carries the current'], { accent: '#f0a500', align: 'right', alpha: label2 })
    },
  },
]

// Local re-import of drawPaneBackground only — this file uses a dummy 0..1
// viewport purely for its background box + label, matching the convention
// established for free-form cartoon scenes elsewhere in this unit.
function drawPaneBackground(ctx, vp, label) {
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

export const CIRCUIT_EXPLAINER = {
  id: 'circuit',
  title: 'Conductors, insulators, and everything in between',
  scenes,
}
