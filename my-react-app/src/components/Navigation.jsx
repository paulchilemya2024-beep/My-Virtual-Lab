import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Navigation() {
  const [open, setOpen] = useState(false)
  const toggleMenu = () => setOpen((current) => !current)
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    setOpen(false)
    navigate('/')
  }

  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <Link to="/" className="nav-logo">
            <span className="logo-icon">⚗</span>
            StemLab
          </Link>

          <div className="nav-links desktop-only">
            <NavLink to="/labs" className="nav-link">
              Labs
            </NavLink>
            <NavLink to="/board" className="nav-link">
              Board
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard" className="nav-link">
                  Dashboard
                </NavLink>
                <span className="nav-link">Hi, {user.name.split(' ')[0]}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="nav-link">
                  Log in
                </NavLink>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Get started free
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="hamburger mobile-toggle"
            onClick={toggleMenu}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div className={`mobile-nav-overlay ${open ? 'open' : ''}`} onClick={toggleMenu} />
      <div className={`mobile-nav-panel ${open ? 'open' : ''}`}>
        <div className="mobile-nav-inner">
          <span className="nav-logo">
            <span className="logo-icon">⚗</span>
            StemLab
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={toggleMenu}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="mobile-menu-links">
          <NavLink to="/labs" className="nav-link" onClick={toggleMenu}>
            Labs
          </NavLink>
          <NavLink to="/board" className="nav-link" onClick={toggleMenu}>
            Board
          </NavLink>
          {isAuthenticated ? (
            <>
              <NavLink to="/dashboard" className="nav-link" onClick={toggleMenu}>
                Dashboard
              </NavLink>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link" onClick={toggleMenu}>
                Log in
              </NavLink>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={toggleMenu}>
                Get started free
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  )
}
