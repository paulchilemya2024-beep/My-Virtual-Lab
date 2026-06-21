import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authApi } from '../api/index.js'
import { getToken, setToken } from '../api/client.js'

// Holds the logged-in user across the whole app. The token lives in localStorage
// so a page refresh keeps the user signed in; on startup we verify it with /me.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // true until we've checked the stored token

  // On first load, if there's a stored token, confirm it still works.
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const { user } = await authApi.me()
        if (!cancelled) setUser(user)
      } catch {
        setToken(null) // token invalid/expired — clear it
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const { token, user } = await authApi.login(credentials)
    setToken(token)
    setUser(user)
    return user
  }, [])

  const register = useCallback(async (payload) => {
    const { token, user } = await authApi.register(payload)
    setToken(token)
    setUser(user)
    return user
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const value = { user, loading, isAuthenticated: Boolean(user), login, register, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider by convention
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside an <AuthProvider>')
  return ctx
}
