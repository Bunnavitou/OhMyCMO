import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Briefcase, LogOut, AtSign, KeyRound, Check, AlertCircle, Eye, EyeOff } from 'lucide-react'
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

      <ChangePassword />

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

// Password input with a show/hide toggle.
function PasswordInput({ label, value, onChange, autoComplete, required, minLength }) {
  const { t } = useT()
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wider text-graphite font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          className="input pr-10"
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? t('profile.hidePassword') : t('profile.showPassword')}
          title={show ? t('profile.hidePassword') : t('profile.showPassword')}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-graphite hover:text-near-black"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

function ChangePassword() {
  const { changePassword } = useAuth()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  function reset() {
    setCurrent(''); setNext(''); setConfirm(''); setError(''); setOk(false)
  }

  async function submit(e) {
    e.preventDefault()
    setError(''); setOk(false)
    if (next.length < 8) { setError(t('profile.passwordTooShort')); return }
    if (next !== confirm) { setError(t('profile.passwordMismatch')); return }
    if (next === current) { setError(t('profile.passwordSame')); return }
    setBusy(true)
    try {
      await changePassword(current, next)
      setOk(true)
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setError(err?.message || t('profile.passwordMismatch'))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => { reset(); setOpen(true) }}
        className="w-full card flex items-center gap-3 text-left hover:bg-iron transition-colors"
      >
        <KeyRound className="w-4 h-4 text-graphite shrink-0" />
        <span className="flex-1 text-sm md:text-base font-semibold">{t('profile.changePassword')}</span>
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-graphite" />
        <h3 className="text-sm md:text-base font-bold">{t('profile.changePassword')}</h3>
      </div>

      <PasswordInput
        label={t('profile.currentPassword')}
        value={current} onChange={setCurrent}
        autoComplete="current-password" required
      />

      <PasswordInput
        label={t('profile.newPassword')}
        value={next} onChange={setNext}
        autoComplete="new-password" required minLength={8}
      />

      <PasswordInput
        label={t('profile.confirmPassword')}
        value={confirm} onChange={setConfirm}
        autoComplete="new-password" required minLength={8}
      />

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
        </p>
      )}
      {ok && (
        <p className="flex items-center gap-1.5 text-xs text-green-600">
          <Check className="w-3.5 h-3.5 shrink-0" />{t('profile.passwordUpdated')}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit" disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-near-black text-white font-semibold py-2.5 text-sm disabled:opacity-60"
        >
          {busy ? t('common.saving') : t('profile.updatePassword')}
        </button>
        <button
          type="button" onClick={() => { reset(); setOpen(false) }}
          className="rounded-full border border-shadow font-semibold py-2.5 px-4 text-sm"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
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
