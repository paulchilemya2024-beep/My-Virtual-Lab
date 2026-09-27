import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BACKGROUNDS, DEFAULT_INK, DEFAULT_PEN, WIDTHS, backgroundById } from './boardConfig.js'

// Board state: pages of strokes, the active tool, and localStorage persistence.
// Nothing is sent to the server — a board lives in the browser it was drawn in
// until it is exported as a PNG.

const STORAGE_VERSION = 1

function emptyPage(id) {
  return { id, strokes: [], redo: [] }
}

function freshState() {
  return {
    pages: [emptyPage(1)],
    index: 0,
    background: BACKGROUNDS[0].id,
    tool: 'pen',
    color: DEFAULT_PEN,
    width: WIDTHS[1].value,
  }
}

function load(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return freshState()
    const saved = JSON.parse(raw)
    if (saved?.v !== STORAGE_VERSION || !Array.isArray(saved.pages) || saved.pages.length === 0) {
      return freshState()
    }
    const base = freshState()
    return {
      ...base,
      ...saved,
      pages: saved.pages.map((p, i) => ({ id: p.id ?? i + 1, strokes: p.strokes || [], redo: [] })),
      index: Math.min(saved.index || 0, saved.pages.length - 1),
    }
  } catch {
    return freshState() // corrupt or unavailable storage — start clean rather than crash
  }
}

export default function useBoard(storageKey) {
  const [state, setState] = useState(() => load(storageKey))
  const [storageFull, setStorageFull] = useState(false)
  const nextId = useRef(0)

  // Reloading a different board (e.g. a per-experiment scratchpad) swaps state.
  const firstKey = useRef(storageKey)
  useEffect(() => {
    if (firstKey.current === storageKey) return
    firstKey.current = storageKey
    setState(load(storageKey))
    setStorageFull(false)
  }, [storageKey])

  // Debounced save. Strokes are the bulk of the payload, so `redo` is dropped.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const payload = {
          v: STORAGE_VERSION,
          background: state.background,
          index: state.index,
          tool: state.tool,
          color: state.color,
          width: state.width,
          pages: state.pages.map((p) => ({ id: p.id, strokes: p.strokes })),
        }
        window.localStorage.setItem(storageKey, JSON.stringify(payload))
        setStorageFull(false)
      } catch {
        setStorageFull(true) // quota exceeded or storage disabled — warn, keep drawing
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [state, storageKey])

  const page = state.pages[state.index]

  const patchPage = useCallback((updater) => {
    setState((prev) => {
      const pages = prev.pages.slice()
      pages[prev.index] = updater(pages[prev.index])
      return { ...prev, pages }
    })
  }, [])

  const addStroke = useCallback(
    (stroke) => patchPage((p) => ({ ...p, strokes: [...p.strokes, stroke], redo: [] })),
    [patchPage]
  )

  const undo = useCallback(
    () =>
      patchPage((p) => {
        if (p.strokes.length === 0) return p
        const strokes = p.strokes.slice()
        const popped = strokes.pop()
        return { ...p, strokes, redo: [...p.redo, popped] }
      }),
    [patchPage]
  )

  const redo = useCallback(
    () =>
      patchPage((p) => {
        if (p.redo.length === 0) return p
        const stack = p.redo.slice()
        const restored = stack.pop()
        return { ...p, strokes: [...p.strokes, restored], redo: stack }
      }),
    [patchPage]
  )

  const clearPage = useCallback(
    () => patchPage((p) => (p.strokes.length ? { ...p, strokes: [], redo: [...p.redo, ...p.strokes] } : p)),
    [patchPage]
  )

  const addPage = useCallback(() => {
    setState((prev) => {
      nextId.current = Math.max(nextId.current, ...prev.pages.map((p) => p.id)) + 1
      const pages = [...prev.pages.slice(0, prev.index + 1), emptyPage(nextId.current), ...prev.pages.slice(prev.index + 1)]
      return { ...prev, pages, index: prev.index + 1 }
    })
  }, [])

  const deletePage = useCallback(() => {
    setState((prev) => {
      if (prev.pages.length === 1) return { ...prev, pages: [emptyPage(prev.pages[0].id)], index: 0 }
      const pages = prev.pages.filter((_, i) => i !== prev.index)
      return { ...prev, pages, index: Math.min(prev.index, pages.length - 1) }
    })
  }, [])

  const goToPage = useCallback((i) => {
    setState((prev) => ({ ...prev, index: Math.max(0, Math.min(i, prev.pages.length - 1)) }))
  }, [])

  const setTool = useCallback((tool) => setState((prev) => ({ ...prev, tool })), [])
  const setColor = useCallback((color) => setState((prev) => ({ ...prev, color, tool: prev.tool === 'eraser' ? 'pen' : prev.tool })), [])
  const setWidth = useCallback((width) => setState((prev) => ({ ...prev, width })), [])

  // Crossing between a dark board and a white one swaps the default ink so the
  // instructor never writes white-on-white by accident.
  const setBackground = useCallback((id) => {
    setState((prev) => {
      const wasLight = backgroundById(prev.background).light
      const isLight = backgroundById(id).light
      let color = prev.color
      if (isLight && !wasLight && color === DEFAULT_PEN) color = DEFAULT_INK
      if (!isLight && wasLight && color === DEFAULT_INK) color = DEFAULT_PEN
      return { ...prev, background: id, color }
    })
  }, [])

  const background = useMemo(() => backgroundById(state.background), [state.background])

  return {
    ...state,
    page,
    background,
    pageCount: state.pages.length,
    canUndo: page.strokes.length > 0,
    canRedo: page.redo.length > 0,
    storageFull,
    addStroke,
    undo,
    redo,
    clearPage,
    addPage,
    deletePage,
    goToPage,
    setTool,
    setColor,
    setWidth,
    setBackground,
  }
}