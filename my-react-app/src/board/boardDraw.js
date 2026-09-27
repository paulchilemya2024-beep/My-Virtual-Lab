// Pure rendering helpers for the lecture board. Nothing here touches React —
// they take a 2D context already scaled to board coordinates and paint on it.
//
// The board canvas is kept TRANSPARENT and the background colour is painted by
// CSS behind it. That is what lets the eraser use `destination-out`: erasing
// punches a hole back to the board colour instead of smearing paint over it,
// and it replays correctly when strokes are redrawn after an undo.
import { BOARD_W, BOARD_H } from './boardConfig.js'

// Freehand strokes store flat triples [x, y, width, x, y, width, …] so a stylus
// can taper the line with pressure without inflating the saved JSON too much.
export function createFreehandStroke(tool, color, width) {
  return { tool, color, width, points: [] }
}

export function pushPoint(stroke, x, y, width) {
  stroke.points.push(round(x), round(y), round(width))
}

export function pointCount(stroke) {
  return stroke.points.length / 3
}

function round(n) {
  return Math.round(n * 10) / 10
}

function applyToolMode(ctx, tool) {
  ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
}

// Paints one freehand segment. Called live while drawing (so the board reacts
// instantly) and again from renderStrokes when the scene is rebuilt.
export function drawSegment(ctx, stroke, fromIndex) {
  const p = stroke.points
  const i = fromIndex * 3
  if (i + 3 >= p.length) return

  applyToolMode(ctx, stroke.tool)
  ctx.strokeStyle = stroke.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = (p[i + 2] + p[i + 5]) / 2
  ctx.beginPath()
  ctx.moveTo(p[i], p[i + 1])
  ctx.lineTo(p[i + 3], p[i + 4])
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
}

// A tap with no drag still deserves a mark, so a single point renders as a dot.
export function drawDot(ctx, stroke) {
  const p = stroke.points
  if (p.length < 3) return
  applyToolMode(ctx, stroke.tool)
  ctx.fillStyle = stroke.color
  ctx.beginPath()
  ctx.arc(p[0], p[1], p[2] / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

function drawFreehand(ctx, stroke) {
  const count = pointCount(stroke)
  if (count === 1) {
    drawDot(ctx, stroke)
    return
  }
  for (let i = 0; i < count - 1; i += 1) drawSegment(ctx, stroke, i)
}

function drawArrowHead(ctx, x0, y0, x1, y1, width) {
  const angle = Math.atan2(y1 - y0, x1 - x0)
  const size = Math.max(14, width * 3.5)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - size * Math.cos(angle - Math.PI / 7), y1 - size * Math.sin(angle - Math.PI / 7))
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - size * Math.cos(angle + Math.PI / 7), y1 - size * Math.sin(angle + Math.PI / 7))
  ctx.stroke()
}

function drawShape(ctx, shape) {
  const { tool, color, width, x0, y0, x1, y1 } = shape
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (tool === 'line' || tool === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    if (tool === 'arrow') drawArrowHead(ctx, x0, y0, x1, y1, width)
    return
  }

  if (tool === 'rect') {
    ctx.beginPath()
    ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
    ctx.stroke()
    return
  }

  if (tool === 'ellipse') {
    const rx = Math.abs(x1 - x0) / 2
    const ry = Math.abs(y1 - y0) / 2
    ctx.beginPath()
    ctx.ellipse(Math.min(x0, x1) + rx, Math.min(y0, y1) + ry, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
}

export function drawStroke(ctx, stroke) {
  if (stroke.points) drawFreehand(ctx, stroke)
  else drawShape(ctx, stroke)
}

export function renderStrokes(ctx, strokes) {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H)
  for (const stroke of strokes) drawStroke(ctx, stroke)
}

// Flattens a page onto an opaque bitmap for PNG export. Strokes go onto their
// own transparent layer first so eraser holes reveal the board colour rather
// than punching through to transparency.
export function renderToImageCanvas(strokes, backgroundColor, scale = 2) {
  const layer = document.createElement('canvas')
  layer.width = BOARD_W * scale
  layer.height = BOARD_H * scale
  const layerCtx = layer.getContext('2d')
  layerCtx.scale(scale, scale)
  renderStrokes(layerCtx, strokes)

  const out = document.createElement('canvas')
  out.width = layer.width
  out.height = layer.height
  const outCtx = out.getContext('2d')
  outCtx.fillStyle = backgroundColor
  outCtx.fillRect(0, 0, out.width, out.height)
  outCtx.drawImage(layer, 0, 0)
  return out
}