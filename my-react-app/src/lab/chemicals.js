// Chemical database for the virtual chemistry lab.
//
// Each entry describes a reagent the student can pour into the flask. Keys are
// the exact strings stored in an experiment's `availableChemicals` array, so the
// server data and this map must agree (e.g. "Copper sulfate", "HCl").
//
// Colours are the real-world appearance of each reagent. Transparent liquids
// carry a `tint` of null and barely shade the solution; coloured solutes carry
// an {r,g,b} tint plus a `strength` (0–1) describing how strongly a unit of
// volume drives the mixed colour. Indicators don't colour by themselves — their
// colour is computed from pH by the reaction engine (see reactions.js).

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToCss({ r, g, b }, a = 1) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`
}

// Categories drive the generic reaction rules in reactions.js.
export const CATEGORY = {
  ACID: 'acid',
  BASE: 'base',
  SALT: 'salt',
  CARBONATE: 'carbonate',
  INDICATOR: 'indicator',
  METAL: 'metal',
  OXIDIZER: 'oxidizer',
  CATALYST: 'catalyst',
  BIOLOGICAL: 'biological',
  WATER: 'water',
}

export const CHEMICALS = {
  'HCl': {
    name: 'Hydrochloric acid',
    formula: 'HCl',
    category: CATEGORY.ACID,
    concentration: 0.1, // mol/L
    tint: null, // colourless / transparent
    swatch: '#eaf4ff',
    hint: 'Strong acid — clear and colourless, reads a low pH.',
  },
  'NaOH': {
    name: 'Sodium hydroxide',
    formula: 'NaOH',
    category: CATEGORY.BASE,
    concentration: 0.1,
    tint: null,
    swatch: '#eef6f2',
    hint: 'Strong base — clear and colourless, reads a high pH.',
  },
  'Copper sulfate': {
    name: 'Copper(II) sulfate',
    formula: 'CuSO₄',
    category: CATEGORY.SALT,
    tint: hexToRgb('#1a7abf'),
    strength: 0.9,
    swatch: '#1a7abf',
    hint: 'A bright blue solution of copper ions.',
  },
  'Potassium permanganate': {
    name: 'Potassium permanganate',
    formula: 'KMnO₄',
    category: CATEGORY.OXIDIZER,
    tint: hexToRgb('#6a0dad'),
    strength: 1,
    swatch: '#6a0dad',
    hint: 'A deep purple, strongly oxidising solution.',
  },
  'Iron(III) chloride': {
    name: 'Iron(III) chloride',
    formula: 'FeCl₃',
    category: CATEGORY.SALT,
    tint: hexToRgb('#b8860b'),
    strength: 0.8,
    swatch: '#b8860b',
    hint: 'A yellow-brown solution of iron(III) ions.',
  },
  'Iodine solution': {
    name: 'Iodine solution',
    formula: 'I₂',
    category: CATEGORY.OXIDIZER,
    tint: hexToRgb('#8B4513'),
    strength: 0.7,
    swatch: '#8B4513',
    hint: 'An amber-brown solution — turns blue-black with starch.',
  },
  'Starch solution': {
    name: 'Starch solution',
    formula: '(C₆H₁₀O₅)ₙ',
    category: CATEGORY.BIOLOGICAL,
    tint: hexToRgb('#eef0f2'),
    strength: 0.35, // milky/white, lightly opaque
    swatch: '#f3f4f6',
    hint: 'A milky-white suspension — the classic test for iodine.',
  },
  'Hydrogen peroxide': {
    name: 'Hydrogen peroxide',
    formula: 'H₂O₂',
    category: CATEGORY.OXIDIZER,
    tint: null,
    swatch: '#eef6ff',
    hint: 'Colourless — froths into white foam when it decomposes.',
  },
  'Silver nitrate': {
    name: 'Silver nitrate',
    formula: 'AgNO₃',
    category: CATEGORY.SALT,
    tint: null,
    swatch: '#f1f1f4',
    hint: 'Colourless — forms a white precipitate with chlorides.',
  },
  'Sodium chloride': {
    name: 'Sodium chloride',
    formula: 'NaCl',
    category: CATEGORY.SALT,
    tint: null,
    swatch: '#f1f4f8',
    hint: 'Table salt in solution — clear and colourless.',
  },
  'Sodium carbonate': {
    name: 'Sodium carbonate',
    formula: 'Na₂CO₃',
    category: CATEGORY.CARBONATE,
    concentration: 0.1,
    tint: null,
    swatch: '#eef6f2',
    hint: 'A mild base — fizzes with acids, releasing CO₂.',
  },
  'Magnesium ribbon': {
    name: 'Magnesium ribbon',
    formula: 'Mg',
    category: CATEGORY.METAL,
    solid: true,
    tint: null,
    swatch: '#c8ccd4',
    hint: 'A reactive metal — fizzes in acid, releasing hydrogen.',
  },
  'Manganese dioxide': {
    name: 'Manganese dioxide',
    formula: 'MnO₂',
    category: CATEGORY.CATALYST,
    solid: true,
    tint: hexToRgb('#1c1c1c'),
    strength: 0.4,
    swatch: '#1c1c1c',
    hint: 'A black catalyst — speeds up peroxide decomposition.',
  },
  'Phenolphthalein': {
    name: 'Phenolphthalein',
    formula: 'indicator',
    category: CATEGORY.INDICATOR,
    indicator: 'phenolphthalein',
    tint: null,
    swatch: '#ffd9ef',
    hint: 'Colourless in acid, magenta-pink above pH 8.2.',
  },
  'Litmus': {
    name: 'Litmus',
    formula: 'indicator',
    category: CATEGORY.INDICATOR,
    indicator: 'litmus',
    tint: null,
    swatch: '#b06cc6',
    hint: 'Red in acid, purple when neutral, blue in alkali.',
  },
  'Universal indicator': {
    name: 'Universal indicator',
    formula: 'indicator',
    category: CATEGORY.INDICATOR,
    indicator: 'universal',
    tint: null,
    swatch: '#3cb043',
    hint: 'Shows the whole pH scale as a rainbow of colours.',
  },
  'Distilled water': {
    name: 'Distilled water',
    formula: 'H₂O',
    category: CATEGORY.WATER,
    tint: null,
    swatch: '#e8f4ff',
    hint: 'Neutral — dilutes the solution without reacting.',
    tonicity: 0, // pure water — strongly hypotonic to a cell
  },
  // ── Osmosis bathing solutions ──────────────────────────────────────────────
  // `tonicity` is the external solute concentration (arbitrary 0–1 scale) used by
  // the osmosis simulation to decide which way water flows across the membrane.
  'Salt solution': {
    name: 'Salt solution',
    formula: 'NaCl (aq)',
    category: CATEGORY.BIOLOGICAL,
    tint: hexToRgb('#dfe9f2'),
    strength: 0.15,
    swatch: '#cfe0ef',
    hint: 'A concentrated salt bath — strongly hypertonic to the cell.',
    tonicity: 0.9,
  },
  'Sugar solution': {
    name: 'Sugar solution',
    formula: 'C₁₂H₂₂O₁₁ (aq)',
    category: CATEGORY.BIOLOGICAL,
    tint: hexToRgb('#f3ecda'),
    strength: 0.2,
    swatch: '#ecdfbf',
    hint: 'A sugary bath — here it is balanced (isotonic) with the cell.',
    tonicity: 0.42,
  },
}

// Fallback definition for any chemical string not in the map above, so an
// unexpected reagent never crashes the simulation.
export function getChemical(id) {
  return (
    CHEMICALS[id] || {
      name: id,
      formula: '',
      category: CATEGORY.SALT,
      tint: null,
      swatch: '#c4c4c4',
      hint: '',
    }
  )
}

export function chemicalSwatch(id) {
  return getChemical(id).swatch
}
