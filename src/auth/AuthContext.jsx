import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { api, getAccessToken, setAccessToken, onAuthChange, streamEvents, ApiError } from '../api/client.js'

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

  // Keep permissions current without a page refresh. The server pushes a
  // 'user' event the moment the owner changes this account (a live stream,
  // reconnected if it drops); a 60 s check and a check on tab focus are the
  // safety net. The state only changes when the user actually does.
  useEffect(() => {
    if (status !== 'authed') return undefined
    let live = true
    const ctrl = new AbortController()
    const sync = async () => {
      try {
        const res = await api.get('/auth/me')
        if (!live || !res?.data?.user) return
        setUser((u) => (JSON.stringify(u) === JSON.stringify(res.data.user) ? u : res.data.user))
      } catch {
        // A 401 is handled by the api client (it clears the token → 'anon').
      }
    }
    ;(async () => {
      let wait = 1000
      while (live) {
        try {
          await streamEvents('/auth/events', (name) => { if (name === 'user') sync() }, ctrl.signal)
          wait = 1000 // ended cleanly (e.g. server restart): reconnect soon
        } catch {
          if (!live) return
        }
        await new Promise((r) => setTimeout(r, wait))
        wait = Math.min(wait * 2, 30000)
        sync() // catch up on anything missed while disconnected
      }
    })()
    const onVisible = () => { if (document.visibilityState === 'visible') sync() }
    const id = setInterval(sync, 60000)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      live = false
      ctrl.abort()
      clearInterval(id)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status])

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

  const updateProfile = useCallback(async ({ name, username, avatar } = {}) => {
    const body = {}
    if (name !== undefined) body.name = name
    if (username !== undefined) body.username = username
    if (avatar !== undefined) body.avatar = avatar
    const res = await api.patch('/auth/me', body)
    if (res?.data?.accessToken) setAccessToken(res.data.accessToken)
    if (res?.data?.user) setUser(res.data.user)
    return res.data
  }, [])

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const res = await api.post('/auth/change-password', { currentPassword, newPassword })
    // Backend rotates tokens on success; keep this session authenticated.
    if (res?.data?.accessToken) setAccessToken(res.data.accessToken)
    if (res?.data?.user) setUser(res.data.user)
    return res.data
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
    () => ({ user, status, login, register, logout, updateProfile, changePassword }),
    [user, status, login, register, logout, updateProfile, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { ApiError }
