// Strong-acid / strong-base titration chemistry (HCl titrated with NaOH).
//
// This produces the real, almost-flat-then-S-shaped pH curve: the flask starts
// with a fixed 25 mL of 0.1 M HCl and the student adds 0.1 M NaOH a little at a
// time. Because there is a large reservoir of acid, the first drops barely move
// the pH; the dramatic swing only happens within ~1 mL of the equivalence point
// (25.0 mL of base), exactly as in a real lab.

export const C_ACID = 0.1 // mol/L — concentration of HCl in the flask
export const C_BASE = 0.1 // mol/L — concentration of NaOH in the burette
export const V_ACID_L = 0.025 // 25 mL of acid to start
export const EQUIVALENCE_ML = (C_ACID * V_ACID_L * 1000) / C_BASE // = 25.0 mL
export const DROP_ML = 0.05 // one realistic drop = 50 µL

const KW = 1e-14 // ion product of water at 25 °C

function clampPH(p) {
  return Math.max(0, Math.min(14, p))
}

// pH after `volumeBaseAdded_mL` of NaOH has been added to the flask.
//
// Uses the charge-balance form [H+] = (c + √(c² + 4·Kw)) / 2 rather than a bare
// −log10(c). Away from equivalence this equals the textbook strong-acid result,
// but it also accounts for water's own ionisation, so the curve passes smoothly
// through exactly pH 7 at the equivalence point instead of overshooting.
export function titrationPH(volumeBaseAdded_mL) {
  const Vb = Math.max(0, volumeBaseAdded_mL) / 1000 // L
  const Va = V_ACID_L
  const molesAcid = C_ACID * Va
  const molesBase = C_BASE * Vb
  const totalVolume = Va + Vb
  const excessAcid = molesAcid - molesBase // mol; >0 acid left, <0 base in excess

  if (excessAcid > 0) {
    const c = excessAcid / totalVolume
    const H = (c + Math.sqrt(c * c + 4 * KW)) / 2
    return clampPH(-Math.log10(H))
  }
  if (excessAcid < 0) {
    const c = -excessAcid / totalVolume
    const OH = (c + Math.sqrt(c * c + 4 * KW)) / 2
    return clampPH(14 + Math.log10(OH)) // 14 − pOH
  }
  return 7 // exact equivalence
}

// A mild, realistic temperature rise from the exothermic neutralisation. Heat is
// released in proportion to how much acid has actually been neutralised, peaking
// at the equivalence point.
export function titrationTemp(volumeBaseAdded_mL, ambient = 22) {
  const molesAcid = C_ACID * V_ACID_L
  const molesBase = C_BASE * (Math.max(0, volumeBaseAdded_mL) / 1000)
  const neutralised = Math.min(molesAcid, molesBase)
  const fraction = molesAcid > 0 ? neutralised / molesAcid : 0
  return ambient + 5 * fraction
}

// ── Real flask contents ───────────────────────────────────────────────────────
//
// The functions above describe the ideal textbook titration: exactly 25 mL of
// acid, base added from zero. The student, however, measures the acid THEMSELVES
// and may over-pour it, dilute it with water, or tip NaOH straight into the
// flask. Everything below works from what is actually in the flask, so a
// mis-measured run still reads correctly — and its equivalence point genuinely
// moves, which is the whole lesson about measuring carefully.

export const DROPS_OF_INDICATOR = 3 // the procedure calls for three
export const BURETTE_CAPACITY_ML = 50
export const PIPETTE_ML = 25 // a 25 mL volumetric pipette

export function createFlask() {
  return { hclML: 0, naohML: 0, waterML: 0, indicatorDrops: 0 }
}

export function flaskVolumeML(f) {
  return f.hclML + f.naohML + f.waterML + f.indicatorDrops * DROP_ML
}

// pH from arbitrary amounts of strong acid and strong base in a given volume,
// using the same charge-balance form as titrationPH so the curve still passes
// smoothly through exactly pH 7 at equivalence.
export function phFromMoles(molesAcid, molesBase, totalVolume_L) {
  if (totalVolume_L <= 0) return null
  const excessAcid = molesAcid - molesBase
  if (excessAcid === 0) return 7
  const c = Math.abs(excessAcid) / totalVolume_L
  const ion = (c + Math.sqrt(c * c + 4 * KW)) / 2
  return excessAcid > 0 ? clampPH(-Math.log10(ion)) : clampPH(14 + Math.log10(ion))
}

// pH of the flask as it actually stands. Returns null for an empty flask, which
// the pH meter shows as "--" rather than a fake 7.
export function flaskPH(f) {
  const volume = flaskVolumeML(f) / 1000
  if (volume <= 0) return null
  return phFromMoles((C_ACID * f.hclML) / 1000, (C_BASE * f.naohML) / 1000, volume)
}

export function flaskTemp(f, ambient = 22) {
  const molesAcid = (C_ACID * f.hclML) / 1000
  const molesBase = (C_BASE * f.naohML) / 1000
  if (molesAcid <= 0) return ambient
  return ambient + 5 * (Math.min(molesAcid, molesBase) / molesAcid)
}

// Where equivalence falls for the acid actually in the flask. Over-measure the
// acid and the endpoint moves — exactly as it would on a real bench.
export function equivalenceForFlask(f) {
  return (C_ACID * f.hclML) / C_BASE
}
