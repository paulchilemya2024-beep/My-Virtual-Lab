// Shared constants for the lecture board. Everything the toolbar offers is
// declared here so adding a colour or a background is a one-line change.

// The board is a fixed logical surface that gets scaled to fit whatever space
// it is given. Strokes are therefore stored in board coordinates, which keeps a
// saved board looking identical on a laptop, a tablet and a projector.
export const BOARD_W = 1600
export const BOARD_H = 900

export const PEN_COLORS = [
  { id: 'chalk', label: 'Chalk', value: '#f4f8ff' },
  { id: 'yellow', label: 'Yellow', value: '#ffd94a' },
  { id: 'cyan', label: 'Cyan', value: '#38d9f8' },
  { id: 'green', label: 'Green', value: '#2fe08d' },
  { id: 'orange', label: 'Orange', value: '#ff9a3c' },
  { id: 'pink', label: 'Pink', value: '#ff6fae' },
  { id: 'violet', label: 'Violet', value: '#a78bfa' },
  { id: 'red', label: 'Red', value: '#ff5d5d' },
  { id: 'ink', label: 'Ink', value: '#0b1220' },
]

// `light: true` backgrounds need dark ink — the board swaps the pen colour
// automatically when you cross between a dark board and a white one.
export const BACKGROUNDS = [
  { id: 'slate', label: 'Slate', value: '#0b1220', light: false },
  { id: 'black', label: 'Black', value: '#000000', light: false },
  { id: 'chalkboard', label: 'Chalkboard', value: '#12352b', light: false },
  { id: 'navy', label: 'Navy', value: '#0a1b3d', light: false },
  { id: 'graphite', label: 'Graphite', value: '#1c1f26', light: false },
  { id: 'white', label: 'Whiteboard', value: '#f7f9fc', light: true },
]

export const WIDTHS = [
  { id: 'fine', label: 'Fine', value: 3 },
  { id: 'medium', label: 'Medium', value: 6 },
  { id: 'bold', label: 'Bold', value: 11 },
  { id: 'marker', label: 'Marker', value: 20 },
]

export const TOOLS = [
  { id: 'pen', label: 'Pen', icon: '✎', key: 'p' },
  { id: 'eraser', label: 'Eraser', icon: '⌫', key: 'e' },
  { id: 'line', label: 'Line', icon: '╱', key: 'l' },
  { id: 'arrow', label: 'Arrow', icon: '↗', key: 'a' },
  { id: 'rect', label: 'Rectangle', icon: '▭', key: 'r' },
  { id: 'ellipse', label: 'Ellipse', icon: '◯', key: 'o' },
]

// Tools that are dragged out from a start point rather than drawn freehand.
export const SHAPE_TOOLS = new Set(['line', 'arrow', 'rect', 'ellipse'])

export const DEFAULT_PEN = PEN_COLORS[0].value
export const DEFAULT_INK = PEN_COLORS[PEN_COLORS.length - 1].value

export function backgroundById(id) {
  return BACKGROUNDS.find((b) => b.id === id) || BACKGROUNDS[0]
}