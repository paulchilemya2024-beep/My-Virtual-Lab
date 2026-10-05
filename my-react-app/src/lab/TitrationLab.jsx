import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BURETTE_CAPACITY_ML,
  C_ACID,
  C_BASE,
  DROP_ML,
  DROPS_OF_INDICATOR,
  PIPETTE_ML,
  createFlask,
  equivalenceForFlask,
  flaskPH,
  flaskTemp,
  flaskVolumeML,
} from './titration.js'
import { getChemical, chemicalSwatch } from './chemicals.js'
import SoundEngine from './sound.js'
import LabCanvas from './LabCanvas.jsx'
import { AnimatedNumber, Thermometer } from './Instruments.jsx'
import TitrationCurve from './TitrationCurve.jsx'
import Burette from './Burette.jsx'

// Acid–base titration, built to Section 14 of the System Design document.
//
// The student performs every step themselves: they pick a reagent off the shelf,
// pick the right instrument for it, and deliver it into the flask — measuring
// the 25 mL of acid with their own hand and eye. Nothing is done for them and no
// step completes without the action that earns it.
//
//   1. Add 25 mL of HCl to the flask     — pipette it, or free-pour and judge it
//   2. Add 3 drops of phenolphthalein    — dropper, one drop per press
//   3. Fill the burette with NaOH        — funnel
//   4. Open the stopcock, add NaOH       — press and hold the stopcock
//   5. Watch the meter and the colour    — record what you observe
//   6. Stop at the endpoint              — record the final result
//
// Choosing the wrong reagent or the wrong tool is allowed, produces a visible
// consequence, and is logged to the mistake log rather than blocked.
//
// Chemistry lives in titration.js and works from what is ACTUALLY in the flask,
// so over-measuring the acid genuinely moves the equivalence point.

const AMBIENT = 22
const FLASK_CAPACITY_ML = 150 // conical flask — plenty of headroom over 50 mL
const CANVAS_FULL_ML = 60 // volume at which the drawn flask reads full

// The instruments on the bench. `use` names what each is for, and is shown to
// the student — picking the wrong one is a teachable mistake, not a trap.
const TOOLS = [
  { id: 'pipette', label: 'Pipette', icon: '💉', use: `Transfers exactly ${PIPETTE_ML} mL — for measuring the analyte` },
  { id: 'dropper', label: 'Dropper', icon: '💧', use: `One ${DROP_ML} mL drop per press — for the indicator` },
  { id: 'funnel', label: 'Funnel', icon: '🔻', use: 'For filling the burette without spilling' },
]

const EMPTY_TARGET = {
  volume: 0,
  color: { r: 255, g: 255, b: 255, a: 0 },
  gas: { active: false, foam: false, rate: 0, name: null },
  precipitate: { active: false, color: { r: 240, g: 240, b: 245 }, amount: 0 },
  exothermic: false,
  danger: false,
  solids: [],
}

// Phenolphthalein: colourless below pH 8.2, magenta-pink above. With no
// indicator in the flask the solution stays clear however far you titrate —
// skipping step 2 costs you the visual endpoint, exactly as on a real bench.
function liquidColor(ph, indicatorDrops) {
  if (ph == null) return { r: 255, g: 255, b: 255, a: 0 }
  if (indicatorDrops <= 0 || ph < 8.2) return { r: 236, g: 245, b: 252, a: 0.34 }
  const t = Math.min(1, (ph - 8.2) / 1.8)
  // More indicator gives a deeper colour, which is why 3 drops is the spec.
  const strength = Math.min(1, indicatorDrops / DROPS_OF_INDICATOR)
  return { r: 233, g: 30, b: 140, a: (0.35 + t * 0.45) * strength }
}

function describeColour(ph, indicatorDrops) {
  if (ph == null) return 'empty'
  if (indicatorDrops <= 0) return 'clear and colourless (no indicator)'
  if (ph < 8.2) return 'colourless'
  if (ph < 9) return 'faint pink'
  return 'deep pink'
}

export default function TitrationLab({ lab }) {
  const { experiment, setProgress, setSummary, addMistake } = lab
  const totalSteps = experiment?.steps?.length || 6
  const phWindow = experiment?.successCriteria?.finalPH || { min: 6.8, max: 7.2 }

  const [flask, setFlask] = useState(createFlask)
  const [buretteML, setBuretteML] = useState(0) // NaOH remaining in the burette
  const [delivered, setDelivered] = useState(0) // NaOH delivered from it so far
  const [reagent, setReagent] = useState('')
  const [tool, setTool] = useState('')
  const [flow, setFlow] = useState(2)
  const [muted, setMuted] = useState(false)
  const [observations, setObservations] = useState([])
  const [readings, setReadings] = useState([])
  const [finalResult, setFinalResult] = useState(null)
  const [points, setPoints] = useState([])
  const [reached, setReached] = useState(false)

  // Refs are the source of truth for anything the pour loops mutate many times a
  // second; the state above mirrors them for rendering. Reading a value back out
  // of a setState updater does not work — React queues updaters rather than
  // running them inline — so the arithmetic has to happen here.
  const flaskRef = useRef(createFlask())
  const buretteRef = useRef(0)
  const deliveredRef = useRef(0)

  const targetRef = useRef(EMPTY_TARGET)
  const soundRef = useRef(null)
  const fizzTimerRef = useRef(0)
  const lastSyncRef = useRef(0)
  const reachedRef = useRef(false)
  const obsIdRef = useRef(0)

  const ph = flaskPH(flask)
  const temp = flaskTemp(flask, AMBIENT)
  const volume = flaskVolumeML(flask)
  const equivalence = equivalenceForFlask(flask)

  // ── Step completion. Every flag is the consequence of a real action. ──
  const steps = useMemo(
    () => ({
      1: flask.hclML >= 24.5 && flask.hclML <= 25.5,
      2: flask.indicatorDrops >= DROPS_OF_INDICATOR,
      3: buretteML > 0 || delivered > 0,
      4: delivered > 0,
      5: readings.length >= 1,
      6: finalResult?.accepted === true,
    }),
    [flask, buretteML, delivered, readings.length, finalResult],
  )
  const completedSteps = useMemo(() => Object.values(steps).filter(Boolean).length, [steps])

  useEffect(() => {
    setProgress({ completed: completedSteps, total: totalSteps })
  }, [completedSteps, totalSteps, setProgress])

  // Repaint the drawn flask straight from the refs. Cheap, no React involved, so
  // the canvas stays smooth even while the state mirror below is throttled.
  const refreshTarget = useCallback(() => {
    const f = flaskRef.current
    const current = flaskPH(f)
    targetRef.current = {
      ...targetRef.current,
      volume: Math.min(CANVAS_FULL_ML, flaskVolumeML(f)) * (30 / CANVAS_FULL_ML),
      color: liquidColor(current, f.indicatorDrops),
      exothermic: current != null && f.naohML > 0 && f.hclML > 0,
    }
  }, [])

  // Mirror the refs into React state for the readouts. Throttled to ~10 Hz while
  // a pour is running — the numbers stay legible and we avoid a re-render per
  // frame — then forced once the student lets go.
  const syncFlask = useCallback(
    ({ force = true } = {}) => {
      refreshTarget()
      const now = performance.now()
      if (!force && now - lastSyncRef.current < 100) return
      lastSyncRef.current = now
      setFlask({ ...flaskRef.current })
      setBuretteML(buretteRef.current)
      setDelivered(deliveredRef.current)
    },
    [refreshTarget],
  )

  // Live mirror of the selection for the canvas' animation loop.
  const liveRef = useRef({ reagent })
  useEffect(() => {
    liveRef.current = { reagent }
  })

  useEffect(() => {
    soundRef.current = new SoundEngine()
    const engine = soundRef.current
    return () => {
      window.clearTimeout(fizzTimerRef.current)
      engine.dispose()
    }
  }, [])
  useEffect(() => {
    soundRef.current?.setMuted(muted)
  }, [muted])

  const getTarget = useCallback(() => targetRef.current, [])

  const observe = useCallback((text, tone = 'info') => {
    obsIdRef.current += 1
    const entry = { id: obsIdRef.current, text, tone }
    setObservations((prev) => [...prev.slice(-40), entry])
  }, [])

  // A short burst of bubbles — the design doc's "if wrong chemicals mixed,
  // bubbles animate" feedback.
  const fizz = useCallback(() => {
    targetRef.current = { ...targetRef.current, gas: { active: true, foam: true, rate: 0.85, name: 'gas' } }
    soundRef.current?.play?.('bubbles')
    window.clearTimeout(fizzTimerRef.current)
    fizzTimerRef.current = window.setTimeout(() => {
      targetRef.current = { ...targetRef.current, gas: { active: false, foam: false, rate: 0, name: null } }
    }, 2500)
  }, [])

  const logMistake = useCallback(
    (step, action, advice) => {
      addMistake?.({ step, action })
      observe(`${action} ${advice}`, 'warn')
    },
    [addMistake, observe],
  )

  // ── Adding a reagent to the flask ────────────────────────────────────────
  // `amount` in mL; `viaDrops` counts indicator drops instead of volume.
  const addToFlask = useCallback(
    (name, amount, { silent = false, force = true } = {}) => {
      const f = flaskRef.current
      if (flaskVolumeML(f) + amount > FLASK_CAPACITY_ML) return
      if (name === 'Phenolphthalein') f.indicatorDrops += Math.round(amount / DROP_ML)
      else if (name === 'HCl') f.hclML += amount
      else if (name === 'NaOH') f.naohML += amount
      else f.waterML += amount
      syncFlask({ force })
      if (!silent) soundRef.current?.resume()
    },
    [syncFlask],
  )

  // Using the selected instrument with the selected reagent. This is where most
  // of the teaching happens: the right pairing does the job, the wrong pairing
  // does something visibly wrong and says why.
  function useTool() {
    if (!reagent || !tool) return
    const name = getChemical(reagent).name
    soundRef.current?.resume()

    if (tool === 'funnel') {
      if (reagent !== 'NaOH') {
        logMistake(3, `Used the funnel to put ${name} in the burette.`, 'The burette holds the titrant — that is the NaOH.')
        fizz()
        return
      }
      buretteRef.current = BURETTE_CAPACITY_ML
      syncFlask()
      soundRef.current?.clink()
      observe(`Burette filled to ${BURETTE_CAPACITY_ML.toFixed(1)} mL with ${C_BASE} M NaOH and zeroed.`, 'ok')
      return
    }

    if (tool === 'pipette') {
      if (reagent === 'Phenolphthalein') {
        logMistake(2, `Pipetted ${PIPETTE_ML} mL of indicator into the flask.`, 'The indicator is used three drops at a time — a dropper is the tool for it.')
        addToFlask(reagent, PIPETTE_ML)
        fizz()
        return
      }
      if (reagent === 'NaOH') {
        logMistake(4, `Pipetted ${PIPETTE_ML} mL of NaOH straight into the flask.`, 'The titrant must come from the burette so you can measure how much you added.')
        addToFlask(reagent, PIPETTE_ML)
        fizz()
        return
      }
      addToFlask(reagent, PIPETTE_ML)
      soundRef.current?.clink()
      observe(
        reagent === 'HCl'
          ? `Pipetted ${PIPETTE_ML.toFixed(1)} mL of ${C_ACID} M HCl into the conical flask.`
          : `Pipetted ${PIPETTE_ML.toFixed(1)} mL of ${name} into the flask.`,
        'ok',
      )
      return
    }

    if (tool === 'dropper') {
      addToFlask(reagent, DROP_ML)
      if (reagent === 'Phenolphthalein') {
        const next = flask.indicatorDrops + 1
        observe(
          next < DROPS_OF_INDICATOR
            ? `Drop ${next} of phenolphthalein added — ${DROPS_OF_INDICATOR - next} to go. No colour change; the flask is acidic.`
            : `Drop ${next} of phenolphthalein added. Still colourless — that is expected in acid.`,
          'ok',
        )
        return
      }
      if (reagent === 'HCl') {
        logMistake(1, 'Added the acid one drop at a time.', `A dropper cannot measure ${PIPETTE_ML} mL — use the pipette, or pour and watch the volume.`)
        return
      }
      logMistake(4, `Dropped ${name} straight into the flask.`, 'The titrant belongs in the burette.')
      fizz()
    }
  }

  // ── Free pour: press and hold the flask to pour the selected reagent ──
  const handlePourStart = useCallback(() => {
    const { reagent: sel } = liveRef.current
    if (!sel) return
    soundRef.current?.resume()
  }, [])

  const handlePourTick = useCallback(
    (dt) => {
      const { reagent: sel } = liveRef.current
      if (!sel) return
      addToFlask(sel, 3.0 * dt, { silent: true, force: false })
    },
    [addToFlask],
  )

  const handlePourEnd = useCallback(() => {
    const { reagent: sel } = liveRef.current
    if (!sel) return
    const current = flaskRef.current
    const name = getChemical(sel).name
    if (sel === 'HCl') {
      const v = current.hclML
      if (v > 25.5) logMistake(1, `Poured ${v.toFixed(1)} mL of HCl — over the ${PIPETTE_ML} mL the method calls for.`, 'Equivalence has moved with it; pour more slowly, or use the pipette.')
      else if (v >= 24.5) observe(`${v.toFixed(1)} mL of HCl in the flask — well measured. The pH meter reads ${(flaskPH(current) ?? 0).toFixed(2)}.`, 'ok')
      else observe(`${v.toFixed(1)} mL of HCl so far — short of ${PIPETTE_ML} mL.`, 'info')
      return
    }
    if (sel === 'NaOH') {
      logMistake(4, 'Poured NaOH straight into the flask.', 'You cannot measure the titrant that way — it must run from the burette.')
      fizz()
      return
    }
    observe(`Added ${name} to the flask. Volume is now ${flaskVolumeML(current).toFixed(1)} mL.`, 'info')
  }, [fizz, logMistake, observe])

  // ── The burette stopcock ─────────────────────────────────────────────────
  const deliverBase = useCallback(
    (amount, { force = true } = {}) => {
      const given = Math.min(buretteRef.current, amount)
      if (given <= 0) return

      buretteRef.current -= given
      deliveredRef.current += given
      flaskRef.current.naohML += given
      syncFlask({ force })

      const nextPh = flaskPH(flaskRef.current)
      if (!reachedRef.current && nextPh != null && nextPh >= 7) {
        reachedRef.current = true
        setReached(true)
        soundRef.current?.play?.('endpoint')
      }

      // Plot the curve the student is actually walking, not the ideal one.
      const v = Number(deliveredRef.current.toFixed(2))
      setPoints((pts) => {
        if (pts.length && Math.abs(pts[pts.length - 1].v - v) < 0.02) return pts
        const appended = [...pts, { v, ph: nextPh ?? 7 }]
        return appended.length > 800 ? appended.slice(appended.length - 800) : appended
      })
    },
    [syncFlask],
  )

  const handleStopcockTick = useCallback(
    (dt) => {
      deliverBase(0.35 * flow * dt, { force: false })
    },
    [deliverBase, flow],
  )

  // Releasing the stopcock flushes whatever the throttle was holding back.
  const handleStopcockEnd = useCallback(() => {
    syncFlask({ force: true })
  }, [syncFlask])

  // ── Recording results (design doc step 8) ────────────────────────────────
  function recordReading() {
    if (ph == null) return
    setReadings((prev) => [
      ...prev,
      {
        n: prev.length + 1,
        burette: Number(delivered.toFixed(2)),
        ph: Number(ph.toFixed(2)),
        colour: describeColour(ph, flask.indicatorDrops),
      },
    ])
    soundRef.current?.play?.('beep')
    observe(`Reading recorded: ${delivered.toFixed(2)} mL delivered, pH ${ph.toFixed(2)}, solution ${describeColour(ph, flask.indicatorDrops)}.`, 'ok')
  }

  function recordFinalResult() {
    if (ph == null) return
    const accepted = ph >= phWindow.min && ph <= phWindow.max
    const overshoot = Math.max(0, delivered - equivalence)

    if (!accepted) {
      logMistake(
        6,
        `Called the endpoint at ${delivered.toFixed(2)} mL (pH ${ph.toFixed(2)}).`,
        ph < phWindow.min
          ? 'Still acidic — there is unreacted HCl left. Keep going, one drop at a time.'
          : `You are past neutral into excess base. The endpoint was behind you, near ${equivalence.toFixed(1)} mL.`,
      )
      setFinalResult({ accepted: false, ph: Number(ph.toFixed(2)), volume: Number(delivered.toFixed(2)) })
      return
    }

    if (flask.indicatorDrops < DROPS_OF_INDICATOR) {
      logMistake(2, 'Reached the endpoint without the full three drops of indicator.', 'You had to rely on the meter alone — the colour change is your check in a real lab.')
    }

    setFinalResult({ accepted: true, ph: Number(ph.toFixed(2)), volume: Number(delivered.toFixed(2)) })
    setSummary({ precisionAchieved: true, finalPH: Number(ph.toFixed(2)), volumeOvershot: Number(overshoot.toFixed(2)) })
    soundRef.current?.play?.('endpoint')
    observe(
      `Endpoint recorded: ${delivered.toFixed(2)} mL of NaOH neutralised ${flask.hclML.toFixed(1)} mL of HCl at pH ${ph.toFixed(2)}. Theory says ${equivalence.toFixed(2)} mL — you were ${Math.abs(delivered - equivalence).toFixed(2)} mL out.`,
      'ok',
    )
  }

  function resetExperiment() {
    window.clearTimeout(fizzTimerRef.current)
    flaskRef.current = createFlask()
    buretteRef.current = 0
    deliveredRef.current = 0
    syncFlask()
    setReagent('')
    setTool('')
    setObservations([])
    setReadings([])
    setFinalResult(null)
    setPoints([])
    setReached(false)
    reachedRef.current = false
    targetRef.current = EMPTY_TARGET
    soundRef.current?.stopPour?.()
    soundRef.current?.stopBubbles?.()
    setSummary({ precisionAchieved: false, volumeOvershot: 0 })
    setProgress({ completed: 0, total: totalSteps })
  }

  const reagents = experiment?.availableChemicals?.length
    ? experiment.availableChemicals
    : ['HCl', 'NaOH', 'Phenolphthalein', 'Distilled water']
  const phClass = ph == null ? '' : ph < 6 ? 'ph-acid' : ph > 8 ? 'ph-base' : 'ph-neutral'
  const selectedTool = TOOLS.find((t) => t.id === tool)

  return (
    <div className="sim titration-lab">
      <div className="titration-apparatus">
        <Burette
          remainingML={buretteML}
          deliveredML={delivered}
          capacityML={BURETTE_CAPACITY_ML}
          onTick={handleStopcockTick}
          onRelease={handleStopcockEnd}
          onDrop={() => deliverBase(DROP_ML)}
          disabled={buretteML <= 0}
          flow={flow}
          onFlowChange={setFlow}
        />

        <div className="lab-visualization">
          <LabCanvas
            getTarget={getTarget}
            streamColor={reagent ? chemicalSwatch(reagent) : null}
            canPour={!!reagent}
            onPourStart={handlePourStart}
            onPourTick={handlePourTick}
            onPourEnd={handlePourEnd}
            soundRef={soundRef}
          />
          <p className="pour-hint">
            {reagent
              ? `Press and hold the flask to pour ${getChemical(reagent).name} freehand — or use an instrument below for a measured amount.`
              : 'Pick a reagent from the shelf, then either hold the flask to pour it or use an instrument.'}
          </p>
        </div>
      </div>

      {(delivered > 0 || points.length > 1) && <TitrationCurve points={points} reached={reached} />}

      <div className="sim-readouts">
        <div className="readout-chip">
          <span className="readout-label">pH meter</span>
          {ph == null ? <span className="readout-value">--</span> : <AnimatedNumber className={`readout-value ${phClass}`} value={ph} decimals={2} />}
          <span className="readout-sub">{ph == null ? 'flask empty' : ph < 6.9 ? 'Acidic' : ph > 7.1 ? 'Basic' : 'Neutral'}</span>
        </div>
        <div className="readout-chip thermo-chip">
          <span className="readout-label">Temp</span>
          <AnimatedNumber className="readout-value" value={temp} decimals={1} suffix=" °C" />
          <Thermometer temp={temp} />
        </div>
        <div className="readout-chip">
          <span className="readout-label">Flask</span>
          <AnimatedNumber className="readout-value" value={volume} decimals={1} suffix=" mL" />
          <span className="readout-sub">{flask.hclML > 0 ? `${flask.hclML.toFixed(1)} mL acid · ${flask.indicatorDrops} drops` : 'empty'}</span>
        </div>
        <div className="readout-chip">
          <span className="readout-label">Colour</span>
          <span className="readout-value readout-text">{describeColour(ph, flask.indicatorDrops)}</span>
        </div>
      </div>

      {/* ── The bench: what you have, and what you pick up to use it ── */}
      <section className="bench">
        <div className="bench-col">
          <h2>Reagents</h2>
          <div className="chemical-panel">
            {reagents.map((name) => (
              <button
                key={name}
                type="button"
                className={`chemical-item ${reagent === name ? 'selected' : ''}`}
                onClick={() => setReagent(name)}
                title={getChemical(name).hint}
              >
                <span className="chemical-swatch" style={{ backgroundColor: chemicalSwatch(name) }} />
                {getChemical(name).name}
              </button>
            ))}
          </div>
        </div>

        <div className="bench-col">
          <h2>Instruments</h2>
          <div className="tool-panel">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tool-item ${tool === t.id ? 'selected' : ''}`}
                onClick={() => setTool(t.id)}
                title={t.use}
              >
                <span className="tool-icon" aria-hidden="true">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <p className="tool-use">{selectedTool ? selectedTool.use : 'Pick the instrument that suits the job.'}</p>
          <button type="button" className="btn btn-primary btn-full btn-sm" onClick={useTool} disabled={!reagent || !tool}>
            {reagent && tool ? `Use the ${selectedTool.label.toLowerCase()} with ${getChemical(reagent).name}` : 'Choose a reagent and an instrument'}
          </button>
        </div>
      </section>

      {/* ── What you can see happening, as it happens ── */}
      <section className="observations">
        <div className="observations-head">
          <h2>Observations</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={recordReading} disabled={ph == null}>
            📋 Record a reading
          </button>
          <button
            type="button"
            className={`btn btn-sm btn-outline mute-btn ${muted ? 'is-muted' : ''}`}
            onClick={() => setMuted((m) => !m)}
            aria-pressed={muted}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
        <ul className="observation-log" aria-live="polite">
          {observations.length === 0 && <li className="observation-empty">Nothing has happened yet. Start by measuring your acid into the flask.</li>}
          {observations.slice(-8).map((o) => (
            <li key={o.id} className={`observation-line tone-${o.tone}`}>
              {o.tone === 'warn' ? '⚠️' : o.tone === 'ok' ? '✓' : '•'} {o.text}
            </li>
          ))}
        </ul>
      </section>

      {/* ── The results table the student fills in themselves ── */}
      <section className="results-record">
        <h2>Your results</h2>
        {readings.length === 0 ? (
          <p className="text-muted results-empty">No readings yet. Record one whenever you see something worth noting.</p>
        ) : (
          <table className="readings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>NaOH (mL)</th>
                <th>pH</th>
                <th>Colour</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.n}>
                  <td>{r.n}</td>
                  <td>{r.burette.toFixed(2)}</td>
                  <td>{r.ph.toFixed(2)}</td>
                  <td>{r.colour}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {finalResult?.accepted ? (
          <p className="final-result is-ok">
            ✓ Endpoint: {finalResult.volume.toFixed(2)} mL of {C_BASE} M NaOH at pH {finalResult.ph.toFixed(2)} · theoretical {equivalence.toFixed(2)} mL
          </p>
        ) : (
          <button type="button" className="btn btn-primary btn-full btn-sm" onClick={recordFinalResult} disabled={ph == null || delivered <= 0}>
            🎯 Record this as my endpoint
          </button>
        )}
      </section>

      <button type="button" className="btn btn-outline btn-full btn-sm" onClick={resetExperiment}>
        ↺ Rinse &amp; start over
      </button>
    </div>
  )
}
