import { useState } from 'react'
import {
  UserPlus, User, Trash2, Eye, EyeOff, Pencil,
  Users, Lock, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useSubUsers } from '../api/subUsers.js'

const ACCESS_MENUS = [
  { key: 'customers', label: 'Customers' },
  { key: 'products',  label: 'Products & Services' },
  { key: 'partners',  label: 'Partners' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'assets',    label: 'Assets Management' },
  { key: 'subUsers',  label: 'Sub user Management' },
]

const accessSummary = (access = {}) => {
  const granted = ACCESS_MENUS.filter((m) => access?.[m.key]).map((m) => m.label)
  if (granted.length === 0) return 'No access'
  if (granted.length === ACCESS_MENUS.length) return 'Full access'
  return granted.join(' · ')
}

export default function MoreSubUsers() {
  const { items, loading, error, create, update, remove, refresh } = useSubUsers()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [opError, setOpError] = useState(null)

  const onSave = async (data) => {
    setBusy(true)
    setOpError(null)
    try {
      if (editing) {
        // Strip empty password from update so the server keeps the existing one.
        const patch = { ...data }
        if (!patch.password) delete patch.password
        await update(editing.id, patch)
      } else {
        await create(data)
      }
      setOpen(false)
      setEditing(null)
    } catch (err) {
      setOpError(err.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (u) => {
    if (!confirm(`Remove sub user "${u.username}"?`)) return
    setBusy(true)
    setOpError(null)
    try {
      await remove(u.id)
    } catch (err) {
      setOpError(err.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-center text-sm text-graphite py-10">Loading sub users…</p>
  }

  if (error) {
    return (
      <div className="card flex items-start gap-3 text-sm text-rose-700 bg-rose-50 border-rose-200">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Couldn't load sub users.</p>
          <p className="text-xs">{error.message || 'Unknown error'}</p>
          <button onClick={refresh} className="text-xs underline mt-1">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => { setEditing(null); setOpError(null); setOpen(true) }}
        className="btn-primary w-full"
      >
        <UserPlus className="w-4 h-4" /> Add sub user
      </button>

      {items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No sub users yet"
          description="Invite teammates by setting a username, password and which menus they can access."
        />
      ) : (
        <ul className="card divide-y divide-shadow p-0">
          {items.map((u) => (
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
                {u.name && (
                  <p className="text-[11px] text-graphite truncate">{u.name}</p>
                )}
                <p className="text-xs text-graphite truncate flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 shrink-0" /> {accessSummary(u.permissions)}
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() => { setEditing(u); setOpError(null); setOpen(true) }}
                className="p-2 rounded-full hover:bg-iron text-graphite transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                aria-label="Edit sub user"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                disabled={busy}
                onClick={() => onDelete(u)}
                className="p-2 rounded-full hover:bg-rose-50 text-rose-500 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                aria-label="Remove sub user"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {opError && !open && (
        <p className="text-xs text-rose-600 text-center">{opError}</p>
      )}

      <p className="text-[11px] text-graphite text-center">
        Sub users sign in with their username at the same login screen.
      </p>

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); setOpError(null) }}
        title={editing ? 'Edit sub user' : 'Add sub user'}
        size="lg"
      >
        <SubUserForm
          key={editing?.id || 'new'}
          initial={editing}
          submitting={busy}
          error={opError}
          onSubmit={onSave}
          onDelete={editing ? () => { onDelete(editing); setOpen(false); setEditing(null) } : null}
        />
      </Modal>
    </div>
  )
}

function SubUserForm({ initial, submitting, error, onSubmit, onDelete }) {
  const defaultPermissions = {
    customers: true,
    products: true,
    partners: true,
    marketing: true,
    assets: false,
    subUsers: false,
  }
  const [username, setUsername] = useState(initial?.username || '')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [name, setName] = useState(initial?.name || '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [permissions, setPermissions] = useState({
    ...defaultPermissions,
    ...(initial?.permissions || {}),
  })
  const [err, setErr] = useState('')

  const togglePermission = (k) => setPermissions((a) => ({ ...a, [k]: !a[k] }))

  const handleSelectAll = () => {
    const allOn = ACCESS_MENUS.every((m) => permissions[m.key])
    setPermissions(
      ACCESS_MENUS.reduce((acc, m) => ({ ...acc, [m.key]: !allOn }), {}),
    )
  }

  const submit = (e) => {
    e.preventDefault()
    if (!username.trim()) return setErr('Username is required.')
    if (!initial && !password.trim()) return setErr('Password is required.')
    if (password && password.length < 4) return setErr('Password must be at least 4 characters.')
    setErr('')
    const payload = {
      username: username.trim(),
      name: name.trim() || null,
      active,
      permissions,
    }
    if (password) payload.password = password
    onSubmit(payload)
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
        <label className="label">Display name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Optional — shown on profile"
        />
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
            {ACCESS_MENUS.every((m) => permissions[m.key]) ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div className="card !p-0 divide-y divide-shadow">
          {ACCESS_MENUS.map((m) => {
            const on = !!permissions[m.key]
            return (
              <label
                key={m.key}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-iron"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => togglePermission(m.key)}
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

      {(err || error) && (
        <p className="text-xs text-rose-600">{err || error}</p>
      )}

      <div className="flex gap-2 pt-2">
        {onDelete && (
          <button
            type="button"
            disabled={submitting}
            onClick={onDelete}
            className="px-4 py-2.5 rounded-full text-rose-600 hover:bg-rose-50 text-sm font-semibold disabled:opacity-50"
          >
            Delete
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary flex-1 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Create sub user'}
        </button>
      </div>
    </form>
  )
}
