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
