import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'

export default function Login() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [identifier, setIdentifier] = useState('admin@ohmycmo.local')
  const [password, setPassword] = useState('Admin@123')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (status === 'authed') return <Navigate to={from} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(identifier.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="display text-3xl text-near-black">OhMyCMO</h1>
          <p className="text-sm text-graphite mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <Field
            label="Email or username"
            type="text"
            value={identifier}
            onChange={setIdentifier}
            autoComplete="username"
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-near-black text-white font-semibold py-2.5 text-sm disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-[11px] text-graphite text-center leading-relaxed">
            Demo accounts:
            <br />
            Owner — <span className="font-mono">admin@ohmycmo.local</span> / <span className="font-mono">Admin@123</span>
            <br />
            Sub-user — <span className="font-mono">alice</span> / <span className="font-mono">alice123</span>
          </p>
        </form>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, autoComplete, required }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-graphite font-semibold mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-xl border border-shadow px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint focus:border-transparent"
      />
    </label>
  )
}
