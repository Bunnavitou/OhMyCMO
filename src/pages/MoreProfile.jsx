import { useNavigate } from 'react-router-dom'
import { User, Mail, Briefcase, LogOut, AtSign } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'

function initialsOf(nameOrId) {
  if (!nameOrId) return '?'
  const base = nameOrId.includes('@') ? nameOrId.split('@')[0] : nameOrId
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  const letters = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
  return (letters || base.slice(0, 2)).toUpperCase()
}

export default function MoreProfile() {
  const { user, logout } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()

  const displayName =
    user?.name || user?.email?.split('@')[0] || user?.username || 'Account'
  const role = user?.role === 'ADMIN' ? t('profile.role.admin') : t('profile.role.user')
  const initials = initialsOf(user?.name || user?.email || user?.username)

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
        <Row icon={User} label={t('profile.displayName')} value={displayName} />
        {user?.email && <Row icon={Mail} label={t('profile.email')} value={user.email} />}
        {user?.username && <Row icon={AtSign} label={t('profile.username')} value={user.username} />}
        <Row icon={Briefcase} label={t('profile.role')} value={role} />
      </section>

      <button
        onClick={handleLogout}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-near-black text-white font-semibold py-2.5 text-sm"
      >
        <LogOut className="w-4 h-4" />
        {t('profile.signOut')}
      </button>

      <p className="text-[11px] text-graphite text-center">
        {t('profile.note')}
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
