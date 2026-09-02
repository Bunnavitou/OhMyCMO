import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, ShieldCheck, AlertTriangle, Trash2 } from 'lucide-react'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import DateFilterButton from '../components/DateFilterButton.jsx'
import { usePmos } from '../api/pmo.js'
import { useStore } from '../store/StoreContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import AuthImage from '../components/AuthImage.jsx'
import { hasImage } from '../utils/imageRef.js'

const pmoInRange = (u, range) => {
  if (!range) return true
  if (!u.createdAt) return false
  const t = new Date(u.createdAt).getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}

export default function Pmo() {
  const { items: pmos, loading, error, update, refresh } = usePmos()
  const { state, updateProduct } = useStore()
  const { user } = useAuth()
  const canManage = hasPermission(user, 'pmo.manage')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [opError, setOpError] = useState(null)
  const [q, setQ] = useState('')
  const [dateRange, setDateRange] = useState(null)

  // Sourced from /pmo's own `products` summary (open to every tenant member),
  // not `state.products` (gated by the 'products'/Billing permission) — so
  // this card shows up correctly even for a viewer without that permission.
  const productsFor = (pmoId) => pmos.find((p) => p.id === pmoId)?.products || []

  // Candidates for promotion come from the tenant roster (open to everyone),
  // not the PMO-only /pmo list — excluding the owner (already full-access)
  // and anyone already a PMO.
  const candidates = (state.team || []).filter(
    (m) => m.role !== 'ADMIN' && !pmos.some((p) => p.id === m.id),
  )

  const filtered = useMemo(
    () =>
      pmos
        .filter((u) => {
          const products = productsFor(u.id).map((p) => p.name).join(' ')
          return [u.name, u.username, products].join(' ').toLowerCase().includes(q.toLowerCase())
        })
        .filter((u) => pmoInRange(u, dateRange)),
    // productsFor is derived straight from `pmos`, already a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pmos, q, dateRange],
  )

  const demotePmo = async (u) => {
    if (!confirm(`Remove "${u.name || u.username}" from PM management? Their account stays — they just won't be a PM anymore.`)) return
    setOpError(null)
    try {
      await update(u.id, { isPmo: false })
    } catch (err) {
      setOpError(err.message || 'Failed to remove PM')
    }
  }

  const createPmo = async (userId, productIds) => {
    setOpError(null)
    try {
      await update(userId, { isPmo: true })
      await Promise.all(productIds.map((id) => updateProduct(id, { pmoOwnerId: userId })))
      // /pmo's `products` summary needs a refetch after assigning products —
      // it isn't derived from `state.products` (see productsFor above).
      await refresh()
      setPickerOpen(false)
    } catch (err) {
      setOpError(err.message || 'Failed to add PM')
    }
  }

  if (loading) {
    return <p className="text-center text-sm text-graphite py-10">Loading PMs…</p>
  }

  if (error) {
    return (
      <div className="card flex items-start gap-3 text-sm text-rose-700 bg-rose-50 border-rose-200">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Couldn't load PMs.</p>
          <p className="text-xs">{error.message || 'Unknown error'}</p>
          <button onClick={refresh} className="text-xs underline mt-1">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search PM, product"
            className="input pl-9"
          />
        </div>
        <DateFilterButton
          value={dateRange}
          onChange={setDateRange}
          storageKey="ohmycmo:filter:pmo"
        />
      </div>

      {pmos.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No PMs yet"
          description="Promote an existing sub user to PM, then assign them the Products & Services they'll manage."
          action={
            canManage ? (
              <button onClick={() => { setOpError(null); setPickerOpen(true) }} className="btn-primary">
                <Plus className="w-4 h-4" /> Add PM
              </button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-graphite py-6">No PMs match your search.</p>
      ) : (
        <ul className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          {filtered.map((u) => {
            const products = productsFor(u.id)
            return (
              <li key={u.id} className="relative">
                <Link to={`/pmo/${u.id}`} className="card flex gap-3 active:scale-[0.99]">
                  {hasImage(u.avatar) ? (
                    <AuthImage
                      value={u.avatar}
                      alt={u.name || u.username}
                      className="w-11 h-11 rounded-xl object-cover border border-shadow bg-iron shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-mint-bg text-wise-dark flex items-center justify-center font-bold shrink-0">
                      {(u.name || u.username || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="font-semibold truncate">{u.name || u.username}</p>
                    {products.length === 0 ? (
                      <p className="text-xs text-graphite mt-0.5">No products or services yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {products.map((p) => (
                          <span key={p.id} className="pill bg-iron text-graphite text-[11px]">{p.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => demotePmo(u)}
                    className="absolute top-4 right-4 p-1.5 rounded-full text-rose-500 hover:bg-rose-50"
                    aria-label={`Remove ${u.name || u.username} from PM`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {opError && (
        <p className="text-xs text-rose-600 text-center">{opError}</p>
      )}

      {canManage && (
        <>
          <p className="text-[11px] text-graphite text-center">
            PMs are picked from your existing sub users — removing one doesn't delete their account.
          </p>

          <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Add a PM" size="lg">
            <PmoCreateForm
              key={pickerOpen}
              candidates={candidates}
              products={state.products}
              onCreate={createPmo}
            />
          </Modal>

          <button
            onClick={() => { setOpError(null); setPickerOpen(true) }}
            className="btn-primary fixed z-40 right-4 md:right-8 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-8 shadow-xl"
            aria-label="Add PM"
          >
            <Plus className="w-5 h-5" /> New
          </button>
        </>
      )}
    </div>
  )
}

function PmoCreateForm({ candidates, products, onCreate }) {
  const [q, setQ] = useState('')
  const [userId, setUserId] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [submitting, setSubmitting] = useState(false)

  const available = candidates.filter((u) =>
    (u.name || u.username || '').toLowerCase().includes(q.toLowerCase()),
  )
  const toggleProduct = (id) => setSelected((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const submit = async () => {
    if (!userId) return
    setSubmitting(true)
    try {
      await onCreate(userId, [...selected])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-graphite mb-2">Sub user</h3>
        <input
          className="input"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sub users"
        />
        {candidates.length === 0 ? (
          <p className="text-center text-sm text-graphite py-4">
            No eligible sub users — everyone is already a PM, or no sub users exist yet.
          </p>
        ) : available.length === 0 ? (
          <p className="text-center text-sm text-graphite py-4">No sub users match your search.</p>
        ) : (
          <ul className="divide-y divide-shadow max-h-52 overflow-y-auto -mx-1 mt-2">
            {available.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setUserId(u.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                    userId === u.id ? 'bg-mint-bg' : 'hover:bg-iron active:bg-iron'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-iron text-graphite flex items-center justify-center text-xs font-bold shrink-0">
                    {(u.name || u.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium truncate flex-1">{u.name || u.username}</span>
                  {userId === u.id && (
                    <span className="text-wise-dark text-[11px] font-bold uppercase shrink-0">Selected</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-graphite mb-2">
          Products &amp; Services (optional)
        </h3>
        {products.length === 0 ? (
          <p className="text-center text-sm text-graphite py-4">No products or services yet.</p>
        ) : (
          <ul className="divide-y divide-shadow max-h-72 overflow-y-auto -mx-1">
            {products.map((p) => (
              <li key={p.id}>
                <label className="w-full flex items-center gap-3 p-3 cursor-pointer hover:bg-iron rounded-xl">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleProduct(p.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    {p.pmoOwnerId && (
                      <p className="text-[11px] text-amber-600">
                        Currently: {p.pmoOwner?.name || p.pmoOwner?.username || 'another PM'}
                      </p>
                    )}
                  </div>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        disabled={!userId || submitting}
        onClick={submit}
        className="btn-primary w-full disabled:opacity-50"
      >
        Add PM
      </button>
    </div>
  )
}
