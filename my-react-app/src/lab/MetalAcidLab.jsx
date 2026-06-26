import { useCallback, useRef, useState } from 'react'
import { useBeaker } from './useBeaker.js'
import BeakerStage from './BeakerStage.jsx'
import { getChemical } from './chemicals.js'
import { AnimatedNumber, Thermometer, ResultBadge, GoalTracker } from './Instruments.jsx'

// Metals & acids. A reactive metal (magnesium) fizzes in acid, releasing hydrogen
// and a lot of heat; a carbonate fizzes too, but the gas is carbon dioxide and the
// reaction is far less exothermic. Instruments: temperature + which gas is coming off.
const FALLBACK = ['Magnesium ribbon', 'Sodium carbonate', 'HCl', 'Distilled water']

export default function MetalAcidLab({ lab }) {
  const { experiment, consultTutor, pushMessage, setProgress, setSummary } = lab
  const total = experiment?.steps?.length || 4
  const chemicals = experiment?.availableChemicals?.length ? experiment.availableChemicals : FALLBACK

  const gasesRef = useRef(new Set())
  const [gases, setGases] = useState([])

  const onCommit = useCallback(
    ({ after, acc, selected }) => {
      const present = Object.keys(acc.contents).filter((id) => acc.contents[id] > 0)
      if (after.gas.active && after.gas.name) gasesRef.current.add(after.gas.name)
      const list = [...gasesRef.current]
      setGases(list)

      const milestones = list.length + (list.length === 2 ? 2 : 0)
      setProgress({ completed: Math.min(total, milestones || (present.length > 1 ? 1 : 0)), total })
      setSummary({ precisionAchieved: list.length >= 2 })

      const name = getChemical(selected).name
      if (after.gas.active) {
        const warm = after.temp > 26 ? ` and the flask warmed to about ${Math.round(after.temp)} °C` : ''
        pushMessage('student', `Adding ${name} set off a fizz of ${after.gas.name}${warm}.`)
        consultTutor('', `added ${name} — effervescence of ${after.gas.name} gas${warm}`, {
          temperature: Math.round(after.temp),
          chemicals: present,
        })
      } else {
        pushMessage('student', `I added ${name}, but nothing is fizzing yet.`)
        consultTutor('', `added ${name}; no gas yet — a metal or carbonate needs an acid to react`, {
          temperature: Math.round(after.temp),
          chemicals: present,
        })
      }
    },
    [total, consultTutor, pushMessage, setProgress, setSummary],
  )

  const sim = useBeaker({ onCommit })

  const reset = () => {
    gasesRef.current = new Set()
    setGases([])
    sim.reset()
    setProgress({ completed: 0, total })
    pushMessage('tutor', 'Flask rinsed. Drop in magnesium and add acid to make hydrogen, then rinse and try a carbonate with acid to make carbon dioxide.')
  }

  const gas = sim.readout.gas
  const readouts = (
    <div className="sim-readouts">
      <div className="readout-chip thermo-chip">
        <span className="readout-label">Temp</span>
        <AnimatedNumber className="readout-value" value={sim.readout.temp} decimals={1} suffix=" °C" />
        <Thermometer temp={sim.readout.temp} />
      </div>
      <div className="readout-chip">
        <span className="readout-label">Gas coming off</span>
        <span className="readout-value" style={{ fontSize: '1.2rem' }}>
          <ResultBadge label={gas.active ? gas.name : 'None'} tone={gas.active ? 'ok' : 'muted'} />
        </span>
        <span className="readout-sub">{gas.active ? 'effervescence' : 'no reaction'}</span>
      </div>
      <div className="readout-chip">
        <span className="readout-label">Gases identified</span>
        <AnimatedNumber className="readout-value" value={gases.length} decimals={0} />
        <span className="readout-sub">{gases.length ? gases.join(' · ') : 'aim for H₂ and CO₂'}</span>
      </div>
    </div>
  )

  const extra = (
    <GoalTracker
      title="Identify the gases"
      goals={[
        { label: 'React magnesium with acid (hydrogen)', done: gases.includes('H₂') },
        { label: 'React a carbonate with acid (carbon dioxide)', done: gases.includes('CO₂') },
        { label: 'Compare which reaction is more exothermic', done: gases.length >= 2 },
      ]}
    />
  )

  return (
    <div className="sim chemistry-lab">
      <BeakerStage
        sim={sim}
        chemicals={chemicals}
        hint="Add a metal or carbonate, then pour acid on it to start the reaction."
        readouts={readouts}
        extra={extra}
        onReset={reset}
      />
    </div>
  )
}
