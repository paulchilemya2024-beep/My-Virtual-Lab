import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { experimentsApi, progressApi } from '../api/index.js'
import ChemistryLab from '../lab/ChemistryLab.jsx'
import TitrationLab from '../lab/TitrationLab.jsx'
import CircuitLab from '../lab/CircuitLab.jsx'
import ProjectileLab from '../lab/ProjectileLab.jsx'
import InclineLab from '../lab/InclineLab.jsx'
import PendulumLab from '../lab/PendulumLab.jsx'
import OsmosisLab from '../lab/OsmosisLab.jsx'
import IndicatorsLab from '../lab/IndicatorsLab.jsx'
import PrecipitationLab from '../lab/PrecipitationLab.jsx'
import MetalAcidLab from '../lab/MetalAcidLab.jsx'
import PeroxideLab from '../lab/PeroxideLab.jsx'
import DerivativeLab from '../lab/DerivativeLab.jsx'
import RiemannLab from '../lab/RiemannLab.jsx'
import DerivativeRulesLab from '../lab/DerivativeRulesLab.jsx'
import LimitsLab from '../lab/LimitsLab.jsx'
import { EXPERIMENT_CONTENT } from '../lab/experimentContent.js'
import NotesView from '../lab/NotesView.jsx'
import QuestionsView from '../lab/QuestionsView.jsx'
import StepsPanel from '../lab/StepsPanel.jsx'
import { useTutor } from '../math/useTutor.js'
import TutorPanel from '../math/TutorPanel.jsx'

// Maps an experiment _id to the simulation component that runs it. Every
// experiment gets its OWN dedicated component so nothing silently reuses the
// generic beaker. ChemistryLab remains only as a last-resort fallback for any
// future chemical experiment that hasn't been given a bespoke sim yet.
const SIM_BY_ID = {
  titration: TitrationLab,
  circuit: CircuitLab,
  projectile: ProjectileLab,
  incline: InclineLab,
  pendulum: PendulumLab,
  osmosis: OsmosisLab,
  indicators: IndicatorsLab,
  precipitation: PrecipitationLab,
  'metal-acid': MetalAcidLab,
  'catalysis-peroxide': PeroxideLab,
  derivatives: DerivativeLab,
  riemann: RiemannLab,
  'derivative-rules': DerivativeRulesLab,
  limits: LimitsLab,
}

const PHASES = [
  { id: 'notes', label: 'Notes', icon: '📖' },
  { id: 'experiment', label: 'Experiment', icon: '⚗️' },
  { id: 'questions', label: 'Questions', icon: '❓' },
]

export default function LabPage() {
  const { labId } = useParams()
  const navigate = useNavigate()

  const [experiment, setExperiment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('notes')

  const [mistakes, setMistakes] = useState([])
  const [progress, setProgressState] = useState({ completed: 0, total: 6 })
  const [submitting, setSubmitting] = useState(false)

  const summaryRef = useRef({ precisionAchieved: false })
  const progressRef = useRef(progress)
  const startedAt = useRef(new Date().toISOString())

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const exp = await experimentsApi.get(labId)
        if (cancelled) return
        setExperiment(exp)
        setProgressState({ completed: 0, total: exp.steps?.length || 6 })
        setPhase('notes')
        document.title = `Lab • ${exp.title}`
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [labId])

  const setProgress = useCallback((next) => {
    setProgressState((prev) => ({
      completed: next.completed ?? prev.completed,
      total: next.total ?? prev.total,
    }))
  }, [])

  const addMistake = useCallback((m) => setMistakes((prev) => [...prev, m]), [])

  const setSummary = useCallback((obj) => {
    summaryRef.current = { ...summaryRef.current, ...obj }
  }, [])

  // One tutor instance per lab visit — labId is available from the route
  // immediately, before `experiment` itself has loaded, so this can sit
  // above the loading/error early-returns below like every other hook here.
  const tutor = useTutor({ experimentId: labId })

  // The API handed to every simulation component. Sims report their own
  // progress/mistakes/goals, and now also notify the tutor — they never call
  // the backend directly, only lab.tutor.notifyGoal/notifyIdle/ask.
  const lab = { experiment, setProgress, addMistake, setSummary, tutor }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const total = progressRef.current.total
      const result = await progressApi.saveSession({
        experimentId: labId,
        stepsCompleted: total,
        totalSteps: total,
        mistakes,
        startedAt: startedAt.current,
        completedAt: new Date().toISOString(),
        precisionAchieved: !!summaryRef.current.precisionAchieved,
        // The backend scores overshoot at 2 points per mL; sims that measure a
        // target volume report it through setSummary.
        volumeOvershot: summaryRef.current.volumeOvershot || 0,
        // The tutor conversation this session, if the tutor was enabled and
        // used — the backend tallies the student's own turns toward the
        // "great questions" badge and stores the rest on the session record.
        aiConversation: tutor.history,
      })
      navigate('/results', {
        state: { result, experimentTitle: experiment?.title, finalPH: summaryRef.current.finalPH },
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="page container">Loading lab…</div>
  if (error) return <div className="page container"><p className="form-error">{error}</p></div>

  const expId = experiment._id || experiment.id
  const SimComponent = SIM_BY_ID[expId] || ((experiment.availableChemicals || []).length > 0 ? ChemistryLab : null)
  const content = EXPERIMENT_CONTENT[expId]

  return (
    <div className="lab-page">
      <header className="lab-navbar">
        <div className="lab-navbar-title">
          <button type="button" className="btn btn-ghost btn-sm lab-back" onClick={() => navigate('/labs')} aria-label="Back to labs">
            ←
          </button>
          <span className={`lab-subject-dot subj-${experiment.subject || 'science'}`} aria-hidden="true" />
          <h1>{experiment.title}</h1>
        </div>

        <div className="phase-indicator">
          {PHASES.map((p, i) => (
            <span key={p.id} className={`phase-pip ${phase === p.id ? 'is-active' : ''} ${PHASES.findIndex((x) => x.id === phase) > i ? 'is-past' : ''}`}>
              {p.icon} {p.label}
              {i < PHASES.length - 1 && <span className="phase-arrow"> → </span>}
            </span>
          ))}
        </div>

        <button onClick={handleSubmit} className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Submit results'}
        </button>
      </header>

      <section className="lab-content">
        {phase === 'notes' && (
          <NotesView experiment={experiment} content={content} onStart={() => setPhase('experiment')} />
        )}

        {phase === 'experiment' && (
          <div className="experiment-phase">
            <div className="experiment-stage">
              {SimComponent ? (
                <SimComponent lab={lab} />
              ) : (
                <div className="sim-placeholder">
                  <h2>Simulation coming soon</h2>
                  <p className="text-muted">This experiment doesn’t have an interactive simulation yet.</p>
                </div>
              )}
            </div>
            <div className="experiment-sidebar">
              <StepsPanel experiment={experiment} progress={progress} onFinish={() => setPhase('questions')} />
              <TutorPanel tutor={tutor} />
            </div>
          </div>
        )}

        {phase === 'questions' && (
          <QuestionsView experiment={experiment} content={content} onFinish={() => navigate('/labs')} />
        )}
      </section>

      <footer className="lab-steps">
        {phase === 'experiment' ? (
          <span className="lab-steps-hint">{progress.completed}/{progress.total} steps complete — finish all steps to continue.</span>
        ) : (
          <span className="lab-steps-hint">{PHASES.find((p) => p.id === phase)?.label} phase</span>
        )}
      </footer>
    </div>
  )
}
