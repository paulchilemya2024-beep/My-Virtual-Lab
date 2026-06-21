import { useCallback, useEffect, useRef, useState } from 'react'
import { createState, addChemical, derive, computeEvents, coolStep, AMBIENT_TEMP } from './reactions.js'
import { getChemical, chemicalSwatch } from './chemicals.js'
import SoundEngine from './sound.js'
import LabCanvas from './LabCanvas.jsx'
import { AnimatedNumber, Thermometer } from './Instruments.jsx'

// The chemistry beaker simulation (titration, indicators, precipitation, gas,
// iodine–starch, peroxide, metal+acid). Extracted from LabPage so the lab page
// can dispatch between this and the physics simulations. All shared concerns
// (SIMI chat, submit, progress) come through the `lab` API prop.
export default function ChemistryLab({ lab }) {
  const { experiment, consultTutor, pushMessage, setProgress, addMistake, setSummary } = lab

  const [selectedChemical, setSelectedChemical] = useState('')
  const [flow, setFlow] = useState(2)
  const [muted, setMuted] = useState(false)
  const [readout, setReadout] = useState({ ph: 7, temp: AMBIENT_TEMP, volume: 0, phLabel: 'Neutral', danger: false })

  // Both seeded from the identical empty-flask state (no cross-ref reads during render).
  const accRef = useRef(createState().acc)
  const targetRef = useRef(derive(createState().acc))
  const flowRef = useRef(flow)
  const selectedRef = useRef('')
  const beforePourRef = useRef(null)
  const pouredRef = useRef(0)
  const lastSyncRef = useRef(0)
  const soundRef = useRef(null)
  const stepsRef = useRef(0)

  const totalSteps = experiment?.steps?.length || 6

  useEffect(() => {
    flowRef.current = flow
  }, [flow])
  useEffect(() => {
    selectedRef.current = selectedChemical
  }, [selectedChemical])

  const syncReadout = useCallback(() => {
    const d = targetRef.current
    setReadout({ ph: d.ph, temp: d.temp, volume: d.volume, phLabel: d.phLabel, danger: d.danger })
  }, [])

  // Sound engine + temperature relaxation timer.
  useEffect(() => {
    soundRef.current = new SoundEngine()
    const cool = setInterval(() => {
      if (accRef.current.temp > AMBIENT_TEMP) {
        accRef.current = coolStep(accRef.current, 1)
        targetRef.current = derive(accRef.current)
        syncReadout()
      }
    }, 1000)
    const engine = soundRef.current
    return () => {
      clearInterval(cool)
      engine.dispose()
    }
  }, [syncReadout])

  useEffect(() => {
    soundRef.current?.setMuted(muted)
  }, [muted])

  const getTarget = useCallback(() => targetRef.current, [])

  const handlePourStart = useCallback(() => {
    soundRef.current?.resume()
    beforePourRef.current = targetRef.current
    pouredRef.current = 0
  }, [])

  const handlePourTick = useCallback(
    (dt) => {
      const sel = selectedRef.current
      if (!sel) return
      if (targetRef.current.volume >= 30) return
      const dv = flowRef.current * 0.8 * dt
      const { acc } = addChemical(accRef.current, sel, dv)
      pouredRef.current += dv
      accRef.current = acc
      targetRef.current = derive(acc)
      const now = performance.now()
      if (now - lastSyncRef.current > 110) {
        lastSyncRef.current = now
        syncReadout()
      }
    },
    [syncReadout],
  )

  const handlePourEnd = useCallback(() => {
    const before = beforePourRef.current
    const after = targetRef.current
    syncReadout()
    if (!before || !selectedRef.current) return
    if (pouredRef.current < 0.05) return
    const sel = selectedRef.current

    const events = computeEvents(before, after, accRef.current)
    events.forEach((ev) => soundRef.current?.play(ev))

    stepsRef.current = Math.min(totalSteps, stepsRef.current + 1)
    setProgress({ completed: stepsRef.current, total: totalSteps })

    const notes = []
    if (events.includes('endpoint')) notes.push('reached the neutral endpoint')
    if (events.includes('precipitate')) notes.push(`a ${after.precipitate.label || 'solid'} precipitate formed`)
    if (events.includes('fizz')) notes.push(`${after.gas.name} gas was produced`)
    if (events.includes('danger')) notes.push('a DANGEROUS reaction occurred')

    const overshoot = accRef.current.molesAcid > 0 && accRef.current.molesBase > 0 && after.ph > 7.6
    if (overshoot) notes.push('the base overshot past neutral (pH too high)')
    if (overshoot || events.includes('danger')) {
      addMistake({ step: stepsRef.current, action: `added ${sel}: ${notes.join(', ')}` })
    }

    const precision = after.ph >= 6.9 && after.ph <= 7.1 && accRef.current.molesAcid > 0 && accRef.current.molesBase > 0
    setSummary({ precisionAchieved: precision, finalPH: Number(after.ph.toFixed(1)) })

    const action = `added ${sel}${notes.length ? ` — ${notes.join(', ')}` : ''}`
    pushMessage('student', `I poured some ${getChemical(sel).name} into the flask.`)
    consultTutor('', action, {
      chemicals: Object.keys(accRef.current.contents),
      temperature: Math.round(after.temp),
      currentPH: Number(after.ph.toFixed(1)),
    })
  }, [totalSteps, addMistake, setProgress, setSummary, pushMessage, consultTutor, syncReadout])

  function selectChemical(name) {
    setSelectedChemical(name)
    soundRef.current?.resume()
    soundRef.current?.clink()
  }

  function resetExperiment() {
    accRef.current = createState().acc
    targetRef.current = derive(accRef.current)
    stepsRef.current = 0
    syncReadout()
    setProgress({ completed: 0, total: totalSteps })
    pushMessage('tutor', 'Flask rinsed and reset. Let’s try again — pour slowly and watch the readings.')
  }

  const chemicals = experiment.availableChemicals?.length
    ? experiment.availableChemicals
    : ['HCl', 'NaOH', 'Phenolphthalein', 'Distilled water']
  const phClass = readout.ph < 6 ? 'ph-acid' : readout.ph > 8 ? 'ph-base' : 'ph-neutral'

  return (
    <div className="sim chemistry-lab">
      <div className={`lab-visualization ${readout.danger ? 'is-danger' : ''}`}>
        <LabCanvas
          getTarget={getTarget}
          streamColor={selectedChemical ? chemicalSwatch(selectedChemical) : null}
          canPour={!!selectedChemical}
          onPourStart={handlePourStart}
          onPourTick={handlePourTick}
          onPourEnd={handlePourEnd}
          soundRef={soundRef}
        />
        <p className="pour-hint">
          {selectedChemical
            ? `Press and hold the beaker to pour ${getChemical(selectedChemical).name} — release to stop.`
            : 'Select a chemical below, then press and hold the beaker to pour.'}
        </p>
      </div>

      <div className="sim-readouts">
        <div className="readout-chip">
          <span className="readout-label">pH</span>
          <AnimatedNumber className={`readout-value ${phClass}`} value={readout.ph} decimals={1} />
          <span className="readout-sub">{readout.phLabel}</span>
        </div>
        <div className="readout-chip thermo-chip">
          <span className="readout-label">Temp</span>
          <AnimatedNumber className="readout-value" value={readout.temp} decimals={1} suffix=" °C" />
          <Thermometer temp={readout.temp} />
        </div>
        <div className="readout-chip">
          <span className="readout-label">Volume</span>
          <AnimatedNumber className="readout-value" value={readout.volume} decimals={1} suffix=" mL" />
        </div>
      </div>

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
        {chemicals.map((chemical) => (
          <button
            key={chemical}
            type="button"
            className={`chemical-item ${selectedChemical === chemical ? 'selected' : ''}`}
            onClick={() => selectChemical(chemical)}
            title={getChemical(chemical).hint}
          >
            <span className="chemical-swatch" style={{ backgroundColor: chemicalSwatch(chemical) }} />
            {getChemical(chemical).name}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-outline btn-full btn-sm" onClick={resetExperiment}>
        ↺ Reset flask
      </button>
    </div>
  )
}
