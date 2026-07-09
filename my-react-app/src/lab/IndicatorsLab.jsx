import { useCallback, useRef, useState } from 'react'
import { useBeaker } from './useBeaker.js'
import BeakerStage from './BeakerStage.jsx'
import { getChemical, CATEGORY } from './chemicals.js'
import { AnimatedNumber, PhScale, GoalTracker } from './Instruments.jsx'

// Indicators & the pH scale. This is the ONE chemistry sim where the pH meter is
// the headline instrument: add an indicator to water, then drive the solution
// acidic and alkaline and watch the colour map onto the whole 0–14 scale.
const FALLBACK = ['HCl', 'NaOH', 'Universal indicator', 'Litmus', 'Phenolphthalein', 'Distilled water']

export default function IndicatorsLab({ lab }) {
  const { experiment, setProgress, setSummary } = lab
  const total = experiment?.steps?.length || 4
  const chemicals = experiment?.availableChemicals?.length ? experiment.availableChemicals : FALLBACK

  const indicatorsRef = useRef(new Set())
  const zonesRef = useRef(new Set())
  const [goals, setGoals] = useState({ indicator: false, acid: false, base: false, compared: false })
  const [activeIndicator, setActiveIndicator] = useState('')

  const onCommit = useCallback(
    ({ after, acc }) => {
      const ph = after.ph
      const present = Object.keys(acc.contents).filter((id) => acc.contents[id] > 0)
      const inds = present.filter((id) => getChemical(id).category === CATEGORY.INDICATOR)
      inds.forEach((id) => indicatorsRef.current.add(id))
      setActiveIndicator(inds.length ? getChemical(inds[inds.length - 1]).name : '')

      if (ph < 6.5) zonesRef.current.add('acid')
      else if (ph > 7.5) zonesRef.current.add('base')

      const g = {
        indicator: indicatorsRef.current.size >= 1,
        acid: zonesRef.current.has('acid'),
        base: zonesRef.current.has('base'),
        compared: indicatorsRef.current.size >= 2,
      }
      setGoals(g)
      const completed = Object.values(g).filter(Boolean).length
      setProgress({ completed: Math.min(total, completed), total })
      setSummary({ finalPH: Number(ph.toFixed(1)), precisionAchieved: g.acid && g.base })
    },
    [total, setProgress, setSummary],
  )

  const sim = useBeaker({ onCommit })

  const reset = () => {
    indicatorsRef.current = new Set()
    zonesRef.current = new Set()
    setGoals({ indicator: false, acid: false, base: false, compared: false })
    setActiveIndicator('')
    sim.reset()
    setProgress({ completed: Math.max(0, Math.min(total, 1)), total })
  }

  const ph = sim.readout.ph
  const phClass = ph < 6 ? 'ph-acid' : ph > 8 ? 'ph-base' : 'ph-neutral'

  const readouts = (
    <div className="sim-readouts">
      <div className="readout-chip">
        <span className="readout-label">pH meter</span>
        <AnimatedNumber className={`readout-value ${phClass}`} value={ph} decimals={1} />
        <span className="readout-sub">{sim.readout.phLabel}</span>
      </div>
      <div className="readout-chip">
        <span className="readout-label">Indicator</span>
        <span className="readout-value" style={{ fontSize: '1.05rem' }}>{activeIndicator || '—'}</span>
        <span className="readout-sub">{activeIndicator ? 'reading the solution' : 'none added yet'}</span>
      </div>
      <div className="readout-chip">
        <span className="readout-label">Volume</span>
        <AnimatedNumber className="readout-value" value={sim.readout.volume} decimals={1} suffix=" mL" />
      </div>
    </div>
  )

  const extra = (
    <>
      <PhScale ph={ph} />
      <GoalTracker
        title="Map the pH scale"
        goals={[
          { label: 'Add an indicator to the water', done: goals.indicator },
          { label: 'Make the solution acidic (red/low pH)', done: goals.acid },
          { label: 'Make it alkaline (blue–purple/high pH)', done: goals.base },
          { label: 'Compare a second indicator', done: goals.compared },
        ]}
      />
    </>
  )

  return (
    <div className="sim chemistry-lab">
      <BeakerStage
        sim={sim}
        chemicals={chemicals}
        hint="Add an indicator first, then pour acid or alkali to move the pH. To compare a different indicator, use the start-over button below."
        readouts={readouts}
        extra={extra}
        onReset={reset}
        resetLabel="↺ Start a fresh comparison"
      />
    </div>
  )
}
