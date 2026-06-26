import LabCanvas from './LabCanvas.jsx'
import { getChemical, chemicalSwatch } from './chemicals.js'

// Presentational shell shared by the beaker chemistry experiments: the cinematic
// canvas, the pour hint, the flow/mute controls, the reagent tray and a reset
// button. All experiment-specific content (readouts, banners, goal trackers) is
// injected through the `readouts` and `extra` slots, so every experiment keeps
// its own identity while the plumbing lives in exactly one place.
export default function BeakerStage({ sim, chemicals, hint, readouts, extra, onReset, danger, resetLabel }) {
  const { selectedChemical, selectChemical, flow, setFlow, muted, setMuted, getTarget, pourHandlers, soundRef } = sim

  return (
    <>
      <div className={`lab-visualization ${danger ? 'is-danger' : ''}`}>
        <LabCanvas
          getTarget={getTarget}
          streamColor={selectedChemical ? chemicalSwatch(selectedChemical) : null}
          canPour={!!selectedChemical}
          onPourStart={pourHandlers.onPourStart}
          onPourTick={pourHandlers.onPourTick}
          onPourEnd={pourHandlers.onPourEnd}
          soundRef={soundRef}
        />
        <p className="pour-hint">
          {selectedChemical
            ? `Press and hold the beaker to pour ${getChemical(selectedChemical).name} — release to stop.`
            : hint || 'Select a reagent below, then press and hold the beaker to pour.'}
        </p>
      </div>

      {readouts}
      {extra}

      <h2>Controls</h2>
      <div className="control-row">
        <div className="control-group">
          <label>Flow rate</label>
          <input
            type="range"
            min="1"
            max="5"
            value={flow}
            onChange={(e) => setFlow(Number(e.target.value))}
            aria-label="Pour flow rate"
          />
          <span>{flow} (slow → fast)</span>
        </div>
        <button
          type="button"
          className={`btn btn-sm btn-outline mute-btn ${muted ? 'is-muted' : ''}`}
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
        >
          {muted ? '🔇 Sound off' : '🔊 Sound on'}
        </button>
      </div>

      <div className="chemical-panel">
        {chemicals.map((c) => (
          <button
            key={c}
            type="button"
            className={`chemical-item ${selectedChemical === c ? 'selected' : ''}`}
            onClick={() => selectChemical(c)}
            title={getChemical(c).hint}
          >
            <span className="chemical-swatch" style={{ backgroundColor: chemicalSwatch(c) }} />
            {getChemical(c).name}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-outline btn-full btn-sm" onClick={onReset}>
        {resetLabel || '↺ Reset flask'}
      </button>
    </>
  )
}
