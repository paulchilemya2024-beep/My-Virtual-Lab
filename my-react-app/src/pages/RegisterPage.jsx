import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '', grade: '', country: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(form)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page auth-page container">
      <div className="auth-card card">
        <p className="eyebrow">Create account</p>
        <h1>Get started with StemLab</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}
          <label className="form-group">
            <span className="form-label">Full name</span>
            <input className="form-input" type="text" placeholder="Your name" value={form.name} onChange={update('name')} required />
          </label>
          <label className="form-group">
            <span className="form-label">Email</span>
            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={update('email')} required />
          </label>
          <label className="form-group">
            <span className="form-label">Password</span>
            <input className="form-input" type="password" placeholder="Create a password (min 6 chars)" value={form.password} onChange={update('password')} required minLength={6} />
          </label>
          <div className="form-row">
            <label className="form-group">
              <span className="form-label">Grade</span>
              <input className="form-input" type="text" placeholder="e.g. Grade 10" value={form.grade} onChange={update('grade')} />
            </label>
            <label className="form-group">
              <span className="form-label">Country</span>
              <input className="form-input" type="text" placeholder="e.g. Ghana" value={form.country} onChange={update('country')} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Sign up free'}
          </button>
        </form>
        <p className="text-sm text-muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
