import { useState } from 'react'
import { useParams, Navigate, Link as RouterLink } from 'react-router-dom'
import {
  Plus, Trash2, Package, Link2Off, ChevronRight,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from '../components/Modal.jsx'

import CustomerDetailOrg from './CustomerDetailOrg.jsx'
import CustomerDetailTask from './CustomerDetailTask.jsx'
import CustomerDetailFile from './CustomerDetailFile.jsx'
import CustomerDetailLog from './CustomerDetailLog.jsx'

const tabs = ['Tasks', 'Products', 'Files', 'Audit Log']

export default function CustomerDetail() {
  const { id } = useParams()
  const {
    state,
    addCustomerProductLink,
    removeCustomerProductLink,
  } = useStore()
  const customer = state.customers.find((c) => c.id === id)
  const [tab, setTab] = useState('Tasks')
  const [pickerOpen, setPickerOpen] = useState(false)

  if (!customer) return <Navigate to="/customers" replace />

  return (
    <>
      <div className="space-y-4">
        <CustomerDetailOrg customer={customer} />

        <div className="flex bg-iron border border-shadow">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-xs md:text-sm py-2 font-bold uppercase tracking-wider transition-colors ${
                tab === t ? 'bg-charcoal text-brand-500 border-b-2 border-brand-500' : 'text-graphite'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Tasks' && <CustomerDetailTask customer={customer} />}
        {tab === 'Products' && (
          <PanelProducts
            customer={customer}
            products={state.products}
            onLink={() => setPickerOpen(true)}
            onUnlink={(linkId) => {
              if (confirm('Remove this product record? The activity thread will be deleted.')) {
                removeCustomerProductLink(customer.id, linkId)
              }
            }}
          />
        )}
        {tab === 'Files' && <CustomerDetailFile customer={customer} />}
        {tab === 'Audit Log' && <CustomerDetailLog logs={customer.logs || []} />}
      </div>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose a product to record"
      >
        <ProductPicker
          products={state.products}
          onPick={(productId) => {
            addCustomerProductLink(customer.id, productId)
            setPickerOpen(false)
          }}
        />
      </Modal>
    </>
  )
}

const formatStartDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function PanelProducts({ customer, products, onLink, onUnlink }) {
  const linked = [...(customer.productLinks || [])].sort(
    (a, b) => (b.linkedAt || '').localeCompare(a.linkedAt || ''),
  )
  return (
    <div className="space-y-3">
      <button onClick={onLink} className="btn-primary w-full">
        <Plus className="w-4 h-4" /> Choose product to record
      </button>
      <p className="text-[11px] text-graphite px-1">
        The same product can be picked more than once — each pick opens its own activity thread.
      </p>
      {linked.length === 0 ? (
        <p className="text-center text-sm text-graphite py-6">
          No product history yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {linked.map((link) => {
            const product = products.find((p) => p.id === link.productId)
            if (!product) {
              return (
                <li key={link.id} className="card flex items-center justify-between">
                  <span className="text-sm text-graphite">Missing product</span>
                  <button
                    onClick={() => onUnlink(link.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              )
            }
            const activityCount = (link.activities || []).length
            const startedOn = formatStartDate(link.linkedAt)
            return (
              <li key={link.id} className="card !p-0 overflow-hidden">
                <RouterLink
                  to={`/customers/${customer.id}/products/${link.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-iron transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-mint-bg text-wise-dark flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate text-near-black">{product.name}</p>
                      <span className="pill bg-iron text-graphite">{product.type}</span>
                    </div>
                    <p className="text-[11px] text-graphite mt-0.5">
                      {startedOn ? `Started ${startedOn}` : 'New'}
                      {' · '}
                      {activityCount} activit{activityCount === 1 ? 'y' : 'ies'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-graphite" />
                </RouterLink>
                <button
                  onClick={() => onUnlink(link.id)}
                  className="w-full text-xs text-rose-600 py-2 border-t border-shadow hover:bg-rose-50 flex items-center justify-center gap-1"
                >
                  <Link2Off className="w-3 h-3" /> Remove this record
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ProductPicker({ products, onPick }) {
  const [q, setQ] = useState('')
  const available = products.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <div className="space-y-3">
      <input
        className="input"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products"
      />
      <p className="text-[11px] text-graphite px-1">
        You can pick the same product more than once — each pick opens its own
        activity thread.
      </p>
      {products.length === 0 ? (
        <p className="text-center text-sm text-graphite py-4">
          No products yet. Add one in the Products workspace first.
        </p>
      ) : available.length === 0 ? (
        <p className="text-center text-sm text-graphite py-4">No matching products.</p>
      ) : (
        <ul className="divide-y divide-shadow max-h-72 overflow-y-auto -mx-1">
          {available.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onPick(p.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-iron active:bg-iron text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-[11px] text-graphite">{p.type}</p>
                </div>
                <Plus className="w-4 h-4 text-brand-600" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
