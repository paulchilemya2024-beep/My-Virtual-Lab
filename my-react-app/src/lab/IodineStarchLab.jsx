import { useCallback, useRef, useState } from 'react'
import { useBeaker } from './useBeaker.js'
import BeakerStage from './BeakerStage.jsx'
import { getChemical } from './chemicals.js'
import { ResultBadge, GoalTracker } from './Instruments.jsx'

// The iodine–starch test. A milky starch suspension turns dramatic blue-black the
// instant iodine is added. The canvas drives the colour (and fires a bloom on the
// sudden change); this component reports the food-test result, not pH.
const FALLBACK = ['Starch solution', 'Iodine solution', 'Distilled water']

export default function IodineStarchLab({ lab }) {
  const { experiment, consultTutor, pushMessage, setProgress, setSummary } = lab
  const total = experiment?.steps?.length || 3
  const chemicals = experiment?.availableChemicals?.length ? experiment.availableChemicals : FALLBACK

  const positiveRef = useRef(false)
  const [state, setState] = useState({ starch: false, iodine: false, complex: false })

  const onCommit = useCallback(
    ({ acc, selected }) => {
      const has = (id) => (acc.contents[id] || 0) > 0
      const starch = has('Starch solution')
      const iodine = has('Iodine solution')
      const complex = starch && iodine

      const next = { starch, iodine, complex }
      setState(next)
      const milestones = [starch, iodine, complex].filter(Boolean).length
      setProgress({ completed: Math.min(total, milestones), total })

      if (complex && !positiveRef.current) {
        positiveRef.current = true
        setSummary({ precisionAchieved: true })
        pushMessage('student', 'The whole flask just turned deep blue-black — that is a positive starch test!')
        consultTutor('', 'added iodine to starch — the solution turned intense blue-black (positive starch test)', {
          chemicals: Object.keys(acc.contents).filter((id) => acc.contents[id] > 0),
        })
      } else {
        const name = getChemical(selected).name
        pushMessage('student', `I added ${name}.`)
        consultTutor('', `added ${name}; ${complex ? 'the blue-black complex is present' : 'no colour change yet — both starch and iodine are needed'}`, {
          chemicals: Object.keys(acc.contents).filter((id) => acc.contents[id] > 0),
        })
      }
    },
    [total, consultTutor, pushMessage, setProgress, setSummary],
  )

  const sim = useBeaker({ onCommit })

  const reset = () => {
    positiveRef.current = false
    setState({ starch: false, iodine: false, complex: false })
    sim.reset()
    setProgress({ completed: 0, total })
    pushMessage('tutor', 'Flask rinsed. Pour the milky starch in first, then add a few drops of amber iodine and watch the colour.')
  }

  const result = state.complex ? 'Positive — starch present' : state.starch || state.iodine ? 'No change yet' : 'Not tested'
  const tone = state.complex ? 'ok' : 'muted'

  const readouts = (
    <div className="sim-readouts">
      <div className="readout-chip" style={{ minWidth: 200 }}>
        <span className="readout-label">Starch test</span>
        <span className="readout-value" style={{ fontSize: '1.05rem' }}>
          <ResultBadge label={result} tone={tone} />
        </span>
        <span className="readout-sub">{state.complex ? 'iodine + starch complex' : 'needs both reagents'}</span>
      </div>
      <div className="readout-chip">
        <span className="readout-label">Reagents in flask</span>
        <span className="readout-value" style={{ fontSize: '1rem' }}>
          {[state.starch && 'starch', state.iodine && 'iodine'].filter(Boolean).join(' + ') || '—'}
        </span>
        <span className="readout-sub">{state.starch && state.iodine ? 'both present' : 'add the other reagent'}</span>
      </div>
    </div>
  )

  const extra = (
    <GoalTracker
      title="Run the test"
      goals={[
        { label: 'Add the milky starch suspension', done: state.starch },
        { label: 'Add the amber iodine solution', done: state.iodine },
        { label: 'Observe the blue-black colour', done: state.complex },
      ]}
    />
  )

  return (
    <div className="sim chemistry-lab">
      <BeakerStage
        sim={sim}
        chemicals={chemicals}
        hint="Pour starch in first, then add iodine to develop the colour."
        readouts={readouts}
        extra={extra}
        onReset={reset}
      />
    </div>
  )
}
