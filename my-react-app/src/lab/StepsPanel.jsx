// Part B's right-hand panel: the procedure list. Reads `experiment.steps` (each
// { stepNumber, instruction, hint }) and highlights the current one against
// `progress.completed`, which every sim already maintains via setProgress. When
// every step is done, a "Finish Experiment" button hands off to Part C.
export default function StepsPanel({ experiment, progress, onFinish }) {
  const steps = experiment.steps || []
  const completed = progress?.completed || 0
  const total = progress?.total || steps.length
  const done = completed >= total && total > 0

  return (
    <aside className="steps-panel">
      <h2 className="steps-panel-title">Procedure</h2>
      <ol className="steps-panel-list">
        {steps.map((s, i) => {
          const n = s.stepNumber ?? i + 1
          const isDone = completed >= n
          const isActive = !isDone && completed === n - 1
          return (
            <li key={n} className={`steps-panel-item ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}>
              <span className="steps-panel-num">{isDone ? '✓' : n}</span>
              <div>
                <p className="steps-panel-do"><strong>Do:</strong> {s.instruction}</p>
                {s.hint && <p className="steps-panel-observe"><strong>Observe:</strong> {s.hint}</p>}
              </div>
            </li>
          )
        })}
      </ol>
      <div className="steps-panel-progress">
        {completed}/{total} steps complete
      </div>
      {done && (
        <button type="button" className="btn btn-primary btn-full" onClick={onFinish}>
          Finish Experiment →
        </button>
      )}
    </aside>
  )
}
