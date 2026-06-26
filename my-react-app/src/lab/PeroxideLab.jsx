import { useCallback, useRef, useState } from 'react'
import { useBeaker } from './useBeaker.js'
import BeakerStage from './BeakerStage.jsx'
import { getChemical } from './chemicals.js'
import { AnimatedNumber, Thermometer, ResultBadge, GoalTracker } from './Instruments.jsx'

// Catalysing hydrogen peroxide. Peroxide decomposes slowly on its own; manganese
// dioxide catalyses it into a vigorous froth of oxygen + heat. Mixing peroxide
// with potassium permanganate is hazardous — the flask flashes red and SIMI warns.
const FALLBACK = ['Hydrogen peroxide', 'Manganese dioxide', 'Potassium permanganate', 'Distilled water']

export default function PeroxideLab({ lab }) {
  const { experiment, consultTutor, pushMessage, setProgress, setSummary, addMistake } = lab
  const total = experiment?.steps?.length || 3
  const chemicals = experiment?.availableChemicals?.length ? experiment.availableChemicals : FALLBACK

  const flagsRef = useRef({ slow: false, catalysed: false, hazard: false })
  const [flags, setFlags] = useState({ slow: false, catalysed: false, hazard: false })

  const onCommit = useCallback(
    ({ after, acc, selected }) => {
      const has = (id) => (acc.contents[id] || 0) > 0
      const f = { ...flagsRef.current }
      if (has('Hydrogen peroxide')) f.slow = true
      if (has('Hydrogen peroxide') && has('Manganese dioxide')) f.catalysed = true
      if (after.danger) f.hazard = true
      flagsRef.current = f
      setFlags(f)

      const milestones = (f.slow ? 1 : 0) + (f.catalysed ? 2 : 0)
      setProgress({ completed: Math.min(total, milestones), total })
      setSummary({ precisionAchieved: f.catalysed && !f.hazard })

      if (after.danger) {
        addMistake({ step: total, action: 'mixed hydrogen peroxide with potassium permanganate — a violent, hazardous reaction' })
        pushMessage('student', 'Whoa — that reacted violently and the flask is getting dangerously hot!')
        consultTutor('', 'DANGER: mixed hydrogen peroxide with potassium permanganate — a violent exothermic reaction', {
          temperature: Math.round(after.temp),
          chemicals: Object.keys(acc.contents).filter((id) => acc.contents[id] > 0),
        })
        return
      }

      const name = getChemical(selected).name
      if (f.catalysed && after.gas.active) {
        pushMessage('student', 'The manganese dioxide made it froth up with oxygen and the flask warmed up fast!')
        consultTutor('', `added ${name} — the catalyst drives rapid oxygen production (frothing) and the temperature is rising`, {
          temperature: Math.round(after.temp),
          chemicals: Object.keys(acc.contents).filter((id) => acc.contents[id] > 0),
        })
      } else {
        pushMessage('student', `I added ${name}.`)
        consultTutor('', `added ${name}; ${after.gas.active ? 'oxygen is bubbling off slowly' : 'no reaction yet'}`, {
          temperature: Math.round(after.temp),
          chemicals: Object.keys(acc.contents).filter((id) => acc.contents[id] > 0),
        })
      }
    },
    [total, consultTutor, pushMessage, setProgress, setSummary, addMistake],
  )

  const sim = useBeaker({ onCommit })

  const reset = () => {
    flagsRef.current = { slow: false, catalysed: false, hazard: false }
    setFlags({ slow: false, catalysed: false, hazard: false })
    sim.reset()
    setProgress({ completed: 0, total })
    pushMessage('tutor', 'Flask rinsed. Pour in hydrogen peroxide, then add a little manganese dioxide catalyst and watch the oxygen froth. Keep the permanganate away from the peroxide.')
  }

  const gas = sim.readout.gas
  const producingO2 = gas.active && gas.name === 'O₂'

  const readouts = (
    <div className="sim-readouts">
      <div className="readout-chip thermo-chip">
        <span className="readout-label">Temp</span>
        <AnimatedNumber className="readout-value" value={sim.readout.temp} decimals={1} suffix=" °C" />
        <Thermometer temp={sim.readout.temp} />
      </div>
      <div className="readout-chip">
        <span className="readout-label">Oxygen (O₂)</span>
        <span className="readout-value" style={{ fontSize: '1.05rem' }}>
          <ResultBadge
            label={producingO2 ? (gas.rate > 0.6 ? 'Vigorous' : 'Slow') : 'None'}
            tone={producingO2 ? (gas.rate > 0.6 ? 'ok' : 'warn') : 'muted'}
          />
        </span>
        <span className="readout-sub">{flags.catalysed ? 'catalysed decomposition' : 'add a catalyst to speed it up'}</span>
      </div>
      <div className="readout-chip">
        <span className="readout-label">Safety</span>
        <span className="readout-value" style={{ fontSize: '1.05rem' }}>
          <ResultBadge label={flags.hazard ? 'HAZARD' : 'Safe'} tone={flags.hazard ? 'danger' : 'ok'} />
        </span>
        <span className="readout-sub">{flags.hazard ? 'permanganate + peroxide' : 'conditions OK'}</span>
      </div>
    </div>
  )

  const extra = (
    <GoalTracker
      title="Decompose the peroxide"
      goals={[
        { label: 'Pour in hydrogen peroxide', done: flags.slow },
        { label: 'Add manganese dioxide — froth + heat', done: flags.catalysed },
        { label: 'Keep it safe (avoid the permanganate)', done: flags.catalysed && !flags.hazard },
      ]}
    />
  )

  return (
    <div className="sim chemistry-lab">
      <BeakerStage
        sim={sim}
        chemicals={chemicals}
        hint="Pour peroxide in, then add a little manganese dioxide catalyst."
        readouts={readouts}
        extra={extra}
        onReset={reset}
        danger={sim.readout.danger}
      />
    </div>
  )
}
