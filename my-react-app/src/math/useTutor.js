import { useCallback, useEffect, useRef, useState } from 'react'
import { tutorApi } from '../api/index.js'
import { Narrator } from './narration.js'

// The live AI tutor — one instance per lab session, created once in
// LabPage.jsx and handed to the simulation the same way setProgress and
// setSummary already are. A lab never calls the backend directly; it just
// reports WHAT happened (a goal completed, the student has gone quiet, a
// typed question) and this hook decides whether and how to ask.
//
// Deliberately reactive, not a continuous conversation: calls go out only at
// meaningful moments, not on a timer, so a full lab session costs a handful
// of requests rather than a running meter. Replies are spoken aloud with the
// exact same Narrator class the animated explainers already use — zero extra
// cost for voice out, same as everywhere else in this unit.
const GOAL_COOLDOWN_MS = 8000 // minimum gap between two goal/idle-triggered asks
const MAX_HISTORY_TURNS = 8 // sent back to the API each time; kept short on purpose

export function useTutor({ experimentId }) {
  const [status, setStatus] = useState({ checked: false, enabled: false })
  const [history, setHistory] = useState([]) // [{role:'student'|'tutor', message}]
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)

  const narratorRef = useRef(null)
  const historyRef = useRef([])
  const lastAskRef = useRef(0)
  const seenGoalsRef = useRef(new Set())

  useEffect(() => {
    narratorRef.current = new Narrator()
    return () => narratorRef.current?.dispose()
  }, [])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  useEffect(() => {
    narratorRef.current?.setMuted(muted)
  }, [muted])

  // Checked once per lab. If the server has no GEMINI_API_KEY configured,
  // `enabled` stays false and every notify/ask call below becomes a silent
  // no-op — a lab never has to check this itself before calling them.
  useEffect(() => {
    let cancelled = false
    tutorApi
      .status()
      .then((s) => {
        if (!cancelled) setStatus({ checked: true, enabled: Boolean(s.enabled) })
      })
      .catch(() => {
        if (!cancelled) setStatus({ checked: true, enabled: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const send = useCallback(
    async (trigger, context) => {
      if (!status.enabled) return
      setThinking(true)
      setError('')
      try {
        const { reply } = await tutorApi.ask({
          experimentId,
          trigger,
          context,
          history: historyRef.current.slice(-MAX_HISTORY_TURNS),
        })
        setHistory((prev) => {
          const studentTurn = trigger === 'question' ? [{ role: 'student', message: context.question }] : []
          return [...prev, ...studentTurn, { role: 'tutor', message: reply }]
        })
        narratorRef.current?.speak(reply, () => {})
      } catch (err) {
        setError(err.message || 'The tutor could not respond right now.')
      } finally {
        setThinking(false)
      }
    },
    [status.enabled, experimentId],
  )

  // Call once a specific goal flips from not-done to done. `goalKey` must be
  // stable and unique per goal (e.g. 'converged', 'ftcSeen') — each key only
  // ever triggers the tutor once per session, and a burst of several goals
  // completing together still only asks at most one question, keeping cost
  // predictable regardless of how fast a student moves.
  const notifyGoal = useCallback(
    (goalKey, label) => {
      if (seenGoalsRef.current.has(goalKey)) return
      seenGoalsRef.current.add(goalKey)
      const now = Date.now()
      if (now - lastAskRef.current < GOAL_COOLDOWN_MS) return
      lastAskRef.current = now
      send('goal', { label })
    },
    [send],
  )

  // Call when a lab notices the student has been stuck on the same
  // incomplete step for a while. No de-duping by key here — a lab is
  // expected to guard against firing this repeatedly itself (reset its own
  // "already nudged" flag only when the student interacts again).
  const notifyIdle = useCallback(
    (label) => {
      const now = Date.now()
      if (now - lastAskRef.current < GOAL_COOLDOWN_MS) return
      lastAskRef.current = now
      send('idle', { label })
    },
    [send],
  )

  const ask = useCallback(
    (question) => {
      const trimmed = (question || '').trim()
      if (!trimmed) return
      lastAskRef.current = Date.now()
      send('question', { question: trimmed })
    },
    [send],
  )

  return {
    enabled: status.enabled,
    checked: status.checked,
    history,
    thinking,
    error,
    muted,
    setMuted,
    notifyGoal,
    notifyIdle,
    ask,
  }
}
