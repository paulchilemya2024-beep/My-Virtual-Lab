import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { experimentsApi } from '../api/index.js'

const subjects = ['All', 'Chemistry', 'Physics', 'Biology']

// Format minutes -> "25 min"; difficulty number -> a Beginner/Intermediate/Advanced label.
const levelForDifficulty = (d) => (d <= 1 ? 'Beginner' : d <= 3 ? 'Intermediate' : 'Advanced')
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export default function LabsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = searchParams.get('subject') || 'All'

  const [labs, setLabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await experimentsApi.list({ subject: filter })
        if (!cancelled) setLabs(data)
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
  }, [filter])

  return (
    <div className="page labs-page container">
      <div className="page-header">
        <div>
          <p className="eyebrow">All labs</p>
          <h1>Choose a science experiment</h1>
          <p className="text-muted">Filter by subject and jump into an interactive learning session.</p>
        </div>
      </div>

      <div className="subject-filters">
        {subjects.map((subjectName) => (
          <button
            key={subjectName}
            type="button"
            className={`pill ${filter === subjectName ? 'pill-active' : ''}`}
            onClick={() => setSearchParams({ subject: subjectName === 'All' ? '' : subjectName })}
          >
            {subjectName}
          </button>
        ))}
      </div>

      {loading && <p className="text-muted">Loading labs…</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && labs.length === 0 && (
        <p className="text-muted">No labs found. (Did you seed the backend with <code>npm run seed</code>?)</p>
      )}

      <div className="labs-grid">
        {labs.map((lab) => (
          <article key={lab.id} className="lab-card card">
            <div>
              <p className="tag tag-teal">{capitalize(lab.subject)}</p>
              <h3>{lab.title}</h3>
              <p className="text-muted text-sm">{lab.description}</p>
            </div>
            <div className="lab-footer">
              <span>{lab.estimatedTime} min</span>
              <span>{levelForDifficulty(lab.difficulty)}</span>
            </div>
            <Link to={`/labs/${lab.id}`} className="btn btn-outline btn-sm">
              Open lab
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}
