import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Mail, Phone, MapPin, Hash, Building2, Pencil, Trash2, Users, ChevronRight } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from '../components/Modal.jsx'

const stages = ['Prospect', 'Active', 'On hold', 'Churned']

export default function CustomerDetailOrg({ customer }) {
  const { updateCustomer, removeCustomer } = useStore()
  const [editing, setEditing] = useState(false)

  const onDelete = () => {
    if (confirm(`Delete ${customer.name}? This cannot be undone.`)) {
      removeCustomer(customer.id)
      history.back()
    }
  }

  return (
    <>
      <section className="card space-y-3">
        <div className="flex flex-col gap-1.5 text-sm text-graphite">
          <div className="flex items-center justify-between gap-2">
            {customer.industry ? (
              <p className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-graphite shrink-0" />
                <span className="truncate">{customer.industry}</span>
              </p>
            ) : (
              <p className="flex items-center gap-2 text-graphite min-w-0">
                <Building2 className="w-4 h-4 shrink-0" /> Add industry
              </p>
            )}
            <div className="flex items-center gap-1 shrink-0 -my-1.5 -mr-1">
              <button
                onClick={() => setEditing(true)}
                className="p-2 rounded-full hover:bg-iron text-graphite transition-transform hover:scale-105 active:scale-95"
                aria-label="Edit customer"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 rounded-full hover:bg-rose-50 text-rose-500 transition-transform hover:scale-105 active:scale-95"
                aria-label="Delete customer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          {customer.email ? (
            <a href={`mailto:${customer.email}`} className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-graphite shrink-0" />
              <span className="truncate">{customer.email}</span>
            </a>
          ) : (
            <p className="flex items-center gap-2 text-graphite">
              <Mail className="w-4 h-4 shrink-0" /> Add email
            </p>
          )}
          {customer.phone ? (
            <a href={`tel:${customer.phone}`} className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-graphite shrink-0" />
              <span className="truncate">{customer.phone}</span>
            </a>
          ) : (
            <p className="flex items-center gap-2 text-graphite">
              <Phone className="w-4 h-4 shrink-0" /> Add tel
            </p>
          )}
          {customer.address ? (
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-graphite shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{customer.address}</span>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-graphite">
              <MapPin className="w-4 h-4 shrink-0" /> Add address
            </p>
          )}
          {customer.vatTin ? (
            <p className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-graphite shrink-0" />
              <span className="truncate">VAT TIN: {customer.vatTin}</span>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-graphite">
              <Hash className="w-4 h-4 shrink-0" /> Add VAT TIN
            </p>
          )}
        </div>

        <RouterLink
          to={`/customers/${customer.id}/staff`}
          className="flex items-center gap-3 -mx-1 px-3 py-2.5 rounded-xl bg-iron hover:bg-iron active:bg-shadow"
        >
          <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Total staff</p>
            <p className="text-xs text-graphite">View company structure</p>
          </div>
          <span className="text-lg font-bold text-near-black">
            {customer.staff?.length || 0}
          </span>
          <ChevronRight className="w-4 h-4 text-graphite" />
        </RouterLink>
      </section>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit customer">
        <CustomerForm
          key={`edit-${customer.id}`}
          initial={customer}
          onSubmit={(patch) => {
            updateCustomer(customer.id, patch)
            setEditing(false)
          }}
        />
      </Modal>
    </>
  )
}

function CustomerForm({ initial, onSubmit }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    industry: initial?.industry || '',
    contact: initial?.contact || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    address: initial?.address || '',
    vatTin: initial?.vatTin || '',
    stage: initial?.stage || 'Prospect',
  })
  const change = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (form.name.trim()) onSubmit(form)
      }}
      className="space-y-3"
    >
      <div>
        <label className="label">Company name *</label>
        <input
          className="input"
          autoFocus
          value={form.name}
          onChange={change('name')}
          placeholder="Acme Holdings"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Industry</label>
          <input className="input" value={form.industry} onChange={change('industry')} />
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
          <input className="input" type="email" value={form.email} onChange={change('email')} />
        </div>
        <div>
          <label className="label">Tel</label>
          <input className="input" value={form.phone} onChange={change('phone')} />
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
        <input
          className="input"
          value={form.vatTin}
          onChange={change('vatTin')}
          placeholder="K001-..."
        />
      </div>
      <button className="btn-primary w-full mt-2">Save changes</button>
    </form>
  )
}
