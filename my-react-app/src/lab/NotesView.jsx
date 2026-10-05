import { useEffect, useMemo, useState } from 'react'
import ExplainerPlayer from '../math/ExplainerPlayer.jsx'
import { explainerFor } from '../math/explainers/index.js'

const SUBJECT_LABEL = { chemistry: 'Chemistry', physics: 'Physics', biology: 'Biology', mathematics: 'Mathematics' }
const SENTENCE_SPLIT = /[^.!?]+[.!?]+|\S+$/g

// Part A — the reading page shown before every experiment. Renders the
// curriculum notes, reads them aloud with the Web Speech API (highlighting the
// sentence currently being spoken), and only advances to the experiment when
// the student clicks through — never auto-skipped on a first visit.
//
// When a lab has an animated explainer, that plays the concept through instead
// of the read-aloud bar, and the written notes stay below it as the reference
// a student can re-read at their own pace.
export default function NotesView({ experiment, content, onStart }) {
  const notes = content?.notes
  const keyTerms = notes?.keyTerms || []
  const explainer = explainerFor(experiment._id || experiment.id)

  const [playing, setPlaying] = useState(false)
  const [activeSentence, setActiveSentence] = useState(-1)

  // Every sentence tagged with a global index (for TTS highlighting), computed
  // once per `content` change — a pure derivation, not a ref, so it's safe to
  // read during render.
  const { taggedSections, sentenceTexts } = useMemo(() => {
    const sections = content?.notes?.sections || []
    let idx = 0
    const flat = []
    const tagged = sections.map((section) => ({
      title: section.title,
      paragraphs: section.paragraphs.map((para) => {
        const matches = para.match(SENTENCE_SPLIT) || [para]
        return matches.map((m) => {
          const text = m.trim()
          flat.push(text)
          return { text, index: idx++ }
        })
      }),
    }))
    return { taggedSections: tagged, sentenceTexts: flat }
  }, [content])

  const seenKey = `notes_seen_${experiment._id || experiment.id}`
  const [alreadySeen] = useState(() => {
    try {
      return localStorage.getItem(seenKey) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(seenKey, '1')
    } catch {
      /* localStorage unavailable — skip-link just won't be offered next time */
    }
  }, [seenKey])

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  function pickVoice() {
    const voices = window.speechSynthesis.getVoices()
    return (
      voices.find((v) => /female|samantha|google uk english female/i.test(v.name)) ||
      voices.find((v) => v.lang?.startsWith('en')) ||
      voices[0]
    )
  }

  function togglePlay() {
    const synth = window.speechSynthesis
    if (!synth) return
    if (playing) {
      synth.cancel()
      setPlaying(false)
      setActiveSentence(-1)
      return
    }
    if (!sentenceTexts.length) return
    const utterance = new SpeechSynthesisUtterance(sentenceTexts.join(' '))
    utterance.rate = 0.9
    utterance.pitch = 1.0
    const voice = pickVoice()
    if (voice) utterance.voice = voice

    // Track cumulative character offsets per sentence so onboundary (word-level)
    // can be mapped to "which sentence is this word inside".
    const bounds = []
    let acc = 0
    for (const s of sentenceTexts) {
      bounds.push([acc, acc + s.length])
      acc += s.length + 1 // +1 for the joining space
    }
    utterance.onboundary = (e) => {
      const idx = bounds.findIndex(([start, end]) => e.charIndex >= start && e.charIndex < end)
      if (idx >= 0) setActiveSentence(idx)
    }
    utterance.onend = () => {
      setPlaying(false)
      setActiveSentence(-1)
    }
    utterance.onerror = () => {
      setPlaying(false)
      setActiveSentence(-1)
    }
    synth.speak(utterance)
    setPlaying(true)
  }

  return (
    <div className="notes-view">
      <span className={`pill subject-pill subj-${experiment.subject || 'science'}`}>
        {SUBJECT_LABEL[experiment.subject] || 'Science'}
      </span>
      <h1 className="notes-title">{experiment.title}</h1>

      {explainer ? (
        <ExplainerPlayer explainer={explainer} />
      ) : (
        <div className="audio-player-bar">
          <button type="button" className="audio-play-btn" onClick={togglePlay} aria-label={playing ? 'Pause narration' : 'Play narration'}>
            {playing ? '⏸' : '▶'}
          </button>
          <div className="audio-progress-track">
            <div
              className="audio-progress-fill"
              style={{ width: sentenceTexts.length ? `${((activeSentence + 1) / sentenceTexts.length) * 100}%` : '0%' }}
            />
          </div>
          <span className="audio-label">Listen to this section</span>
        </div>
      )}

      {explainer && <h2 className="notes-read-heading">The same idea, in writing</h2>}

      {taggedSections.map((section, i) => (
        <section key={i} className="notes-section">
          <h2>{section.title}</h2>
          {section.paragraphs.map((sentences, j) => (
            <p key={j}>
              {sentences.map((sen) => (
                <span key={sen.index} className={sen.index === activeSentence ? 'notes-sentence is-active' : 'notes-sentence'}>
                  {sen.text}{' '}
                </span>
              ))}
            </p>
          ))}
        </section>
      ))}

      {keyTerms.length > 0 && (
        <div className="key-terms-box">
          <h3>Key terms</h3>
          <dl>
            {keyTerms.map((kt) => (
              <div key={kt.term} className="key-term-row">
                <dt>{kt.term}</dt>
                <dd>{kt.def}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <button type="button" className="btn btn-primary btn-full notes-start-btn" onClick={onStart}>
        I have read the notes — Start Experiment →
      </button>
      {alreadySeen && (
        <button type="button" className="notes-skip-link" onClick={onStart}>
          Skip to experiment →
        </button>
      )}
    </div>
  )
}
