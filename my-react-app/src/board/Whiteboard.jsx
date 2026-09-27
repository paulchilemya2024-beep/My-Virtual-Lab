import { useCallback, useEffect, useRef, useState } from 'react'
import { BOARD_H, BOARD_W, SHAPE_TOOLS, TOOLS } from './boardConfig.js'
import { createFreehandStroke, drawDot, drawSegment, drawStroke, pointCount, pushPoint, renderStrokes, renderToImageCanvas } from './boardDraw.js'
import BoardToolbar from './BoardToolbar.jsx'
import useBoard from './useBoard.js'

// A chalkboard you write on with a mouse, a finger or a stylus — the lecture
// surface used by /board and by the scratchpad inside a lab.
//
// Two stacked canvases sit on the coloured board frame:
//   • base    — every committed stroke. Freehand and eraser marks are also
//               painted here live, so what you see mid-stroke is exactly what
//               the final render produces.
//   • overlay — the rubber-band preview while a shape is being dragged out, and
//               the element that receives all pointer events.
export default function Whiteboard({
  storageKey = 'stemlab.board.main',
  fileName = 'stemlab-board',
  onClose,
  dense = false,
  allowFullscreen = true,
}) {
  const board = useBoard(storageKey)
  const rootRef = useRef(null)
  const frameRef = useRef(null)
  const baseRef = useRef(null)
  const overlayRef = useRef(null)
  const drawingRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Live mirror so the pointer handlers and the resize observer always read the
  // current tool and page. Declared before the repaint effect below so that it
  // is already up to date by the time the scene is rebuilt.
  const settingsRef = useRef(board)
  useEffect(() => {
    settingsRef.current = board
  })

  const strokes = board.page.strokes

  const repaint = useCallback(() => {
    const ctx = baseRef.current?.getContext('2d')
    if (ctx) renderStrokes(ctx, settingsRef.current.page.strokes)
  }, [])

  // Match the backing store to the on-screen size (and pixel density) so lines
  // stay crisp on a retina laptop and on a projector alike. Drawing code always
  // works in 1600×900 board coordinates.
  const syncSize = useCallback(() => {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    if (rect.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(rect.width * dpr))
    const h = Math.max(1, Math.round(rect.width * (BOARD_H / BOARD_W) * dpr))
    for (const canvas of [baseRef.current, overlayRef.current]) {
      if (!canvas) continue
      canvas.width = w
      canvas.height = h
      const scale = w / BOARD_W
      canvas.getContext('2d').setTransform(scale, 0, 0, scale, 0, 0)
    }
    repaint()
  }, [repaint])

  useEffect(() => {
    syncSize()
    const observer = new ResizeObserver(syncSize)
    if (frameRef.current) observer.observe(frameRef.current)
    return () => observer.disconnect()
  }, [syncSize])

  // Rebuild the scene whenever the stroke list changes — undo, redo, clear, a
  // page turn, or the commit at the end of a stroke.
  useEffect(() => {
    repaint()
  }, [strokes, repaint])

  // ── Pointer input ────────────────────────────────────────────────────────
  function toBoardPoint(event) {
    const rect = overlayRef.current.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * BOARD_W,
      y: ((event.clientY - rect.top) / rect.height) * BOARD_H,
    }
  }

  // A stylus tapers with pressure; a mouse or finger draws at a constant width.
  function widthFor(event) {
    const { tool, width } = settingsRef.current
    if (tool === 'eraser') return Math.max(20, width * 3)
    if (event.pointerType === 'pen' && event.pressure > 0) return width * (0.45 + 0.9 * event.pressure)
    return width
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const { tool, color } = settingsRef.current
    const point = toBoardPoint(event)
    overlayRef.current.setPointerCapture(event.pointerId)

    if (SHAPE_TOOLS.has(tool)) {
      drawingRef.current = {
        kind: 'shape',
        shape: { tool, color, width: settingsRef.current.width, x0: point.x, y0: point.y, x1: point.x, y1: point.y },
      }
      return
    }

    const stroke = createFreehandStroke(tool, color, settingsRef.current.width)
    pushPoint(stroke, point.x, point.y, widthFor(event))
    drawDot(baseRef.current.getContext('2d'), stroke)
    drawingRef.current = { kind: 'free', stroke }
  }

  function handlePointerMove(event) {
    const current = drawingRef.current
    if (!current) return

    if (current.kind === 'shape') {
      const point = toBoardPoint(event)
      current.shape.x1 = point.x
      current.shape.y1 = point.y
      const ctx = overlayRef.current.getContext('2d')
      ctx.clearRect(0, 0, BOARD_W, BOARD_H)
      drawStroke(ctx, current.shape)
      return
    }

    // Coalesced events recover the full stylus sample rate, which is what makes
    // fast handwriting come out smooth instead of faceted.
    const samples = event.getCoalescedEvents ? event.getCoalescedEvents() : [event]
    const ctx = baseRef.current.getContext('2d')
    for (const sample of samples.length ? samples : [event]) {
      const point = toBoardPoint(sample)
      pushPoint(current.stroke, point.x, point.y, widthFor(sample))
      drawSegment(ctx, current.stroke, pointCount(current.stroke) - 2)
    }
  }

  function handlePointerUp() {
    const current = drawingRef.current
    if (!current) return
    drawingRef.current = null

    if (current.kind === 'shape') {
      const { x0, y0, x1, y1 } = current.shape
      overlayRef.current.getContext('2d').clearRect(0, 0, BOARD_W, BOARD_H)
      if (Math.hypot(x1 - x0, y1 - y0) > 3) board.addStroke(current.shape)
      return
    }
    board.addStroke(current.stroke)
  }

  // ── Fullscreen, export, shortcuts ────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen()
    else rootRef.current?.requestFullscreen?.()
  }, [])

  const exportPng = useCallback(() => {
    const { page, background, index } = settingsRef.current
    const canvas = renderToImageCanvas(page.strokes, background.value, 2)
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileName}-page-${index + 1}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }, [fileName])

  useEffect(() => {
    function onKeyDown(event) {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return
      const b = settingsRef.current
      const key = event.key.toLowerCase()

      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) b.redo()
        else b.undo()
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault()
        b.redo()
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return

      if (key === 'arrowleft') return b.goToPage(b.index - 1)
      if (key === 'arrowright') return b.goToPage(b.index + 1)
      if (key === 'f' && allowFullscreen) return toggleFullscreen()

      const tool = TOOLS.find((t) => t.key === key)
      if (tool) b.setTool(tool.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [allowFullscreen, toggleFullscreen])

  const isShape = SHAPE_TOOLS.has(board.tool)

  return (
    <div ref={rootRef} className={`board-root ${dense ? 'is-dense' : ''}`} style={{ '--board-bg': board.background.value }}>
      <BoardToolbar
        board={board}
        onExport={exportPng}
        onToggleFullscreen={allowFullscreen ? toggleFullscreen : null}
        isFullscreen={isFullscreen}
        onClose={onClose}
        dense={dense}
      />

      {board.storageFull && (
        <p className="board-warning" role="status">
          This board is too large to save in your browser. Export the pages you need — new strokes may not survive a refresh.
        </p>
      )}

      <div className="board-stage">
        <div ref={frameRef} className={`board-frame ${board.background.light ? 'is-light' : ''}`}>
          <canvas ref={baseRef} className="board-canvas" />
          <canvas
            ref={overlayRef}
            className={`board-canvas board-overlay ${isShape ? 'is-shape' : ''} ${board.tool === 'eraser' ? 'is-eraser' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {strokes.length === 0 && (
            <p className="board-hint">
              {isShape ? 'Drag to draw a shape.' : 'Start writing.'} Press P for pen, E for eraser, ← → to change page.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}