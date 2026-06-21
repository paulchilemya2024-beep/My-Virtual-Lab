import { Link, useLocation } from 'react-router-dom'

export default function ResultsPage() {
  const location = useLocation()
  const result = location.state?.result
  const experimentTitle = location.state?.experimentTitle
  const finalPH = location.state?.finalPH

  // Reached directly (no session in navigation state) — guide them back.
  if (!result) {
    return (
      <div className="page results-page container">
        <div className="page-header">
          <div>
            <p className="eyebrow">Results</p>
            <h1>No results to show yet</h1>
            <p className="text-muted">Complete a lab and submit it to see your score here.</p>
          </div>
        </div>
        <div className="cta-footer card">
          <p>Ready for a lab?</p>
          <Link to="/labs" className="btn btn-primary btn-sm">Browse labs</Link>
        </div>
      </div>
    )
  }

  const { session, newBadges = [], progress } = result

  return (
    <div className="page results-page container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Results</p>
          <h1>Experiment complete! 🎉</h1>
          <p className="text-muted">{experimentTitle || session.experimentId}</p>
        </div>
      </div>

      <div className="results-grid">
        <section className="card">
          <h2>Final score</h2>
          <p className="result-value">{session.score}/100</p>
          <p className="text-muted">+{session.xpEarned} XP earned · Rank: {progress.rank}</p>
        </section>
        <section className="card">
          <h2>Insights</h2>
          <ul className="result-list">
            <li>Completed {session.stepsCompleted}/{session.totalSteps} steps.</li>
            {finalPH != null && <li>Final pH reading: {finalPH}.</li>}
            {session.score === 100 ? (
              <li>Flawless run — no mistakes recorded!</li>
            ) : (
              <li>Tip: add reagent drop-by-drop near the endpoint for a higher score.</li>
            )}
            {newBadges.length > 0 && <li>🏅 New badge{newBadges.length > 1 ? 's' : ''}: {newBadges.join(', ')}</li>}
          </ul>
        </section>
      </div>

      <div className="cta-footer card">
        <p>Ready for another lab?</p>
        <div className="hero-cta">
          <Link to="/labs" className="btn btn-primary btn-sm">Browse more labs</Link>
          <Link to="/dashboard" className="btn btn-outline btn-sm">View dashboard</Link>
        </div>
      </div>
    </div>
  )
}
