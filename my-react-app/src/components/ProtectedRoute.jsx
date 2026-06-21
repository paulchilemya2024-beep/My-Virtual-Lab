import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Wraps routes that require login. While we're still checking the stored token
// we show nothing; once known, we either render the page or bounce to /login
// (remembering where the user wanted to go so we can send them back).
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="page container">Loading…</div>
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  return children
}
