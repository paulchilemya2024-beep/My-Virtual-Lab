import { useState } from 'react'

// The live tutor's UI: a short running log of what it has said, a box for the
// student to ask their own question, and a mute toggle. Renders nothing at
// all once the status check comes back (or fails) as disabled — a student on
// a deployment with no GEMINI_API_KEY configured never sees a broken feature,
// because there is nothing on screen to be broken.
export default function TutorPanel({ tutor }) {
  const [draft, setDraft] = useState('')

  if (!tutor.checked || !tutor.enabled) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!draft.trim()) return
    tutor.ask(draft)
    setDraft('')
  }

  return (
    <div className="tutor-panel">
      <div className="tutor-head">
        <span className="tutor-title">🧑‍🏫 AI Tutor</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => tutor.setMuted(!tutor.muted)}
          aria-pressed={tutor.muted}
          title={tutor.muted ? 'Unmute the tutor' : 'Mute the tutor'}
        >
          {tutor.muted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className="tutor-log" aria-live="polite">
        {tutor.history.length === 0 && !tutor.thinking && (
          <p className="tutor-hint">Work through the lab — the tutor will speak up when something worth noticing happens, or ask it anything below.</p>
        )}
        {tutor.history.map((turn, i) => (
          <p key={i} className={`tutor-turn tutor-turn-${turn.role}`}>
            <span className="tutor-turn-label">{turn.role === 'student' ? 'You' : 'Tutor'}</span>
            {turn.message}
          </p>
        ))}
        {tutor.thinking && <p className="tutor-turn tutor-turn-thinking">Tutor is thinking…</p>}
        {tutor.error && <p className="tutor-turn tutor-turn-error">{tutor.error}</p>}
      </div>

      <form className="tutor-ask" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask the tutor a question…"
          aria-label="Ask the tutor a question"
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={tutor.thinking || !draft.trim()}>
          Ask
        </button>
      </form>
    </div>
  )
}
