// Shared 2D plotting engine for the mathematics labs.
//
// Everything here draws in WORLD coordinates — the actual maths x and y a
// student is reasoning about — and the viewport converts to pixels. That
// separation is what lets two stacked panes (f above, f' below) share an exact
// x-alignment: they are built from the same xMin/xMax and the same left
// padding, so the point directly under x = 1.4 on the top graph really is
// x = 1.4 on the bottom one. Vertical alignment IS the lesson, so it is worth
// enforcing structurally rather than by eye.
//
// This is the maths family's equivalent of LabCanvas: one renderer that every
// lab in the unit draws through. No dependencies — plain canvas 2D.

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

// Builds the world<->screen mapping for one pane. `pad` reserves room for the
// axis labels; the left pad is the one that must match between stacked panes.
export function makeViewport({ width, height, xMin, xMax, yMin, yMax, pad = {} }) {
  const padL = pad.left ?? 46
  const padR = pad.right ?? 16
  const padT = pad.top ?? 16
  const padB = pad.bottom ?? 28

  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const spanX = xMax - xMin || 1
  const spanY = yMax - yMin || 1

  return {
    width, height, xMin, xMax, yMin, yMax,
    padL, padR, padT, padB, plotW, plotH,
    // world -> screen
    sx: (x) => padL + ((x - xMin) / spanX) * plotW,
    sy: (y) => padT + (1 - (y - yMin) / spanY) * plotH,
    // screen -> world
    wx: (px) => xMin + ((px - padL) / plotW) * spanX,
    wy: (py) => yMin + (1 - (py - padT) / plotH) * spanY,
  }
}

// Picks a gridline spacing of 1, 2 or 5 x 10^k so labels land on round numbers
// instead of 0.3333. `target` is roughly how many lines you want.
export function niceStep(range, target = 8) {
  const raw = Math.abs(range) / Math.max(1, target)
  if (!(raw > 0) || !Number.isFinite(raw)) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return step * mag
}

// Formats an axis label without floating-point noise (0.30000000000000004).
export function axisLabel(v, step) {
  if (Math.abs(v) < step * 1e-6) return '0'
  const decimals = Math.max(0, Math.min(4, Math.ceil(-Math.log10(step))))
  return v.toFixed(decimals)
}

// Runs `fn` with drawing clipped to the plot rectangle, so curves and tangent
// lines never bleed over the axis labels.
export function clipToPlot(ctx, vp, fn) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(vp.padL, vp.padT, vp.plotW, vp.plotH)
  ctx.clip()
  fn()
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Chrome: background, grid, axes
// ---------------------------------------------------------------------------

export function drawPaneBackground(ctx, vp, { fill = 'rgba(8, 16, 34, 0.72)', border = 'rgba(120, 190, 255, 0.14)', label, labelColor = 'rgba(234, 242, 255, 0.5)' } = {}) {
  ctx.fillStyle = fill
  ctx.fillRect(vp.padL, vp.padT, vp.plotW, vp.plotH)
  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.strokeRect(vp.padL + 0.5, vp.padT + 0.5, vp.plotW - 1, vp.plotH - 1)

  if (label) {
    ctx.fillStyle = labelColor
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(label, vp.padL + 10, vp.padT + 8)
  }
}

export function drawGrid(ctx, vp, { color = 'rgba(120, 190, 255, 0.08)', labelColor = 'rgba(234, 242, 255, 0.42)', showLabels = true } = {}) {
  const stepX = niceStep(vp.xMax - vp.xMin, 9)
  const stepY = niceStep(vp.yMax - vp.yMin, 6)

  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillStyle = labelColor

  // Vertical lines
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let x = Math.ceil(vp.xMin / stepX) * stepX; x <= vp.xMax + 1e-9; x += stepX) {
    const px = Math.round(vp.sx(x)) + 0.5
    ctx.beginPath()
    ctx.moveTo(px, vp.padT)
    ctx.lineTo(px, vp.padT + vp.plotH)
    ctx.stroke()
    if (showLabels) ctx.fillText(axisLabel(x, stepX), px, vp.padT + vp.plotH + 6)
  }

  // Horizontal lines
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let y = Math.ceil(vp.yMin / stepY) * stepY; y <= vp.yMax + 1e-9; y += stepY) {
    const py = Math.round(vp.sy(y)) + 0.5
    ctx.beginPath()
    ctx.moveTo(vp.padL, py)
    ctx.lineTo(vp.padL + vp.plotW, py)
    ctx.stroke()
    if (showLabels) ctx.fillText(axisLabel(y, stepY), vp.padL - 8, py)
  }
}

// The x and y axes, drawn brighter than the grid — but only when 0 is actually
// inside the visible range.
export function drawAxes(ctx, vp, { color = 'rgba(180, 215, 255, 0.34)' } = {}) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.4
  if (vp.yMin <= 0 && vp.yMax >= 0) {
    const py = Math.round(vp.sy(0)) + 0.5
    ctx.beginPath()
    ctx.moveTo(vp.padL, py)
    ctx.lineTo(vp.padL + vp.plotW, py)
    ctx.stroke()
  }
  if (vp.xMin <= 0 && vp.xMax >= 0) {
    const px = Math.round(vp.sx(0)) + 0.5
    ctx.beginPath()
    ctx.moveTo(px, vp.padT)
    ctx.lineTo(px, vp.padT + vp.plotH)
    ctx.stroke()
  }
}

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

// Samples f across the viewport and returns an array of polylines. It breaks
// the curve into separate pieces wherever the function is undefined or jumps
// vertically by an implausible amount, so an asymptote renders as a gap rather
// than a near-vertical line joining +inf to -inf.
export function sampleCurve(f, vp, samples = 480) {
  const pieces = []
  let current = []
  const jumpLimit = (vp.yMax - vp.yMin) * 1.5

  for (let i = 0; i <= samples; i += 1) {
    const x = vp.xMin + ((vp.xMax - vp.xMin) * i) / samples
    let y
    try {
      y = f(x)
    } catch {
      y = NaN
    }

    if (!Number.isFinite(y)) {
      if (current.length > 1) pieces.push(current)
      current = []
      continue
    }
    const prev = current[current.length - 1]
    if (prev && Math.abs(y - prev.y) > jumpLimit) {
      if (current.length > 1) pieces.push(current)
      current = []
    }
    current.push({ x, y })
  }
  if (current.length > 1) pieces.push(current)
  return pieces
}

export function drawCurve(ctx, vp, pieces, { color = '#00e5c3', width = 2.4, dash = null, alpha = 1 } = {}) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (dash) ctx.setLineDash(dash)
  pieces.forEach((piece) => {
    ctx.beginPath()
    piece.forEach((pt, i) => {
      const px = vp.sx(pt.x)
      const py = vp.sy(pt.y)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  })
  ctx.restore()
}

// Draws only the parts of a curve the student has already swept through, using
// a per-bucket visited mask. This is what makes the derivative graph "draw
// itself" as they scrub rather than appearing all at once.
export function drawCurveMasked(ctx, vp, f, visited, { color = '#8b5cf6', width = 2.8 } = {}) {
  const n = visited.length
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  let drawing = false
  ctx.beginPath()
  for (let i = 0; i < n; i += 1) {
    if (!visited[i]) {
      drawing = false
      continue
    }
    const x = vp.xMin + ((vp.xMax - vp.xMin) * (i + 0.5)) / n
    let y
    try {
      y = f(x)
    } catch {
      y = NaN
    }
    if (!Number.isFinite(y)) {
      drawing = false
      continue
    }
    const px = vp.sx(x)
    const py = vp.sy(y)
    if (!drawing) {
      ctx.moveTo(px, py)
      drawing = true
    } else {
      ctx.lineTo(px, py)
    }
  }
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Overlays: points and straight lines
// ---------------------------------------------------------------------------

// A straight line of a given slope through (x0, y0), extended across the full
// pane. Used for both the tangent and the secant.
export function drawLineThroughPoint(ctx, vp, x0, y0, slope, { color = '#f0a500', width = 2, dash = null, alpha = 1 } = {}) {
  if (!Number.isFinite(slope) || !Number.isFinite(y0)) return
  clipToPlot(ctx, vp, () => {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.lineWidth = width
    if (dash) ctx.setLineDash(dash)
    ctx.beginPath()
    ctx.moveTo(vp.sx(vp.xMin), vp.sy(y0 + slope * (vp.xMin - x0)))
    ctx.lineTo(vp.sx(vp.xMax), vp.sy(y0 + slope * (vp.xMax - x0)))
    ctx.stroke()
    ctx.restore()
  })
}

export function drawPoint(ctx, vp, x, y, { color = '#ffffff', radius = 5.5, ring = 'rgba(0, 229, 195, 0.35)', label = null } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const px = vp.sx(x)
  const py = vp.sy(y)
  ctx.save()
  if (ring) {
    ctx.fillStyle = ring
    ctx.beginPath()
    ctx.arc(px, py, radius + 5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(px, py, radius, 0, Math.PI * 2)
  ctx.fill()
  if (label) {
    ctx.fillStyle = 'rgba(234, 242, 255, 0.92)'
    ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(label, px + 10, py - 8)
  }
  ctx.restore()
}

// A dashed vertical rule at x — the visual thread tying the point on f to the
// matching point on f'.
export function drawVerticalMarker(ctx, vp, x, { color = 'rgba(255, 255, 255, 0.28)', dash = [4, 5], width = 1.2 } = {}) {
  if (!Number.isFinite(x)) return
  clipToPlot(ctx, vp, () => {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.setLineDash(dash)
    const px = vp.sx(x)
    ctx.beginPath()
    ctx.moveTo(px, vp.padT)
    ctx.lineTo(px, vp.padT + vp.plotH)
    ctx.stroke()
    ctx.restore()
  })
}

// The little right-triangle under the tangent showing "rise over run" — the
// single most useful annotation for making slope concrete.
export function drawSlopeTriangle(ctx, vp, x0, y0, slope, run, { color = 'rgba(240, 165, 0, 0.9)', fill = 'rgba(240, 165, 0, 0.14)' } = {}) {
  if (!Number.isFinite(slope)) return
  const x1 = x0 + run
  const y1 = y0 + slope * run
  clipToPlot(ctx, vp, () => {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(vp.sx(x0), vp.sy(y0))
    ctx.lineTo(vp.sx(x1), vp.sy(y0))
    ctx.lineTo(vp.sx(x1), vp.sy(y1))
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.4
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.restore()
  })
}

// ---------------------------------------------------------------------------
// Canvas sizing
// ---------------------------------------------------------------------------

// Sizes a canvas backing store for the device pixel ratio and returns the CSS
// dimensions, so all drawing code can work in plain CSS pixels. Mirrors the
// approach used by the whiteboard.
export function sizeCanvas(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(cssWidth * dpr))
  canvas.height = Math.max(1, Math.round(cssHeight * dpr))
  canvas.style.height = `${cssHeight}px`
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, width: cssWidth, height: cssHeight }
}

// Draws the Riemann rectangles (or trapezoids) for f over [a, b] split into n
// strips. `heightFn` is called at whatever sample point each method needs, so
// this stays pure drawing code with no integration logic of its own — the
// actual sum is computed separately by riemannSum() in numeric.js, and this
// just has to agree with it about where each strip samples.
//
// 'trap' draws a slanted quadrilateral (the straight line across each strip
// that the trapezoid rule is implicitly fitting); every other method draws a
// flat-topped rectangle. The baseline is y = 0, so this only reads correctly
// when the viewport's y-range includes 0 — every maths-lab function range does.
export function drawRiemannStrips(ctx, vp, { a, b, n, method = 'left', heightFn, fill = 'rgba(0, 229, 195, 0.28)', stroke = 'rgba(0, 229, 195, 0.75)' } = {}) {
  if (!(n > 0) || !(b > a) || typeof heightFn !== 'function') return
  const dx = (b - a) / n
  const baseY = vp.sy(0)

  ctx.save()
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1

  for (let i = 0; i < n; i += 1) {
    const x0 = a + i * dx
    const x1 = x0 + dx
    const px0 = vp.sx(x0)
    const px1 = vp.sx(x1)

    ctx.beginPath()
    if (method === 'trap') {
      const y0 = heightFn(x0)
      const y1 = heightFn(x1)
      if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue
      ctx.moveTo(px0, baseY)
      ctx.lineTo(px0, vp.sy(y0))
      ctx.lineTo(px1, vp.sy(y1))
      ctx.lineTo(px1, baseY)
    } else {
      const sampleX = method === 'right' ? x1 : method === 'mid' ? (x0 + x1) / 2 : x0
      const h = heightFn(sampleX)
      if (!Number.isFinite(h)) continue
      const py = vp.sy(h)
      ctx.moveTo(px0, baseY)
      ctx.lineTo(px0, py)
      ctx.lineTo(px1, py)
      ctx.lineTo(px1, baseY)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

// An open (hollow) point — the standard textbook mark for a value a function
// approaches but does not actually take, such as the empty end of one branch
// of a piecewise function, or a removable discontinuity's "hole". Filled with
// the pane's own background colour so it reads as a true gap in the curve
// rather than a solid dot, then outlined in the curve's colour.
export function drawOpenPoint(ctx, vp, x, y, { color = '#00e5c3', radius = 5.5, bg = '#0c162c', width = 2.2 } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const px = vp.sx(x)
  const py = vp.sy(y)
  ctx.save()
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.arc(px, py, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
  ctx.restore()
}
