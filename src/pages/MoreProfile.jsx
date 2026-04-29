import { useNavigate } from 'react-router-dom'
import { User, Mail, Briefcase, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'

function initialsOf(nameOrEmail) {
  if (!nameOrEmail) return '?'
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  const letters = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
  return (letters || base.slice(0, 2)).toUpperCase()
}

export default function MoreProfile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.name || user?.email?.split('@')[0] || 'Account'
  const role = user?.role === 'ADMIN' ? 'Administrator' : 'User'
  const initials = initialsOf(user?.name || user?.email)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-4">
      <section className="card flex items-center gap-3">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center text-base md:text-lg font-extrabold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base md:text-lg font-bold truncate">{displayName}</p>
          <p className="text-xs md:text-sm text-graphite truncate">{role}</p>
        </div>
      </section>

      <section className="card divide-y divide-shadow p-0">
        <Row icon={User} label="Display name" value={displayName} />
        <Row icon={Mail} label="Email" value={user?.email || '—'} />
        <Row icon={Briefcase} label="Role" value={role} />
      </section>

      <button
        onClick={handleLogout}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-near-black text-white font-semibold py-2.5 text-sm"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>

      <p className="text-[11px] text-graphite text-center">
        Signed in via the OhMyCMO API. Other CRM data on this device is still
        stored locally.
      </p>
    </div>
  )
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-3 md:p-4">
      <Icon className="w-4 h-4 text-graphite shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] md:text-xs uppercase tracking-wider text-graphite font-semibold">
          {label}
        </p>
        <p className="text-sm md:text-base text-near-black truncate">{value}</p>
      </div>
    </div>
  )
}
