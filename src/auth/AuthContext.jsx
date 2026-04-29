import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { api, getAccessToken, setAccessToken, onAuthChange, ApiError } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // 'pending' on first load while we verify any existing token.
  const [status, setStatus] = useState(getAccessToken() ? 'pending' : 'anon')

  // Bootstrap: if we have a token from a previous session, fetch the user.
  // If that 401s, the api client tries refresh; if refresh also fails it
  // clears the token and we land in 'anon'.
  useEffect(() => {
    let cancelled = false
    if (!getAccessToken()) {
      setStatus('anon')
      return () => {}
    }
    ;(async () => {
      try {
        const res = await api.get('/auth/me')
        if (cancelled) return
        setUser(res.data.user)
        setStatus('authed')
      } catch {
        if (cancelled) return
        setAccessToken(null)
        setUser(null)
        setStatus('anon')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Keep status/user in sync if the token is cleared from elsewhere
  // (e.g. a 401 on a background request triggers setAccessToken(null)).
  useEffect(() => {
    return onAuthChange((token) => {
      if (!token) {
        setUser(null)
        setStatus('anon')
      }
    })
  }, [])

  // identifier may be an email (owner) or a username (sub-user).
  const login = useCallback(async (identifier, password) => {
    const isEmail = typeof identifier === 'string' && identifier.includes('@')
    const body = isEmail
      ? { email: identifier, password }
      : { username: identifier, password }
    const res = await api.post('/auth/login', body)
    setAccessToken(res.data.accessToken)
    setUser(res.data.user)
    setStatus('authed')
    return res.data.user
  }, [])

  const register = useCallback(async ({ email, password, name }) => {
    const res = await api.post('/auth/register', { email, password, name })
    setAccessToken(res.data.accessToken)
    setUser(res.data.user)
    setStatus('authed')
    return res.data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // best effort — we still clear local state
    }
    setAccessToken(null)
    setUser(null)
    setStatus('anon')
  }, [])

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { ApiError }
