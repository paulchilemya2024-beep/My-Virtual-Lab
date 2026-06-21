import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { experimentsApi, agentApi, progressApi } from '../api/index.js'
import ChemistryLab from '../lab/ChemistryLab.jsx'
import TitrationLab from '../lab/TitrationLab.jsx'
import CircuitLab from '../lab/CircuitLab.jsx'
import ProjectileLab from '../lab/ProjectileLab.jsx'
import InclineLab from '../lab/InclineLab.jsx'
import PendulumLab from '../lab/PendulumLab.jsx'

// Maps an experiment _id to the simulation component that runs it. This is the
// fix for the "every experiment loads the titration beaker" bug: the lab page
// now dispatches on the experiment id instead of hard-coding the chemistry sim.
// Titration has its own component with a realistic strong-acid pH curve; other
// chemistry experiments share the generic ChemistryLab beaker.
const SIM_BY_ID = {
  titration: TitrationLab,
  circuit: CircuitLab,
  projectile: ProjectileLab,
  incline: InclineLab,
  pendulum: PendulumLab,
}

// Pick the right simulation: explicit id mapping first, then fall back to the
// chemistry sim for anything that defines chemicals (titration, indicators,
// osmosis, …), and a friendly placeholder for everything else.
function resolveSim(experiment) {
  if (SIM_BY_ID[experiment._id || experiment.id]) return SIM_BY_ID[experiment._id || experiment.id]
  if ((experiment.availableChemicals || []).length > 0) return ChemistryLab
  return null
}

export default function LabPage() {
  const { labId } = useParams()
  const navigate = useNavigate()

  const [experiment, setExperiment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Shared tutor (SIMI) chat + progress, owned by the shell and exposed to the
  // active simulation through a small `lab` API object.
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [thinking, setThinking] = useState(false)
  const [mistakes, setMistakes] = useState([])
  const [progress, setProgressState] = useState({ completed: 0, total: 6 })
  const [submitting, setSubmitting] = useState(false)

  const summaryRef = useRef({ precisionAchieved: false }) // sim-specific submit extras
  const progressRef = useRef(progress)
  const startedAt = useRef(new Date().toISOString())
  const messagesEndRef = useRef(null)

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

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
        document.title = `Lab • ${exp.title}`
        try {
          const { reply } = await agentApi.ask({ experimentId: labId, question: '' })
          if (!cancelled) setMessages([{ role: 'tutor', text: reply }])
        } catch {
          if (!cancelled) {
            setMessages([{ role: 'tutor', text: `Welcome to ${exp.title}! Follow the steps and I'll guide you.` }])
          }
        }
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

  // ── The API handed to every simulation component ──
  const consultTutor = useCallback(
    async (studentLine, lastAction, extraContext = {}) => {
      setThinking(true)
      try {
        const context = {
          experimentId: labId,
          studentLevel: 'beginner',
          currentStep: (progressRef.current.completed || 0) + 1,
          lastAction,
          ...extraContext,
        }
        const { reply } = await agentApi.ask({ ...context, question: studentLine || '' })
        setMessages((prev) => [...prev, { role: 'tutor', text: reply }])
      } catch (err) {
        setMessages((prev) => [...prev, { role: 'tutor', text: `(${err.message})` }])
      } finally {
        setThinking(false)
      }
    },
    [labId],
  )

  const pushMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { role, text }])
  }, [])

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

  const lab = {
    experiment,
    consultTutor,
    pushMessage,
    setProgress,
    addMistake,
    setSummary,
    thinking,
  }

  function handleSend() {
    const text = question.trim()
    if (!text) return
    setMessages((prev) => [...prev, { role: 'student', text }])
    setQuestion('')
    consultTutor(text, 'asked a question')
  }

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
        aiConversation: messages.map((m) => ({
          role: m.role === 'student' ? 'student' : 'tutor',
          message: m.text,
        })),
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

  const SimComponent = resolveSim(experiment)

  return (
    <div className="page lab-page container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Lab session</p>
          <h1>{experiment.title}</h1>
          <p className="text-muted">{experiment.description}</p>
        </div>
        <button onClick={handleSubmit} className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Submit results'}
        </button>
      </div>

      <div className="lab-shell">
        <section className="lab-panel card">
          {SimComponent ? (
            <SimComponent lab={lab} />
          ) : (
            <div className="sim-placeholder">
              <h2>Simulation coming soon</h2>
              <p className="text-muted">
                This experiment doesn’t have an interactive simulation yet. You can still chat with SIMI about the
                concepts on the right.
              </p>
            </div>
          )}
        </section>

        <aside className="lab-sidebar">
          <div className="ai-chat card">
            <div className="ai-chat-header">
              <span className="ai-avatar" aria-hidden="true">🧪</span>
              <div>
                <strong>SIMI</strong>
                <span className="ai-status">AI Tutor · {progress.completed}/{progress.total} steps</span>
              </div>
            </div>
            <div className="ai-chat-messages">
              {messages.map((message, index) => (
                <div key={index} className={`chat-message ${message.role}`}>
                  <p>{message.text}</p>
                </div>
              ))}
              {thinking && (
                <div className="chat-message tutor">
                  <p className="typing-dots"><span></span><span></span><span></span></p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="ai-input-bar">
              <input
                className="ai-input"
                placeholder="Ask SIMI a question…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button type="button" className="ai-send-btn" onClick={handleSend}>
                →
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
