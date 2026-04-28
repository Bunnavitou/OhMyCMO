import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Users, Building2 } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import DateFilterButton from '../components/DateFilterButton.jsx'

const customerInRange = (c, range) => {
  if (!range) return true
  const startMs = range.start.getTime()
  const endMs = range.end.getTime()
  return (c.logs || []).some((l) => {
    if (!l.ts) return false
    const t = new Date(l.ts).getTime()
    return t >= startMs && t <= endMs
  })
}

const stages = ['Prospect', 'Active', 'On hold', 'Churned']

export default function Customers() {
  const { state, addCustomer } = useStore()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [dateRange, setDateRange] = useState(null)

  const filtered = useMemo(
    () =>
      state.customers
        .filter((c) =>
          [c.name, c.industry, c.contact].join(' ').toLowerCase().includes(q.toLowerCase()),
        )
        .filter((c) => customerInRange(c, dateRange)),
    [state.customers, q, dateRange],
  )

  return (
    <>
      <PageHeader title="Customers" />
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customer, industry, contact"
              className="input pl-9"
            />
          </div>
          <DateFilterButton
            value={dateRange}
            onChange={setDateRange}
            storageKey="ohmycmo:filter:customers"
          />
        </div>

        {state.customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add your first customer to start tracking tasks, activities and agreements."
            action={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add customer</button>}
          />
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-graphite py-6">
            No customers match your filters.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => {
              const openTasks = c.tasks.filter((t) => t.status !== 'Done').length
              return (
                <li key={c.id}>
                  <Link to={`/customers/${c.id}`} className="card flex gap-3 active:scale-[0.99]">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{c.name}</p>
                        <span className={`pill ${
                          c.stage === 'Active' ? 'bg-emerald-100 text-emerald-700'
                          : c.stage === 'Prospect' ? 'bg-amber-100 text-amber-700'
                          : 'bg-iron text-graphite'
                        }`}>{c.stage}</span>
                      </div>
                      <p className="text-xs text-graphite flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" /> {c.industry || '—'}
                      </p>
                      <div className="flex gap-3 mt-2 text-xs text-graphite">
                        <span>{openTasks} open task{openTasks !== 1 ? 's' : ''}</span>
                        <span>{(c.files?.length || 0)} files</span>
                        <span>{(c.logs?.length || 0)} events</span>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <NewCustomerModal open={open} onClose={() => setOpen(false)} onSubmit={(data) => { addCustomer(data); setOpen(false) }} />

      <button
        onClick={() => setOpen(true)}
        className="btn-primary fixed z-40 right-4 md:right-8 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-8 shadow-xl"
        aria-label="New customer"
      >
        <Plus className="w-5 h-5" /> New
      </button>
    </>
  )
}

const EMPTY_CUSTOMER = {
  name: '',
  industry: '',
  contact: '',
  email: '',
  phone: '',
  address: '',
  vatTin: '',
  stage: 'Prospect',
}

function NewCustomerModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_CUSTOMER)
  const change = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit(form)
    setForm(EMPTY_CUSTOMER)
  }
  return (
    <Modal open={open} onClose={onClose} title="New customer">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Company name *</label>
          <input className="input" value={form.name} onChange={change('name')} placeholder="Acme Holdings" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Industry</label>
            <input className="input" value={form.industry} onChange={change('industry')} placeholder="FMCG" />
          </div>
          <div>
            <label className="label">Stage</label>
            <select className="input" value={form.stage} onChange={change('stage')}>
              {stages.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={change('email')} placeholder="sara@acme.co" />
          </div>
          <div>
            <label className="label">Tel</label>
            <input className="input" value={form.phone} onChange={change('phone')} placeholder="+855..." />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <textarea
            className="input min-h-[60px]"
            value={form.address}
            onChange={change('address')}
            placeholder="Building, street, city"
          />
        </div>
        <div>
          <label className="label">VAT TIN</label>
          <input className="input" value={form.vatTin} onChange={change('vatTin')} placeholder="K001-..." />
        </div>
        <button type="submit" className="btn-primary w-full mt-2">Save customer</button>
      </form>
    </Modal>
  )
}
