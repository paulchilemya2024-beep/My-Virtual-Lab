import { useCallback, useEffect, useRef, useState } from 'react'
import { titrationPH, titrationTemp, EQUIVALENCE_ML, DROP_ML, V_ACID_L, C_ACID } from './titration.js'
import { chemicalSwatch } from './chemicals.js'
import SoundEngine from './sound.js'
import LabCanvas from './LabCanvas.jsx'
import { AnimatedNumber, Thermometer } from './Instruments.jsx'
import TitrationCurve from './TitrationCurve.jsx'

// Dedicated acid–base titration: the flask holds a fixed 25 mL of 0.1 M HCl with
// phenolphthalein, and the student titrates with 0.1 M NaOH. Because the acid is
// a large reservoir, early additions barely move the pH; the dramatic S-curve
// only appears within ~1 mL of the 25 mL equivalence point. See titration.js.

const MAX_BASE = 40 // mL — a little past equivalence for the "levelled off" region
const POUR_RATE = 1.0 // mL/s when holding the burette open (hold-to-pour)
const AMBIENT = 22

// Phenolphthalein: colourless in acid/neutral, magenta-pink above pH 8.2.
function phColor(ph) {
  if (ph < 8.2) return { r: 236, g: 245, b: 252, a: 0.34 }
  const t = Math.min(1, (ph - 8.2) / 1.8)
  return { r: 233, g: 30, b: 140, a: 0.4 + t * 0.45 }
}

function makeTarget(baseAdded, ph) {
  return {
    volume: 25 + baseAdded,
    color: phColor(ph),
    gas: { active: false, foam: false, rate: 0, name: null },
    precipitate: { active: false, color: { r: 240, g: 240, b: 245 }, amount: 0 },
    exothermic: false,
    danger: false,
  }
}

export default function TitrationLab({ lab }) {
  const { experiment, consultTutor, pushMessage, setProgress, setSummary } = lab
  const totalSteps = experiment?.steps?.length || 6
  const ph0 = titrationPH(0)

  const [readout, setReadout] = useState({ ph: ph0, temp: AMBIENT, volume: 0 })
  const [points, setPoints] = useState([{ v: 0, ph: ph0 }])
  const [reached, setReached] = useState(false)
  const [muted, setMuted] = useState(false)

  const baseRef = useRef(0)
  const lastPhRef = useRef(ph0)
  const reachedRef = useRef(false)
  const lastPlottedRef = useRef(0)
  const lastSyncRef = useRef(0)
  const soundRef = useRef(null)
  const targetRef = useRef(makeTarget(0, ph0))

  // Sound engine (pour trickle + endpoint chime).
  useEffect(() => {
    soundRef.current = new SoundEngine()
    const engine = soundRef.current
    return () => engine.dispose()
  }, [])
  useEffect(() => {
    soundRef.current?.setMuted(muted)
  }, [muted])

  const getTarget = useCallback(() => targetRef.current, [])

  const syncReadout = useCallback(() => {
    const v = baseRef.current
    setReadout({ ph: titrationPH(v), temp: titrationTemp(v, AMBIENT), volume: v })
  }, [setReadout])

  // Add curve points up to `toV` on a 0.1 mL grid (plus the exact endpoint), so
  // even a 5 mL "fast pour" still reveals the S-curve shape.
  const plotTo = useCallback((toV) => {
    setPoints((prev) => {
      const last = lastPlottedRef.current
      if (toV <= last + 1e-9) return prev
      const added = []
      const startTenths = Math.round((last + 0.1) * 10)
      for (let th = startTenths; th / 10 <= toV + 1e-9; th++) {
        const v = th / 10
        added.push({ v, ph: titrationPH(v) })
      }
      const lastV = added.length ? added[added.length - 1].v : last
      if (Math.abs(lastV - toV) > 1e-6) added.push({ v: Number(toV.toFixed(2)), ph: titrationPH(toV) })
      if (added.length === 0) return prev
      const next = [...prev, ...added]
      return next.length > 800 ? next.slice(next.length - 800) : next
    })
    lastPlottedRef.current = toV
  }, [setPoints])

  // Core: set the total base volume, update the beaker target, and detect the
  // equivalence-point crossing. Does not touch React state for the curve/readout
  // (callers decide when to plot/sync, so continuous pours can be throttled).
  const applyBase = useCallback(
    (newV) => {
      const clamped = Math.max(0, Math.min(MAX_BASE, newV))
      if (Math.abs(clamped - baseRef.current) < 1e-9) return
      baseRef.current = clamped
      const ph = titrationPH(clamped)
      targetRef.current = makeTarget(clamped, ph)

      const prevPh = lastPhRef.current
      const crossedUp = prevPh < 7 && ph >= 7
      if (!reachedRef.current && (crossedUp || (ph >= 6.9 && ph <= 7.1))) {
        reachedRef.current = true
        setReached(true)
        soundRef.current?.play('endpoint')
        setSummary({ precisionAchieved: true, finalPH: Number(ph.toFixed(2)) })
        pushMessage('student', 'The solution just turned a faint, stable pink — I think that is the endpoint!')
        consultTutor(
          '',
          `reached the equivalence point at ${clamped.toFixed(2)} mL of NaOH — pH is now ${ph.toFixed(2)} and the phenolphthalein has just turned pink`,
          { volumeBaseAdded: Number(clamped.toFixed(2)), currentPH: Number(ph.toFixed(2)), equivalenceReached: true },
        )
      }
      lastPhRef.current = ph

      const frac = Math.min(1, clamped / EQUIVALENCE_ML)
      const completed = reachedRef.current ? totalSteps : Math.min(totalSteps - 1, Math.round(frac * (totalSteps - 1)))
      setProgress({ completed, total: totalSteps })
    },
    [totalSteps, consultTutor, pushMessage, setProgress, setSummary, setReached],
  )

  // ── Discrete additions (the burette buttons) ──
  const addBase = useCallback(
    (delta, { announce }) => {
      soundRef.current?.resume()
      const from = baseRef.current
      const newV = Math.min(MAX_BASE, from + delta)
      if (newV <= from) return
      applyBase(newV)
      plotTo(newV)
      syncReadout()
      if (announce && !reachedRef.current) {
        const ph = titrationPH(newV)
        pushMessage('student', `I added ${delta} mL of NaOH (total ${newV.toFixed(1)} mL).`)
        consultTutor('', `added ${delta} mL of NaOH — total added is now ${newV.toFixed(1)} mL and the pH meter reads ${ph.toFixed(2)}`, {
          volumeBaseAdded: Number(newV.toFixed(2)),
          currentPH: Number(ph.toFixed(2)),
        })
      }
    },
    [applyBase, plotTo, syncReadout, consultTutor, pushMessage],
  )

  // ── Hold-to-pour the burette (continuous, animated) ──
  const handlePourStart = useCallback(() => {
    soundRef.current?.resume()
  }, [])
  const handlePourTick = useCallback(
    (dt) => {
      const newV = Math.min(MAX_BASE, baseRef.current + POUR_RATE * dt)
      applyBase(newV)
      const now = performance.now()
      if (now - lastSyncRef.current > 100) {
        lastSyncRef.current = now
        syncReadout()
      }
      if (baseRef.current - lastPlottedRef.current >= 0.1) plotTo(baseRef.current)
    },
    [applyBase, plotTo, syncReadout],
  )
  const handlePourEnd = useCallback(() => {
    plotTo(baseRef.current)
    syncReadout()
    if (!reachedRef.current) {
      const v = baseRef.current
      const ph = titrationPH(v)
      pushMessage('student', `I opened the burette and added NaOH up to ${v.toFixed(1)} mL.`)
      consultTutor('', `opened the burette to add NaOH; total added is now ${v.toFixed(1)} mL and the pH reads ${ph.toFixed(2)}`, {
        volumeBaseAdded: Number(v.toFixed(2)),
        currentPH: Number(ph.toFixed(2)),
      })
    }
  }, [plotTo, syncReadout, consultTutor, pushMessage])

  function resetExperiment() {
    baseRef.current = 0
    lastPhRef.current = ph0
    reachedRef.current = false
    lastPlottedRef.current = 0
    targetRef.current = makeTarget(0, ph0)
    setReached(false)
    setPoints([{ v: 0, ph: ph0 }])
    setReadout({ ph: ph0, temp: AMBIENT, volume: 0 })
    setProgress({ completed: 0, total: totalSteps })
    pushMessage('tutor', 'Flask refilled with a fresh 25 mL of 0.1 M HCl and a few drops of phenolphthalein. Add the NaOH slowly — watch how flat the pH stays at first.')
  }

  const phClass = readout.ph < 6 ? 'ph-acid' : readout.ph > 8 ? 'ph-base' : 'ph-neutral'
  const acidMmol = (C_ACID * V_ACID_L * 1000).toFixed(1)

  return (
    <div className="sim titration-lab">
      <div className="lab-visualization">
        <LabCanvas
          getTarget={getTarget}
          streamColor={chemicalSwatch('NaOH')}
          canPour={true}
          onPourStart={handlePourStart}
          onPourTick={handlePourTick}
          onPourEnd={handlePourEnd}
          soundRef={soundRef}
        />
        <p className="pour-hint">
          Flask: 25 mL of 0.1 M HCl ({acidMmol} mmol) + phenolphthalein. Hold the beaker to open the burette, or use the
          buttons below for precise drops. Equivalence is at {Math.round(EQUIVALENCE_ML)} mL.
        </p>
      </div>

      <TitrationCurve points={points} reached={reached} />

      <div className="sim-readouts">
        <div className="readout-chip">
          <span className="readout-label">pH meter</span>
          <AnimatedNumber className={`readout-value ${phClass}`} value={readout.ph} decimals={2} />
          <span className="readout-sub">{readout.ph < 6.9 ? 'Acidic' : readout.ph > 7.1 ? 'Basic' : 'Neutral'}</span>
        </div>
        <div className="readout-chip thermo-chip">
          <span className="readout-label">Temp</span>
          <AnimatedNumber className="readout-value" value={readout.temp} decimals={1} suffix=" °C" />
          <Thermometer temp={readout.temp} />
        </div>
        <div className="readout-chip">
          <span className="readout-label">NaOH added</span>
          <AnimatedNumber className="readout-value" value={readout.volume} decimals={2} suffix=" mL" />
        </div>
      </div>

      <h2>Burette controls</h2>
      <div className="titration-buttons">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => addBase(DROP_ML, { announce: false })}>
          💧 1 drop (+{DROP_ML} mL)
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => addBase(1, { announce: true })}>
          Slow pour (+1 mL)
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => addBase(5, { announce: true })}>
          Fast pour (+5 mL)
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
      <p className="titration-tip">
        Tip: near {Math.round(EQUIVALENCE_ML)} mL, switch to single drops — one drop can swing the pH from 4 to 10.
      </p>
      <button type="button" className="btn btn-outline btn-full btn-sm" onClick={resetExperiment}>
        ↺ Refill flask &amp; reset
      </button>
    </div>
  )
}
