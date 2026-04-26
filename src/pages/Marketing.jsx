import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Megaphone, Calendar, Package, ListChecks } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import DateFilterButton from '../components/DateFilterButton.jsx'

const campaignInRange = (c, range) => {
  if (!range) return true
  const startMs = range.start.getTime()
  const endMs = range.end.getTime()
  const cStart = c.startDate ? new Date(c.startDate).getTime() : null
  const cEnd = c.endDate ? new Date(c.endDate).getTime() : null
  // Match if any post falls in range, even when campaign dates are missing.
  const postHit = (c.todos || []).some((t) => {
    if (!t.postDate) return false
    const ms = new Date(t.postDate).getTime()
    return !isNaN(ms) && ms >= startMs && ms <= endMs
  })
  if (postHit) return true
  if (cStart == null && cEnd == null) return false
  // Overlap test: campaign window [cStart..cEnd] intersects [startMs..endMs]
  const lo = cStart ?? Number.NEGATIVE_INFINITY
  const hi = cEnd ?? Number.POSITIVE_INFINITY
  return hi >= startMs && lo <= endMs
}

const CAMPAIGN_STATUS = ['Planning', 'Active', 'Paused', 'Completed']

const statusStyle = (s) =>
  s === 'Active'    ? 'bg-emerald-100 text-emerald-700'
  : s === 'Planning'  ? 'bg-iron text-graphite'
  : s === 'Paused'    ? 'bg-amber-100 text-amber-700'
  : s === 'Completed' ? 'bg-brand-100 text-brand-700'
  : 'bg-iron text-graphite'

const formatDateRange = (start, end) => {
  const fmt = (d) =>
    d ? new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''
  if (!start && !end) return '—'
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  return start ? `From ${fmt(start)}` : `Until ${fmt(end)}`
}

export default function Marketing() {
  const { state, addCampaign } = useStore()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [dateRange, setDateRange] = useState(null)

  const campaigns = state.campaigns || []
  const filtered = useMemo(
    () =>
      campaigns
        .filter((c) =>
          [c.name, c.description].join(' ').toLowerCase().includes(q.toLowerCase()),
        )
        .filter((c) => campaignInRange(c, dateRange)),
    [campaigns, q, dateRange],
  )

  return (
    <>

      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search campaigns"
              className="input pl-9"
            />
          </div>
          <DateFilterButton
            value={dateRange}
            onChange={setDateRange}
            storageKey="ohmycmo:filter:marketing"
          />
        </div>

        {campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Plan content sprints around any product or service. Schedule posts, track key features, attach artwork."
            action={
              <button onClick={() => setOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> New campaign
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-graphite py-6">No matches.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => {
              const product = state.products.find((p) => p.id === c.productId)
              return (
                <li key={c.id}>
                  <Link to={`/marketing/${c.id}`} className="card flex flex-col gap-2 active:scale-[0.99]">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                        <Megaphone className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{c.name}</p>
                          <span className={`pill shrink-0 ${statusStyle(c.status)}`}>
                            {c.status}
                          </span>
                        </div>
                        {c.description && (
                          <p className="text-xs text-graphite line-clamp-2 mt-0.5">
                            {c.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-graphite pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDateRange(c.startDate, c.endDate)}
                      </span>
                      {product && (
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" /> {product.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <ListChecks className="w-3 h-3" />
                        {(c.todos?.length || 0)} post{(c.todos?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <NewCampaignModal
        open={open}
        onClose={() => setOpen(false)}
        products={state.products}
        onSubmit={(data) => {
          addCampaign(data)
          setOpen(false)
        }}
      />

      <button
        onClick={() => setOpen(true)}
        className="btn-primary fixed z-40 right-4 md:right-8 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-8 shadow-xl"
        aria-label="New campaign"
      >
        <Plus className="w-5 h-5" /> New
      </button>
    </>
  )
}

function NewCampaignModal({ open, onClose, products, onSubmit }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    productId: products[0]?.id || '',
    startDate: '',
    endDate: '',
    status: 'Planning',
  })
  const change = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit(form)
    setForm({
      name: '',
      description: '',
      productId: products[0]?.id || '',
      startDate: '',
      endDate: '',
      status: 'Planning',
    })
  }
  return (
    <Modal open={open} onClose={onClose} title="New campaign">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Campaign name *</label>
          <input
            className="input"
            autoFocus
            value={form.name}
            onChange={change('name')}
            placeholder="WeBill365 — Q2 launch"
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[80px]"
            value={form.description}
            onChange={change('description')}
            placeholder="What's the goal of this campaign?"
          />
        </div>
        <div>
          <label className="label">Product / Service</label>
          <select className="input" value={form.productId} onChange={change('productId')}>
            <option value="">— None —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.type})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start date</label>
            <input
              className="input"
              type="date"
              value={form.startDate}
              onChange={change('startDate')}
            />
          </div>
          <div>
            <label className="label">End date</label>
            <input
              className="input"
              type="date"
              value={form.endDate}
              onChange={change('endDate')}
            />
          </div>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={change('status')}>
            {CAMPAIGN_STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary w-full mt-2">Save campaign</button>
      </form>
    </Modal>
  )
}

export { CAMPAIGN_STATUS, statusStyle, formatDateRange }
