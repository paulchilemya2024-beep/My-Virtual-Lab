// Numerical methods shared by the mathematics labs.
//
// Deliberately numerical rather than symbolic. A student should be able to drop
// in any function — including one with no tidy closed-form derivative — and
// still see a correct tangent line and a correct f' graph. Computing the slope
// the same way a real instrument would (measure, divide, shrink the interval)
// also matches what the labs are teaching, instead of hiding the idea behind an
// algebra engine.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// The slope of the secant line through (x, f(x)) and (x + h, f(x + h)).
// This is the difference quotient exactly as written in the textbook — the
// thing whose limit as h -> 0 IS the derivative.
export function secantSlope(f, x, h) {
  if (!(Math.abs(h) > 0)) return NaN
  const y0 = f(x)
  const y1 = f(x + h)
  if (!Number.isFinite(y0) || !Number.isFinite(y1)) return NaN
  return (y1 - y0) / h
}

// f'(x) by central difference. Central rather than forward because its error
// falls off as h^2 instead of h, so the tangent line stays visually correct
// even at the edges of a steep curve.
//
// The default step scales with |x| so the accuracy holds at x = 1000 as well as
// at x = 0.001, where a fixed h would be swamped by floating-point error.
export function derivative(f, x, h = null) {
  const step = h ?? Math.max(1e-6, Math.abs(x) * 1e-6 + 1e-6)
  const a = f(x - step)
  const b = f(x + step)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN
  return (b - a) / (2 * step)
}

// Finds where f'(x) = 0 across a range — the maxima, minima and saddle points.
// Scans for sign changes in the derivative, then bisects to refine each one.
// Used to mark stationary points on the graph and to check whether a student
// has actually found one.
export function findStationaryPoints(f, xMin, xMax, { scan = 400, refine = 40, tolerance = 1e-7 } = {}) {
  const found = []
  const dx = (xMax - xMin) / scan
  let prevX = xMin
  let prevD = derivative(f, prevX)

  for (let i = 1; i <= scan; i += 1) {
    const x = xMin + dx * i
    const d = derivative(f, x)

    if (Number.isFinite(prevD) && Number.isFinite(d) && prevD !== 0 && Math.sign(d) !== Math.sign(prevD)) {
      // Bisect between prevX and x to pin down the crossing.
      let lo = prevX
      let hi = x
      let loD = prevD
      for (let k = 0; k < refine; k += 1) {
        const mid = (lo + hi) / 2
        const midD = derivative(f, mid)
        if (!Number.isFinite(midD)) break
        if (Math.sign(midD) === Math.sign(loD)) {
          lo = mid
          loD = midD
        } else {
          hi = mid
        }
        if (hi - lo < tolerance) break
      }
      const root = (lo + hi) / 2
      const y = f(root)
      if (Number.isFinite(y)) {
        // A stationary point is a maximum if f' goes + -> -, a minimum if - -> +.
        found.push({ x: root, y, kind: prevD > 0 ? 'maximum' : 'minimum' })
      }
    }
    prevX = x
    prevD = d
  }
  return found
}

// Maps a value in [min, max] onto a bucket index in [0, count). Used to track
// which parts of the x-range a student has swept through.
export function bucketIndex(value, min, max, count) {
  if (!(max > min)) return 0
  const t = (value - min) / (max - min)
  return clamp(Math.floor(t * count), 0, count - 1)
}

// The Riemann sum of f over [a, b] split into n equal strips, by the named
// method. This is the textbook sum written out as code — not an optimized
// quadrature rule — because the whole point is for a student to watch it
// converge to the exact integral as n grows, the same way the secant
// collapses onto the tangent in the derivative lab.
//
// 'left'  — height sampled at the left edge of each strip (undercounts a
//           rising function, overcounts a falling one)
// 'right' — sampled at the right edge (the opposite bias)
// 'mid'   — sampled at the midpoint (cancels most of the bias — this is why
//           it converges faster than left/right for the same n)
// 'trap'  — the trapezoid rule: averages the left and right heights, which
//           is equivalent to fitting a straight line across each strip
export function riemannSum(f, a, b, n, method = 'left') {
  if (!(n > 0) || !(b > a)) return NaN
  const dx = (b - a) / n
  let sum = 0
  for (let i = 0; i < n; i += 1) {
    const x0 = a + i * dx
    const x1 = x0 + dx
    let sample
    if (method === 'right') sample = f(x1)
    else if (method === 'mid') sample = f((x0 + x1) / 2)
    else if (method === 'trap') sample = (f(x0) + f(x1)) / 2
    else sample = f(x0) // 'left' and any unrecognised method
    if (!Number.isFinite(sample)) return NaN
    sum += sample * dx
  }
  return sum
}
