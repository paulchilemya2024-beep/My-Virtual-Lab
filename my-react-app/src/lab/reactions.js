// Reaction engine for the virtual chemistry lab.
//
// This is intentionally a *teaching* model, not a rigorous physical-chemistry
// solver. It tracks how much of each reagent is in the flask and derives the
// observable state a student would actually see: pH, the solution colour
// (including indicator response), precipitates, gas/effervescence, heat, and
// dangerous combinations.
//
// The engine is pure: `addChemical` returns a brand-new accumulator plus the
// derived, render-ready state and a list of one-shot `events` (pour, fizz,
// hiss, precipitate, endpoint, danger) that the UI turns into sound + visuals.

import { CATEGORY, getChemical, hexToRgb } from './chemicals.js'

export const AMBIENT_TEMP = 22
const DANGER_TEMP = 80

// ── Colour helpers ───────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t
}
function lerpColor(c1, c2, t) {
  return { r: lerp(c1.r, c2.r, t), g: lerp(c1.g, c2.g, t), b: lerp(c1.b, c2.b, t) }
}
// Sample a colour from an ordered list of [position, hex] stops.
function sampleStops(stops, x) {
  if (x <= stops[0][0]) return hexToRgb(stops[0][1])
  const last = stops[stops.length - 1]
  if (x >= last[0]) return hexToRgb(last[1])
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, h0] = stops[i]
    const [p1, h1] = stops[i + 1]
    if (x >= p0 && x <= p1) {
      const t = (x - p0) / (p1 - p0)
      return lerpColor(hexToRgb(h0), hexToRgb(h1), t)
    }
  }
  return hexToRgb(last[1])
}

const WATER = { r: 224, g: 240, b: 250 } // faint watery tint for colourless solutions

// Indicator colour as a function of pH. Returns { rgb, alpha } or null when the
// indicator is effectively colourless (so the underlying solution shows through).
function indicatorColor(kind, ph) {
  if (kind === 'phenolphthalein') {
    // Colourless in acid/neutral; magenta-pink above ~8.2, deepening to ~10.
    if (ph < 8.2) return null
    const t = Math.min(1, (ph - 8.2) / 1.8)
    return { rgb: hexToRgb('#e91e8c'), alpha: 0.25 + t * 0.6 }
  }
  if (kind === 'litmus') {
    // Red (acid) → purple (neutral) → blue (alkali).
    const rgb = sampleStops(
      [
        [3, '#d83a2a'],
        [6, '#9b3fb0'],
        [7, '#7a4ea3'],
        [8, '#5a52c0'],
        [11, '#2a5fd8'],
      ],
      ph,
    )
    return { rgb, alpha: 0.7 }
  }
  if (kind === 'universal') {
    // Full pH rainbow: red→orange→yellow→green→blue→purple.
    const rgb = sampleStops(
      [
        [1, '#e23b2a'],
        [3, '#e23b2a'],
        [4.5, '#ef7d1a'],
        [6, '#f4d000'],
        [7, '#3cb043'],
        [8.5, '#2a6fd8'],
        [10, '#6a2fb0'],
        [13, '#4a1d80'],
      ],
      ph,
    )
    return { rgb, alpha: 0.78 }
  }
  return null
}

// ── pH from accumulated strong acid / base ────────────────────────────────────
function computePH(molesAcid, molesBase, totalVolume) {
  if (totalVolume <= 0) return 7
  const net = molesAcid - molesBase // mmol; >0 acidic, <0 basic
  const conc = Math.abs(net) / totalVolume // mol/L (mmol/mL)
  if (conc < 1e-7) return 7
  if (net > 0) return Math.max(0.2, Math.min(7, -Math.log10(conc)))
  const pOH = -Math.log10(conc)
  return Math.min(13.8, Math.max(7, 14 - pOH))
}

// ── Empty / fresh flask ───────────────────────────────────────────────────────
export function createState(startTemp = AMBIENT_TEMP) {
  const acc = {
    contents: {}, // id -> volume (mL)
    molesAcid: 0, // mmol H+
    molesBase: 0, // mmol OH-
    totalVolume: 0,
    temp: startTemp,
  }
  return { acc, derived: derive(acc) }
}

function present(acc, id) {
  return (acc.contents[id] || 0) > 0
}
function amount(acc, id) {
  return acc.contents[id] || 0
}
function hasCategory(acc, cat) {
  return Object.keys(acc.contents).some(
    (id) => (acc.contents[id] || 0) > 0 && getChemical(id).category === cat,
  )
}

// Detect precipitation reactions. Each consumes some of a coloured solute, which
// we report via `consumed` so the dissolved-colour calc can subtract it.
function detectPrecipitates(acc) {
  const out = []
  const consumed = {}
  const pairs = [
    { a: 'Silver nitrate', b: 'Sodium chloride', color: '#f4f4f8', consume: null, label: 'silver chloride' },
    { a: 'Copper sulfate', b: 'NaOH', color: '#6aa8da', consume: 'Copper sulfate', label: 'copper(II) hydroxide' },
    { a: 'Iron(III) chloride', b: 'NaOH', color: '#7a3d12', consume: 'Iron(III) chloride', label: 'iron(III) hydroxide' },
  ]
  for (const p of pairs) {
    if (present(acc, p.a) && present(acc, p.b)) {
      const extent = Math.min(amount(acc, p.a), amount(acc, p.b))
      out.push({ color: hexToRgb(p.color), amount: extent, label: p.label })
      if (p.consume) consumed[p.consume] = (consumed[p.consume] || 0) + Math.min(amount(acc, p.consume), extent)
    }
  }
  return { precipitates: out, consumed }
}

// Detect gas-producing reactions → drives rising-bubble particles + sound.
function detectGas(acc) {
  // Acid + carbonate → CO2
  if (present(acc, 'Sodium carbonate') && (hasCategory(acc, CATEGORY.ACID))) {
    const rate = Math.min(1, Math.min(amount(acc, 'Sodium carbonate'), 4) / 4)
    return { active: true, name: 'CO₂', rate, foam: false }
  }
  // Hydrogen peroxide decomposition → O2 (vigorous with a catalyst)
  if (present(acc, 'Hydrogen peroxide')) {
    const catalysed = present(acc, 'Manganese dioxide')
    return { active: true, name: 'O₂', rate: catalysed ? 1 : 0.35, foam: true }
  }
  // Reactive metal + acid → H2
  if (present(acc, 'Magnesium ribbon') && hasCategory(acc, CATEGORY.ACID)) {
    return { active: true, name: 'H₂', rate: 0.8, foam: false }
  }
  return { active: false, name: null, rate: 0, foam: false }
}

// Compute the dissolved solution colour (before indicators) from coloured solutes.
function dissolvedColor(acc, consumed) {
  let r = 0
  let g = 0
  let b = 0
  let wsum = 0
  for (const id of Object.keys(acc.contents)) {
    const vol = acc.contents[id] || 0
    if (vol <= 0) continue
    const chem = getChemical(id)
    if (!chem.tint) continue
    const effective = Math.max(0, vol - (consumed[id] || 0))
    const w = effective * (chem.strength || 0.5)
    if (w <= 0) continue
    r += chem.tint.r * w
    g += chem.tint.g * w
    b += chem.tint.b * w
    wsum += w
  }

  // Special case: iodine + starch → intense blue-black complex that visually
  // dominates the milky starch and amber iodine entirely.
  if (present(acc, 'Iodine solution') && present(acc, 'Starch solution')) {
    const extent = Math.min(amount(acc, 'Iodine solution'), amount(acc, 'Starch solution'))
    const w = (extent + 1) * 12
    const ib = hexToRgb('#1a1a3e')
    r += ib.r * w
    g += ib.g * w
    b += ib.b * w
    wsum += w
  }

  if (wsum <= 0) {
    return { rgb: WATER, colorantConc: 0 }
  }
  const colorantConc = Math.min(1, wsum / Math.max(acc.totalVolume, 1))
  return { rgb: { r: r / wsum, g: g / wsum, b: b / wsum }, colorantConc }
}

// Turn an accumulator into the render-ready, observable state.
export function derive(acc) {
  const ph = computePH(acc.molesAcid, acc.molesBase, acc.totalVolume)
  const { precipitates, consumed } = detectPrecipitates(acc)
  const gas = detectGas(acc)
  const { rgb: dissolved, colorantConc } = dissolvedColor(acc, consumed)

  // Indicator response — only meaningful when the solution isn't already
  // strongly coloured by another solute.
  let displayRgb = dissolved
  let displayAlpha = colorantConc > 0 ? 0.2 + colorantConc * 0.75 : 0.32
  if (colorantConc < 0.28) {
    for (const id of Object.keys(acc.contents)) {
      if ((acc.contents[id] || 0) <= 0) continue
      const chem = getChemical(id)
      if (chem.category !== CATEGORY.INDICATOR) continue
      const ind = indicatorColor(chem.indicator, ph)
      if (ind) {
        // Blend the (usually colourless) base with the indicator colour.
        displayRgb = lerpColor(dissolved, ind.rgb, 0.85)
        displayAlpha = Math.max(displayAlpha, ind.alpha)
      }
    }
  }

  const totalPrecip = precipitates.reduce((s, p) => s + p.amount, 0)
  const exothermic = acc.temp > AMBIENT_TEMP + 1.2
  const danger =
    acc.temp >= DANGER_TEMP ||
    (present(acc, 'Potassium permanganate') && present(acc, 'Hydrogen peroxide'))

  const phLabel = ph < 6.5 ? 'Acidic' : ph > 7.5 ? 'Basic' : 'Neutral'

  return {
    ph,
    phLabel,
    temp: acc.temp,
    volume: acc.totalVolume,
    color: { ...displayRgb, a: displayAlpha },
    precipitate: {
      active: totalPrecip > 0.05,
      color: precipitates[0]?.color || { r: 240, g: 240, b: 245 },
      amount: totalPrecip,
      label: precipitates[0]?.label || null,
    },
    gas,
    exothermic,
    danger,
  }
}

// ── The one mutation entry point ──────────────────────────────────────────────
// Returns { acc, derived, events } where events are one-shot cues for the UI.
export function addChemical(prevAcc, id, volumeMl) {
  const chem = getChemical(id)
  const acc = {
    contents: { ...prevAcc.contents },
    molesAcid: prevAcc.molesAcid,
    molesBase: prevAcc.molesBase,
    totalVolume: prevAcc.totalVolume,
    temp: prevAcc.temp,
  }
  acc.contents[id] = (acc.contents[id] || 0) + volumeMl
  // Solids (metal ribbon, MnO2) don't add liquid volume.
  if (!chem.solid) acc.totalVolume += volumeMl

  if (chem.category === CATEGORY.ACID) acc.molesAcid += (chem.concentration || 0.1) * volumeMl
  if (chem.category === CATEGORY.BASE) acc.molesBase += (chem.concentration || 0.1) * volumeMl
  if (chem.category === CATEGORY.CARBONATE) acc.molesBase += (chem.concentration || 0.1) * volumeMl

  const before = derive(prevAcc)

  // ── Heat of reaction ──
  let tempBump = 0
  // Neutralization: opposite reagent meeting what's already there.
  const neutralizing =
    (chem.category === CATEGORY.BASE && prevAcc.molesAcid > prevAcc.molesBase) ||
    (chem.category === CATEGORY.ACID && prevAcc.molesBase > prevAcc.molesAcid) ||
    (chem.category === CATEGORY.CARBONATE && prevAcc.molesAcid > prevAcc.molesBase)
  if (neutralizing) tempBump += Math.min(6, volumeMl * 0.18)
  // Reactive metal + acid (and reverse).
  if (
    (chem.category === CATEGORY.METAL && hasCategory(prevAcc, CATEGORY.ACID)) ||
    (chem.category === CATEGORY.ACID && present(prevAcc, 'Magnesium ribbon'))
  ) {
    tempBump += Math.min(10, volumeMl * 0.4 + 2)
  }
  // Catalysed peroxide decomposition is exothermic.
  if (present(acc, 'Hydrogen peroxide') && present(acc, 'Manganese dioxide')) {
    tempBump += Math.min(8, volumeMl * 0.5 + 1)
  }
  acc.temp += tempBump

  const after = derive(acc)
  const events = computeEvents(before, after, acc, tempBump)
  return { acc, derived: after, events }
}

// Compare two derived states (plus the resulting accumulator) and return the
// one-shot cues the UI should fire. Shared by `addChemical` and the pour-end
// diff in the lab page so the logic lives in exactly one place.
export function computeEvents(before, after, acc, tempBump = 0) {
  const events = []
  if (!before.gas.active && after.gas.active) events.push('fizz')
  if (tempBump > 1.5 || (!before.exothermic && after.exothermic)) events.push('hiss')
  if (!before.precipitate.active && after.precipitate.active) events.push('precipitate')
  // Titration endpoint: crossing into the neutral band with both reagents present.
  const wasOutsideNeutral = before.ph < 6.8 || before.ph > 7.2
  const nowNeutral = after.ph >= 6.8 && after.ph <= 7.2
  const hadTitration = acc.molesAcid > 0 && acc.molesBase > 0
  if (wasOutsideNeutral && nowNeutral && hadTitration) events.push('endpoint')
  if (!before.danger && after.danger) events.push('danger')
  return events
}

// Relax the flask temperature back toward ambient (call on a timer from the UI).
export function coolStep(acc, dt = 1) {
  if (acc.temp <= AMBIENT_TEMP) return acc
  const cooled = AMBIENT_TEMP + (acc.temp - AMBIENT_TEMP) * Math.exp(-0.12 * dt)
  return { ...acc, temp: cooled < AMBIENT_TEMP + 0.05 ? AMBIENT_TEMP : cooled }
}
