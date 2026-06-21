import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { progressApi } from '../api/index.js'

const timeAgo = (date) => {
  if (!date) return ''
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  return `${Math.round(hrs / 24)} d ago`
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    progressApi
      .me()
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="page container">Loading dashboard…</div>
  if (error) return <div className="page container"><p className="form-error">{error}</p></div>

  const { progress, recentSessions } = data
  const accuracy = recentSessions.length
    ? Math.round(recentSessions.reduce((sum, s) => sum + (s.score || 0), 0) / recentSessions.length)
    : 0

  return (
    <div className="page dashboard-page container">
      <div className="dashboard-top">
        <div>
          <p className="eyebrow">Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}</p>
          <h1>Student dashboard</h1>
          <p className="text-muted">Rank: {progress.rank}</p>
        </div>
        <div className="xp-summary card">
          <span className="xp-label">Current XP</span>
          <strong className="xp-num">{progress.totalXP.toLocaleString()}</strong>
          <div className="xp-bar">
            <div className="xp-fill" style={{ width: `${progress.percentToNext ?? 0}%` }} />
          </div>
          <div className="xp-meta">
            {progress.next ? `${progress.percentToNext}% to ${progress.next}` : 'Max rank reached 🎉'}
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <p className="stat-card-label">Experiments completed</p>
          <strong className="stat-card-num">{progress.experimentsCompleted}</strong>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Avg. recent score</p>
          <strong className="stat-card-num">{accuracy}%</strong>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Rank</p>
          <strong className="stat-card-num" style={{ fontSize: '1.1rem' }}>{progress.rank}</strong>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Badges earned</p>
          <strong className="stat-card-num">{progress.badges.length}</strong>
        </div>
      </div>

      <div className="dash-cols">
        <section className="card">
          <div className="section-header">
            <h3 className="section-title">Recent sessions</h3>
            <Link to="/labs" className="section-link">Browse labs →</Link>
          </div>
          <div className="session-list">
            {recentSessions.length === 0 && (
              <p className="text-muted">No sessions yet. <Link to="/labs">Start your first lab →</Link></p>
            )}
            {recentSessions.map((s) => (
              <div className="session-item" key={s._id}>
                <div>
                  <strong className="session-title">{s.experimentId}</strong>
                  <p className="session-meta">{timeAgo(s.completedAt || s.createdAt)}</p>
                </div>
                <div className={`session-score ${s.score >= 80 ? 'score-high' : 'score-mid'}`}>+{s.xpEarned}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card ai-suggestion">
          <div className="ai-ava">🧑‍🔬</div>
          <div>
            <h4>Your badges</h4>
            <p>{progress.badges.length ? progress.badges.join(', ') : 'Complete a lab to earn your first badge!'}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
