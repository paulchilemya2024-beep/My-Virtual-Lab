import { useCallback, useEffect, useRef } from 'react'

// The burette: a tall graduated column with a stopcock, per Section 14's list of
// visual elements. Press and hold the stopcock and NaOH runs into the flask at
// the chosen flow rate; release and it stops. A separate tap delivers a single
// drop, which is what the method calls for near the endpoint.
//
// The hold is driven by requestAnimationFrame rather than an interval so the
// delivered volume tracks real elapsed time. dt is clamped so that a backgrounded
// tab cannot dump the whole burette in one frame.

const MAX_DT = 0.05

export default function Burette({ remainingML, deliveredML, capacityML, onTick, onRelease, onDrop, disabled, flow, onFlowChange }) {
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  const cbRef = useRef({ onTick, onRelease })

  useEffect(() => {
    cbRef.current = { onTick, onRelease }
  })

  const stop = useCallback(() => {
    if (!rafRef.current) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    cbRef.current.onRelease?.()
  }, [])

  useEffect(() => stop, [stop])

  // A closed stopcock must not keep running if the burette empties mid-pour.
  useEffect(() => {
    if (disabled) stop()
  }, [disabled, stop])

  const start = useCallback(
    (event) => {
      if (disabled || rafRef.current) return
      event.currentTarget.setPointerCapture?.(event.pointerId)
      lastRef.current = performance.now()
      const frame = (now) => {
        const dt = Math.min(MAX_DT, (now - lastRef.current) / 1000)
        lastRef.current = now
        cbRef.current.onTick?.(dt)
        rafRef.current = requestAnimationFrame(frame)
      }
      rafRef.current = requestAnimationFrame(frame)
    },
    [disabled],
  )

  const fillPercent = capacityML > 0 ? Math.max(0, Math.min(100, (remainingML / capacityML) * 100)) : 0

  return (
    <div className="burette">
      <div className="burette-column" aria-hidden="true">
        <div className="burette-liquid" style={{ height: `${fillPercent}%` }} />
        <div className="burette-graduations" />
      </div>

      <div className="burette-readout">
        <span className="burette-delivered">{deliveredML.toFixed(2)} mL</span>
        <span className="burette-remaining">{remainingML.toFixed(1)} mL left</span>
      </div>

      <button
        type="button"
        className="stopcock"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        disabled={disabled}
        aria-label="Hold to open the stopcock"
      >
        <span className="stopcock-tap" aria-hidden="true" />
        {disabled ? 'Burette empty' : 'Hold to open'}
      </button>

      <button type="button" className="btn btn-outline btn-sm burette-drop" onClick={onDrop} disabled={disabled}>
        💧 One drop
      </button>

      <label className="burette-flow">
        <span>Flow</span>
        <input
          type="range"
          min="1"
          max="5"
          value={flow}
          onChange={(e) => onFlowChange(Number(e.target.value))}
          aria-label="Stopcock flow rate"
        />
      </label>
    </div>
  )
}
