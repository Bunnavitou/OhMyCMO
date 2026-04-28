import { useState } from 'react'
import {
  UserPlus, User, Trash2, Eye, EyeOff, Pencil,
  Users, Lock, ShieldCheck,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'

const ACCESS_MENUS = [
  { key: 'customers', label: 'Customers' },
  { key: 'products',  label: 'Products & Services' },
  { key: 'partners',  label: 'Partners' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'assets',    label: 'Assets Management' },
  { key: 'subUsers',  label: 'Sub user Management' },
]

const accessSummary = (access = {}) => {
  const granted = ACCESS_MENUS.filter((m) => access[m.key]).map((m) => m.label)
  if (granted.length === 0) return 'No access'
  if (granted.length === ACCESS_MENUS.length) return 'Full access'
  return granted.join(' · ')
}

export default function MoreSubUsers() {
  const { state, addSubUser, updateSubUser, removeSubUser } = useStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const subUsers = state.subUsers || []

  const onSave = (data) => {
    if (editing) updateSubUser(editing.id, data)
    else addSubUser(data)
    setOpen(false)
    setEditing(null)
  }

  const onDelete = (u) => {
    if (!confirm(`Remove sub user "${u.username}"?`)) return
    removeSubUser(u.id)
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => { setEditing(null); setOpen(true) }}
        className="btn-primary w-full"
      >
        <UserPlus className="w-4 h-4" /> Add sub user
      </button>

      {subUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No sub users yet"
          description="Invite teammates by setting a username, password and which menus they can access."
        />
      ) : (
        <ul className="card divide-y divide-shadow p-0">
          {subUsers.map((u) => (
            <li key={u.id} className="flex items-center gap-3 p-3 md:p-4">
              <div className="w-10 h-10 rounded-full bg-mint-bg text-wise-dark flex items-center justify-center font-bold text-sm shrink-0">
                {(u.username || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm md:text-base font-bold text-near-black truncate">
                    {u.username}
                  </p>
                  {!u.active && (
                    <span className="pill bg-iron text-graphite">disabled</span>
                  )}
                </div>
                <p className="text-xs text-graphite truncate flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 shrink-0" /> {accessSummary(u.access)}
                </p>
              </div>
              <button
                onClick={() => { setEditing(u); setOpen(true) }}
                className="p-2 rounded-full hover:bg-iron text-graphite transition-transform hover:scale-105 active:scale-95"
                aria-label="Edit sub user"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(u)}
                className="p-2 rounded-full hover:bg-rose-50 text-rose-500 transition-transform hover:scale-105 active:scale-95"
                aria-label="Remove sub user"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-graphite text-center">
        Credentials are stored locally on this device for now. Hook up real auth before going live.
      </p>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null) }}
        title={editing ? 'Edit sub user' : 'Add sub user'}
        size="lg"
      >
        <SubUserForm
          key={editing?.id || 'new'}
          initial={editing}
          onSubmit={onSave}
          onDelete={editing ? () => { onDelete(editing); setOpen(false); setEditing(null) } : null}
        />
      </Modal>
    </div>
  )
}

function SubUserForm({ initial, onSubmit, onDelete }) {
  const defaultAccess = {
    customers: true,
    products: true,
    partners: true,
    marketing: true,
    assets: false,
    subUsers: false,
  }
  const [username, setUsername] = useState(initial?.username || '')
  const [password, setPassword] = useState(initial?.password || '')
  const [showPw, setShowPw] = useState(false)
  const [active, setActive] = useState(initial?.active ?? true)
  const [access, setAccess] = useState({ ...defaultAccess, ...(initial?.access || {}) })
  const [err, setErr] = useState('')

  const toggleAccess = (k) => setAccess((a) => ({ ...a, [k]: !a[k] }))

  const handleSelectAll = () => {
    const allOn = ACCESS_MENUS.every((m) => access[m.key])
    setAccess(
      ACCESS_MENUS.reduce((acc, m) => ({ ...acc, [m.key]: !allOn }), {}),
    )
  }

  const submit = (e) => {
    e.preventDefault()
    if (!username.trim()) return setErr('Username is required.')
    if (!initial && !password.trim()) return setErr('Password is required.')
    if (password && password.length < 4) return setErr('Password must be at least 4 characters.')
    setErr('')
    onSubmit({
      username: username.trim(),
      password,
      active,
      access,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Username *</label>
        <div className="relative">
          <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
          <input
            className="input pl-9"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. brand.coordinator"
          />
        </div>
      </div>

      <div>
        <label className="label">Password {initial ? '(leave blank to keep)' : '*'}</label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
          <input
            className="input pl-9 pr-10"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={initial ? '••••••••' : 'At least 4 characters'}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-graphite hover:bg-iron rounded-full"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="label !mb-0">Access menus</span>
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-[11px] font-semibold text-wise-dark hover:underline"
          >
            {ACCESS_MENUS.every((m) => access[m.key]) ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div className="card !p-0 divide-y divide-shadow">
          {ACCESS_MENUS.map((m) => {
            const on = !!access[m.key]
            return (
              <label
                key={m.key}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-iron"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleAccess(m.key)}
                  className="w-4 h-4 accent-wise-green"
                />
                <span className="flex-1 text-sm text-near-black">{m.label}</span>
                <span
                  className={`pill ${on ? 'bg-wise-green text-wise-dark' : 'bg-iron text-graphite'}`}
                >
                  {on ? 'Allowed' : 'Hidden'}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-graphite cursor-pointer">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="w-4 h-4 accent-wise-green"
        />
        <span>Active — sign-in is allowed</span>
      </label>

      {err && (
        <p className="text-xs text-rose-600">{err}</p>
      )}

      <div className="flex gap-2 pt-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2.5 rounded-full text-rose-600 hover:bg-rose-50 text-sm font-semibold"
          >
            Delete
          </button>
        )}
        <button type="submit" className="btn-primary flex-1">
          {initial ? 'Save changes' : 'Create sub user'}
        </button>
      </div>
    </form>
  )
}
