import { DERIVATIVES_EXPLAINER } from './derivatives.js'
import { RIEMANN_EXPLAINER } from './riemann.js'
import { DERIVATIVE_RULES_EXPLAINER } from './derivative-rules.js'
import { LIMITS_EXPLAINER } from './limits.js'
import { CIRCUIT_EXPLAINER } from './circuit.js'
import { INCLINE_EXPLAINER } from './incline.js'
import { PENDULUM_EXPLAINER } from './pendulum.js'
import { PROJECTILE_EXPLAINER } from './projectile.js'

// Animated explainers, keyed by experiment id. A lab that has one shows it in
// place of the read-aloud bar on the notes page: the student watches the
// concept being built, then reads the same material as text, then goes and
// does it. Labs without an explainer fall back to the plain narrated notes,
// so this can be filled in one lab at a time.
export const EXPLAINERS = {
  derivatives: DERIVATIVES_EXPLAINER,
  riemann: RIEMANN_EXPLAINER,
  'derivative-rules': DERIVATIVE_RULES_EXPLAINER,
  limits: LIMITS_EXPLAINER,
  circuit: CIRCUIT_EXPLAINER,
  incline: INCLINE_EXPLAINER,
  pendulum: PENDULUM_EXPLAINER,
  projectile: PROJECTILE_EXPLAINER,
}

export const explainerFor = (experimentId) => EXPLAINERS[experimentId] || null
