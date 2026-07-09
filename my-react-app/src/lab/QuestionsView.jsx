import { useState } from 'react'

// Part C — shown after the experiment. 4–6 hardcoded, curriculum-aligned
// questions (never AI-generated) mixing multiple choice, true/false and short
// answer. Submitting reveals correct/wrong with explanations and a final score.
export default function QuestionsView({ experiment, content, onFinish }) {
  const questions = content?.questions || []
  const [answers, setAnswers] = useState(() => questions.map(() => null))
  const [submitted, setSubmitted] = useState(false)

  function setAnswer(i, value) {
    if (submitted) return
    setAnswers((prev) => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  const answerableCount = questions.filter((q) => q.type !== 'short').length
  const correctCount = questions.filter((q, i) => {
    if (q.type === 'mc') return answers[i] != null && q.options[answers[i]]?.correct
    if (q.type === 'tf') return answers[i] === q.answer
    return false
  }).length

  function submit() {
    setSubmitted(true)
  }

  return (
    <div className="questions-view">
      <h1 className="notes-title">Check your understanding</h1>
      <p className="text-muted">{experiment.title} — answer every question, then submit to see your results.</p>

      {questions.map((q, i) => (
        <div key={i} className="question-card">
          <p className="question-prompt">
            <span className="question-num">Q{i + 1}</span> {q.prompt}
          </p>

          {q.type === 'mc' && (
            <div className="question-options">
              {q.options.map((opt, oi) => {
                const chosen = answers[i] === oi
                const showState = submitted
                const isCorrect = opt.correct
                const cls = !showState
                  ? chosen
                    ? 'option-chosen'
                    : ''
                  : isCorrect
                    ? 'option-correct'
                    : chosen
                      ? 'option-wrong'
                      : ''
                return (
                  <button
                    key={oi}
                    type="button"
                    className={`question-option ${cls}`}
                    onClick={() => setAnswer(i, oi)}
                    disabled={submitted}
                  >
                    {showState && isCorrect && '✓ '}
                    {showState && chosen && !isCorrect && '✗ '}
                    {opt.text}
                  </button>
                )
              })}
              {submitted && <p className="question-explanation">{q.explanation}</p>}
            </div>
          )}

          {q.type === 'tf' && (
            <div className="question-options">
              {[true, false].map((val) => {
                const chosen = answers[i] === val
                const showState = submitted
                const isCorrect = val === q.answer
                const cls = !showState ? (chosen ? 'option-chosen' : '') : isCorrect ? 'option-correct' : chosen ? 'option-wrong' : ''
                return (
                  <button key={String(val)} type="button" className={`question-option ${cls}`} onClick={() => setAnswer(i, val)} disabled={submitted}>
                    {showState && isCorrect && '✓ '}
                    {showState && chosen && !isCorrect && '✗ '}
                    {val ? 'True' : 'False'}
                  </button>
                )
              })}
              {submitted && <p className="question-explanation">{q.explanation}</p>}
            </div>
          )}

          {q.type === 'short' && (
            <div className="question-short">
              <textarea
                className="form-input"
                rows={2}
                placeholder="Type your observation here…"
                value={answers[i] || ''}
                onChange={(e) => setAnswer(i, e.target.value)}
                disabled={submitted}
              />
              {submitted && (
                <p className="question-explanation">
                  <strong>Model answer:</strong> {q.modelAnswer}
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {!submitted ? (
        <button type="button" className="btn btn-primary btn-full notes-start-btn" onClick={submit}>
          Submit answers
        </button>
      ) : (
        <div className="question-results">
          <p className="question-score">
            You got {correctCount} out of {answerableCount} correct
          </p>
          <p className="question-encourage">
            {correctCount === answerableCount
              ? 'Perfect score — you really understood this experiment!'
              : correctCount >= answerableCount / 2
                ? 'Solid work — review the explanations above for anything you missed.'
                : "Keep going — re-reading the notes and trying the experiment again will help this click."}
          </p>
          <button type="button" className="btn btn-outline btn-full" onClick={onFinish}>
            Finish
          </button>
        </div>
      )}
    </div>
  )
}
