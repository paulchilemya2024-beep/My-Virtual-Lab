import { BACKGROUNDS, PEN_COLORS, TOOLS, WIDTHS } from './boardConfig.js'

// The floating control bar. Every control is a plain button so the whole board
// stays keyboard-reachable; the single-letter shortcuts are in the tooltips.
export default function BoardToolbar({ board, onExport, onToggleFullscreen, isFullscreen, onClose, dense }) {
  const {
    tool, color, width, background, index, pageCount, canUndo, canRedo,
    setTool, setColor, setWidth, setBackground, undo, redo, clearPage,
    addPage, deletePage, goToPage,
  } = board

  return (
    <div className={`board-toolbar ${dense ? 'is-dense' : ''}`}>
      <div className="board-group" role="group" aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`board-btn ${tool === t.id ? 'is-active' : ''}`}
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.key.toUpperCase()})`}
            aria-pressed={tool === t.id}
            aria-label={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="board-group" role="group" aria-label="Pen colour">
        {PEN_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`board-swatch ${color === c.value && tool !== 'eraser' ? 'is-active' : ''}`}
            style={{ '--swatch': c.value }}
            onClick={() => setColor(c.value)}
            title={c.label}
            aria-pressed={color === c.value}
            aria-label={`${c.label} pen`}
          />
        ))}
      </div>

      <div className="board-group" role="group" aria-label="Stroke thickness">
        {WIDTHS.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`board-btn board-width ${width === w.value ? 'is-active' : ''}`}
            onClick={() => setWidth(w.value)}
            title={w.label}
            aria-pressed={width === w.value}
            aria-label={`${w.label} stroke`}
          >
            <span style={{ height: `${Math.min(w.value, 14)}px`, background: color }} />
          </button>
        ))}
      </div>

      <div className="board-group" role="group" aria-label="Board colour">
        {BACKGROUNDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`board-swatch board-swatch-bg ${background.id === b.id ? 'is-active' : ''}`}
            style={{ '--swatch': b.value }}
            onClick={() => setBackground(b.id)}
            title={`${b.label} board`}
            aria-pressed={background.id === b.id}
            aria-label={`${b.label} board`}
          />
        ))}
      </div>

      <div className="board-group" role="group" aria-label="History">
        <button type="button" className="board-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
        <button type="button" className="board-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">↷</button>
        <button type="button" className="board-btn" onClick={clearPage} disabled={!canUndo} title="Clear this page" aria-label="Clear page">✕</button>
      </div>

      <div className="board-group board-pages" role="group" aria-label="Pages">
        <button type="button" className="board-btn" onClick={() => goToPage(index - 1)} disabled={index === 0} title="Previous page (←)" aria-label="Previous page">‹</button>
        <span className="board-page-count" aria-live="polite">{index + 1} / {pageCount}</span>
        <button type="button" className="board-btn" onClick={() => goToPage(index + 1)} disabled={index === pageCount - 1} title="Next page (→)" aria-label="Next page">›</button>
        <button type="button" className="board-btn" onClick={addPage} title="Insert a page after this one" aria-label="Add page">+</button>
        <button type="button" className="board-btn" onClick={deletePage} title="Delete this page" aria-label="Delete page">🗑</button>
      </div>

      <div className="board-group board-group-end">
        <button type="button" className="board-btn board-btn-wide" onClick={onExport} title="Download this page as a PNG">Export</button>
        {onToggleFullscreen && (
          <button type="button" className="board-btn" onClick={onToggleFullscreen} title="Fullscreen (F)" aria-label="Toggle fullscreen">
            {isFullscreen ? '⤡' : '⤢'}
          </button>
        )}
        {onClose && (
          <button type="button" className="board-btn" onClick={onClose} title="Close the board" aria-label="Close board">✕</button>
        )}
      </div>
    </div>
  )
}