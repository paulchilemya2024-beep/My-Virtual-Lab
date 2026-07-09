// Reaction engine for the virtual chemistry lab.
//
// This is a *teaching* model, but it follows the real chemistry principles:
// reactions run over TIME (not instantly on pour), reagents are CONSUMED as they
// react, heat rises gradually toward a realistic per-reaction peak and then cools
// back toward room temperature, and only chemically-correct combinations react.
// Distilled water never reacts with a metal; copper never reacts with dilute HCl.
//
// The engine is pure: `addChemical` mixes a reagent in, and `reactTick(acc, dt)`
// advances the ongoing reactions by `dt` seconds. `derive` turns an accumulator
// into the observable state the student sees: pH, colour, gas, solids, heat.

import { CATEGORY, getChemical, hexToRgb } from './chemicals.js'

export const AMBIENT_TEMP = 22
const DANGER_TEMP = 80

// ── Metal reactivity data (the heart of the metals & acids experiment) ───────
// peak      — maximum flask temperature this reaction can reach (°C)
// rate      — how fast the metal dissolves in excess acid (units per second)
// gasRate   — bubble intensity 0..1 while reacting
// saltTint  — colour the dissolved metal chloride gives the solution (or null)
export const METAL_DATA = {
  'Magnesium ribbon': {
    peak: 52, // real Mg + HCl peaks around 45–55 °C
    rate: 0.30,
    gasRate: 1.0,
    saltTint: { rgb: hexToRgb('#e6f0ff'), strength: 0.25 }, // slightly milky MgCl₂
    equation: 'Mg + 2HCl → MgCl₂ + H₂↑',
  },
  'Zinc granules': {
    peak: 40, // 35–45 °C
    rate: 0.12,
    gasRate: 0.55,
    saltTint: { rgb: hexToRgb('#dce6c8'), strength: 0.2 }, // faint yellow ZnCl₂
    equation: 'Zn + 2HCl → ZnCl₂ + H₂↑',
  },
  'Iron filings': {
    peak: 34, // 30–38 °C, slow
    rate: 0.05,
    gasRate: 0.25,
    saltTint: { rgb: hexToRgb('#c8b48c'), strength: 0.45 }, // pale green-brown FeCl₂
    equation: 'Fe + 2HCl → FeCl₂ + H₂↑',
  },
  'Copper strip': {
    peak: AMBIENT_TEMP, // NO reaction — Cu is below H in the reactivity series
    rate: 0,
    gasRate: 0,
    saltTint: null,
    equation: 'Cu + HCl → no reaction',
  },
}

// mmol of H⁺ consumed per unit of metal dissolved (teaching scale).
const ACID_PER_METAL_UNIT = 0.6
// Carbonate + acid kinetics.
const CARBONATE_RATE = 0.5 // units per second while acid is present
const CARBONATE_PEAK = AMBIENT_TEMP + 8 // mildly exothermic

// ── Colour helpers ───────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t
}
function lerpColor(c1, c2, t) {
  return { r: lerp(c1.r, c2.r, t), g: lerp(c1.g, c2.g, t), b: lerp(c1.b, c2.b, t) }
}
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

// Indicator colour as a function of pH.
function indicatorColor(kind, ph) {
  if (kind === 'phenolphthalein') {
    if (ph < 8.2) return null
    const t = Math.min(1, (ph - 8.2) / 1.8)
    return { rgb: hexToRgb('#e91e8c'), alpha: 0.25 + t * 0.6 }
  }
  if (kind === 'litmus') {
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
    contents: {}, // id -> amount remaining (mL for liquids, "units" for solids)
    salts: {}, // metal id -> amount dissolved so far (drives salt tints)
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
// Is there actually free acid available to react (H⁺ in excess)?
function acidAvailable(acc) {
  return acc.molesAcid - acc.molesBase > 0.02
}

// ── Time evolution: THE core of realistic behaviour ──────────────────────────
// Advances all ongoing reactions by `dt` seconds and returns a new accumulator.
// - reacting metals dissolve, consume acid and drive temp toward their peak
// - carbonate fizzes CO₂ while acid remains
// - with nothing reacting the flask slowly cools back to room temperature
export function reactTick(prevAcc, dt) {
  const acc = {
    contents: { ...prevAcc.contents },
    salts: { ...prevAcc.salts },
    molesAcid: prevAcc.molesAcid,
    molesBase: prevAcc.molesBase,
    totalVolume: prevAcc.totalVolume,
    temp: prevAcc.temp,
  }

  let hottestPeak = null

  // Metal + acid reactions (each reacting metal contributes).
  if (acidAvailable(acc)) {
    for (const id of Object.keys(METAL_DATA)) {
      const data = METAL_DATA[id]
      if (data.rate <= 0) continue // copper: never reacts
      const remaining = amount(acc, id)
      if (remaining <= 0) continue
      const canDissolve = Math.min(remaining, data.rate * dt)
      const acidNeeded = canDissolve * ACID_PER_METAL_UNIT
      const acidFree = Math.max(0, acc.molesAcid - acc.molesBase)
      const scale = acidNeeded > 0 ? Math.min(1, acidFree / acidNeeded) : 0
      const dissolved = canDissolve * scale
      if (dissolved <= 0) continue
      acc.contents[id] = remaining - dissolved
      acc.molesAcid = Math.max(0, acc.molesAcid - dissolved * ACID_PER_METAL_UNIT)
      acc.salts[id] = (acc.salts[id] || 0) + dissolved
      if (hottestPeak === null || data.peak > hottestPeak) hottestPeak = data.peak
    }
  }

  // Carbonate + acid → CO₂ (consumes both).
  if (acidAvailable(acc) && present(acc, 'Sodium carbonate')) {
    const consumed = Math.min(amount(acc, 'Sodium carbonate'), CARBONATE_RATE * dt)
    acc.contents['Sodium carbonate'] = amount(acc, 'Sodium carbonate') - consumed
    acc.molesAcid = Math.max(0, acc.molesAcid - consumed * 0.1)
    if (hottestPeak === null || CARBONATE_PEAK > hottestPeak) hottestPeak = CARBONATE_PEAK
  }

  // Catalysed peroxide decomposition (exothermic while both present).
  if (present(acc, 'Hydrogen peroxide') && present(acc, 'Manganese dioxide')) {
    const consumed = Math.min(amount(acc, 'Hydrogen peroxide'), 0.35 * dt)
    acc.contents['Hydrogen peroxide'] = amount(acc, 'Hydrogen peroxide') - consumed
    if (hottestPeak === null || 38 > hottestPeak) hottestPeak = 38
  }

  // ── Temperature: gradual rise toward the reaction peak, else slow cooling ──
  // Rise ~8–12 s to peak; cool over ~1–2 min. Temperature can NEVER exceed the
  // peak of the hottest reaction currently running.
  if (hottestPeak !== null && hottestPeak > acc.temp) {
    const k = 1 - Math.exp(-dt / 3.2) // ≈95% of the way in ~10 s
    acc.temp += (hottestPeak - acc.temp) * k
    acc.temp = Math.min(acc.temp, hottestPeak)
  } else {
    const k = 1 - Math.exp(-dt / 28) // slow relaxation to room temperature
    acc.temp += (AMBIENT_TEMP - acc.temp) * k
    if (Math.abs(acc.temp - AMBIENT_TEMP) < 0.05) acc.temp = AMBIENT_TEMP
  }

  return acc
}

// Detect precipitation reactions.
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

// Detect gas-producing reactions. STRICT chemistry:
// - H₂ ONLY while a reactive metal AND free acid are both present
// - CO₂ ONLY while carbonate AND free acid are both present
// - O₂ from peroxide decomposition
// - distilled water NEVER produces gas with anything here
function detectGas(acc) {
  // Reactive metal + acid → H₂. Rate follows the most vigorous reacting metal.
  if (acidAvailable(acc)) {
    let best = 0
    for (const id of Object.keys(METAL_DATA)) {
      if (present(acc, id) && METAL_DATA[id].gasRate > best) best = METAL_DATA[id].gasRate
    }
    if (best > 0) return { active: true, name: 'H₂', rate: best, foam: false }
    if (present(acc, 'Sodium carbonate')) {
      const rate = Math.min(1, Math.min(amount(acc, 'Sodium carbonate'), 4) / 4)
      return { active: true, name: 'CO₂', rate: Math.max(0.4, rate), foam: false }
    }
  }
  // Hydrogen peroxide decomposition → O₂ (vigorous with a catalyst).
  if (present(acc, 'Hydrogen peroxide')) {
    const catalysed = present(acc, 'Manganese dioxide')
    return { active: true, name: 'O₂', rate: catalysed ? 1 : 0.35, foam: true }
  }
  return { active: false, name: null, rate: 0, foam: false }
}

// Compute the dissolved solution colour from coloured solutes + dissolved salts.
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

  // Dissolved metal salts tint the solution (e.g. iron chloride pale green-brown).
  for (const id of Object.keys(acc.salts || {})) {
    const data = METAL_DATA[id]
    if (!data?.saltTint) continue
    const w = (acc.salts[id] || 0) * data.saltTint.strength * 3
    if (w <= 0) continue
    r += data.saltTint.rgb.r * w
    g += data.saltTint.rgb.g * w
    b += data.saltTint.rgb.b * w
    wsum += w
  }

  // Iodine + starch → intense blue-black complex.
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

// Visible solids sitting in the flask (metal pieces etc.) for the canvas to draw.
function detectSolids(acc) {
  const out = []
  for (const id of Object.keys(acc.contents)) {
    const left = acc.contents[id] || 0
    if (left <= 0.02) continue
    const chem = getChemical(id)
    if (!chem.solid) continue
    const initial = left + (acc.salts?.[id] || 0)
    out.push({
      id,
      kind: id === 'Magnesium ribbon' ? 'ribbon' : id === 'Copper strip' ? 'strip' : 'granules',
      color: chem.swatch || '#c8ccd4',
      // 0..1 fraction remaining, so ribbons shorten as they dissolve.
      remaining: initial > 0 ? Math.min(1, left / initial) : 1,
      amount: left,
    })
  }
  return out
}

// Turn an accumulator into the render-ready, observable state.
export function derive(acc) {
  const ph = computePH(acc.molesAcid, acc.molesBase, acc.totalVolume)
  const { precipitates, consumed } = detectPrecipitates(acc)
  const gas = detectGas(acc)
  const { rgb: dissolved, colorantConc } = dissolvedColor(acc, consumed)
  const solids = detectSolids(acc)

  let displayRgb = dissolved
  let displayAlpha = colorantConc > 0 ? 0.2 + colorantConc * 0.75 : 0.32
  if (colorantConc < 0.28) {
    for (const id of Object.keys(acc.contents)) {
      if ((acc.contents[id] || 0) <= 0) continue
      const chem = getChemical(id)
      if (chem.category !== CATEGORY.INDICATOR) continue
      const ind = indicatorColor(chem.indicator, ph)
      if (ind) {
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
    solids,
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

// ── The one mixing entry point ────────────────────────────────────────────────
// Adding a chemical only MIXES it in. All reaction heat and consumption happen
// over time in `reactTick`, so temperature can never spike unrealistically no
// matter how fast the student pours.
export function addChemical(prevAcc, id, volumeMl) {
  const chem = getChemical(id)
  const acc = {
    contents: { ...prevAcc.contents },
    salts: { ...prevAcc.salts },
    molesAcid: prevAcc.molesAcid,
    molesBase: prevAcc.molesBase,
    totalVolume: prevAcc.totalVolume,
    temp: prevAcc.temp,
  }

  const amountScale = chem.solid ? 10 : 1
  acc.contents[id] = (acc.contents[id] || 0) + volumeMl * amountScale
  // Solids (metal pieces, MnO2) don't add liquid volume.
  if (!chem.solid) acc.totalVolume += volumeMl

  if (chem.category === CATEGORY.ACID) acc.molesAcid += (chem.concentration || 0.1) * volumeMl
  if (chem.category === CATEGORY.BASE) acc.molesBase += (chem.concentration || 0.1) * volumeMl
  if (chem.category === CATEGORY.CARBONATE) acc.molesBase += (chem.concentration || 0.1) * volumeMl * 0.4

  const before = derive(prevAcc)

  // A gentle, volume-proportional neutralisation warmth (no per-call constants —
  // that was the source of the old impossible 171 °C readings).
  const neutralizing =
    (chem.category === CATEGORY.BASE && prevAcc.molesAcid > prevAcc.molesBase) ||
    (chem.category === CATEGORY.ACID && prevAcc.molesBase > prevAcc.molesAcid) ||
    (chem.category === CATEGORY.CARBONATE && prevAcc.molesAcid > prevAcc.molesBase)
  if (neutralizing) acc.temp = Math.min(AMBIENT_TEMP + 6, acc.temp + volumeMl * 0.15)

  const after = derive(acc)
  const events = computeEvents(before, after, acc)
  return { acc, derived: after, events }
}

export function rinse(prevAcc) {
  const acc = {
    contents: {},
    salts: {},
    molesAcid: 0,
    molesBase: 0,
    totalVolume: 0,
    temp: prevAcc.temp,
  }

  for (const [id, amount] of Object.entries(prevAcc.contents || {})) {
    const chem = getChemical(id)
    if (chem.solid || chem.category === CATEGORY.SALT || chem.category === CATEGORY.CATALYST) {
      acc.contents[id] = amount
    }
  }

  for (const [id, amount] of Object.entries(prevAcc.salts || {})) {
    acc.salts[id] = amount
  }

  return { acc, derived: derive(acc), events: [] }
}

// Compare two derived states and return the one-shot cues the UI should fire.
export function computeEvents(before, after, acc, tempBump = 0) {
  const events = []
  if (!before.gas.active && after.gas.active) events.push('fizz')
  if (tempBump > 1.5 || (!before.exothermic && after.exothermic)) events.push('hiss')
  if (!before.precipitate.active && after.precipitate.active) events.push('precipitate')
  const wasOutsideNeutral = before.ph < 6.8 || before.ph > 7.2
  const nowNeutral = after.ph >= 6.8 && after.ph <= 7.2
  const hadTitration = acc.molesAcid > 0 && acc.molesBase > 0
  if (wasOutsideNeutral && nowNeutral && hadTitration) events.push('endpoint')
  if (!before.danger && after.danger) events.push('danger')
  return events
}

// Back-compat cooling helper (now just a thin wrapper over reactTick).
export function coolStep(acc, dt = 1) {
  return reactTick(acc, dt)
}
