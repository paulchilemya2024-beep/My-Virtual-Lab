import { useCallback, useRef, useState } from 'react'
import { useBeaker } from './useBeaker.js'
import BeakerStage from './BeakerStage.jsx'
import { getChemical, rgbToCss } from './chemicals.js'
import { AnimatedNumber, ResultBadge, GoalTracker } from './Instruments.jsx'

// Precipitation reactions: mix soluble salts to form an insoluble solid. No pH
// meter here — the instruments report whether a precipitate has formed, its
// identity and colour, and let it settle into a sediment layer.
const FALLBACK = ['Copper sulfate', 'Iron(III) chloride', 'NaOH', 'Silver nitrate', 'Sodium chloride', 'Distilled water']

export default function PrecipitationLab({ lab }) {
  const { experiment, setProgress, setSummary, addMistake } = lab
  const total = experiment?.steps?.length || 4
  const chemicals = experiment?.availableChemicals?.length ? experiment.availableChemicals : FALLBACK

  const seenRef = useRef(new Set())
  const [formed, setFormed] = useState({ label: null, color: null })
  const [count, setCount] = useState(0)
  const [banner, setBanner] = useState('')

  const onCommit = useCallback(
    ({ before, after, acc, selected }) => {
      const precip = after.precipitate

      if (precip.active && precip.label) {
        seenRef.current.add(precip.label)
        const n = seenRef.current.size
        setCount(n)
        setFormed({ label: precip.label, color: precip.color })
        setProgress({ completed: Math.min(total, n + 1), total })
        setSummary({ precisionAchieved: n >= 2 })
      } else if (!before.precipitate.active && Object.keys(acc.contents).filter((id) => acc.contents[id] > 0).length >= 3) {
        // Pouring a third+ reagent with nothing to react with — no solid forms.
        const name = getChemical(selected).name
        addMistake({ step: count + 1, action: `added ${name} with no matching partner — no precipitate` })
      }
    },
    [total, count, setProgress, setSummary, addMistake],
  )

  const sim = useBeaker({ onCommit })

  const reset = () => {
    seenRef.current = new Set()
    setFormed({ label: null, color: null })
    setCount(0)
    setBanner('')
    sim.reset()
    setProgress({ completed: Math.max(0, Math.min(total, 1)), total })
    setSummary({ precisionAchieved: false })
  }

  const rinse = () => {
    setBanner('Water added — residue remains in the flask')
    sim.rinse(4)
  }

  const active = sim.readout.precipitate.active
  const readouts = (
    <div className="sim-readouts">
      <div className="readout-chip">
        <span className="readout-label">Precipitate</span>
        <span className="readout-value" style={{ fontSize: '1rem', textTransform: 'capitalize' }}>
          {formed.label || '—'}
        </span>
        <span className="readout-sub">
          <ResultBadge label={active ? 'Solid forming' : formed.label ? 'Settled' : 'None yet'} tone={active || formed.label ? 'ok' : 'muted'} />
        </span>
      </div>
      <div className="readout-chip">
        <span className="readout-label">Colour</span>
        <span
          className="precip-swatch"
          style={{ background: formed.color ? rgbToCss(formed.color) : 'transparent' }}
          aria-hidden="true"
        />
        <span className="readout-sub">{formed.color ? 'precipitate colour' : 'no solid'}</span>
      </div>
      <div className="readout-chip">
        <span className="readout-label">Distinct solids</span>
        <AnimatedNumber className="readout-value" value={count} decimals={0} />
        <span className="readout-sub">{count >= 2 ? 'goal reached' : 'aim for 2'}</span>
      </div>
    </div>
  )

  const extra = (
    <GoalTracker
      title="Form precipitates"
      goals={[
        { label: 'Make your first precipitate', done: count >= 1 },
        { label: 'Identify it by its colour', done: count >= 1 },
        { label: 'Make a second, different precipitate', done: count >= 2 },
      ]}
    />
  )

  return (
    <div className="sim chemistry-lab">
      <BeakerStage
        sim={sim}
        chemicals={chemicals}
        hint="Pour one salt in, then add its partner to make an insoluble solid."
        readouts={readouts}
        extra={extra}
        onReset={reset}
        onRinse={rinse}
        banner={banner}
      />
    </div>
  )
}
