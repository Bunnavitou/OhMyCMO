// Lightweight fetch wrapper for the OhMyCMO API.
//
// - Base URL comes from VITE_API_URL ("/api" in dev/prod via the Vite proxy
//   and nginx in production), so all calls are same-origin.
// - Access token kept in memory (and mirrored to localStorage so it survives
//   page reloads). Refresh token is an httpOnly cookie set by the backend.
// - On 401 we transparently call /auth/refresh once and retry the original
//   request. If refresh fails, we clear local state and the AuthContext
//   listener will redirect to /login.

const BASE = import.meta.env.VITE_API_URL || '/api'
const STORAGE_KEY = 'ohmycmo:accessToken'

let accessToken = localStorage.getItem(STORAGE_KEY) || null
const listeners = new Set()

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token) {
  accessToken = token || null
  if (token) localStorage.setItem(STORAGE_KEY, token)
  else localStorage.removeItem(STORAGE_KEY)
  listeners.forEach((fn) => fn(accessToken))
}

export function onAuthChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function parseResponse(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

async function rawRequest(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const init = {
    method,
    credentials: 'include', // refresh cookie
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    signal,
  }
  if (body !== undefined) init.body = JSON.stringify(body)

  const res = await fetch(`${BASE}${path}`, init)
  const payload = await parseResponse(res)
  if (!res.ok) {
    const msg = payload?.error?.message || `HTTP ${res.status}`
    throw new ApiError(res.status, msg, payload?.error?.details)
  }
  return payload
}

let refreshPromise = null

async function doRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const r = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!r.ok) throw new ApiError(r.status, 'refresh failed')
        const data = await r.json()
        const newToken = data?.data?.accessToken
        if (!newToken) throw new ApiError(401, 'no access token in refresh response')
        setAccessToken(newToken)
        return newToken
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

export async function request(path, opts = {}) {
  try {
    return await rawRequest(path, opts)
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 401 &&
      !opts._retry &&
      // Don't try to refresh the refresh/login/register endpoints themselves.
      !path.startsWith('/auth/refresh') &&
      !path.startsWith('/auth/login') &&
      !path.startsWith('/auth/register')
    ) {
      try {
        await doRefresh()
        return await rawRequest(path, { ...opts, _retry: true })
      } catch {
        setAccessToken(null)
        throw err
      }
    }
    throw err
  }
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
}

export { ApiError }
