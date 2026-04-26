import { useState } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import {
  Plus, TrendingUp, TrendingDown, Package, User, Trash2, Link2Off, Receipt,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import { InvoiceForm, MonthlyIncomeList, InvoiceDetail } from '../components/Invoice.jsx'

const sections = ['Income', 'Expenses']

export default function CustomerProductDetail() {
  const { id, linkId } = useParams()
  const {
    state,
    addCustomerProductIncome,
    removeCustomerProductIncome,
    addCustomerProductExpense,
    removeCustomerProductExpense,
    removeCustomerProductLink,
  } = useStore()

  const customer = state.customers.find((c) => c.id === id)
  const link = customer?.productLinks?.find((l) => l.id === linkId)
  const product = link ? state.products.find((p) => p.id === link.productId) : null

  const [section, setSection] = useState('Income')
  const [openModal, setOpenModal] = useState(null)
  const [viewingInvoice, setViewingInvoice] = useState(null)

  if (!customer) return <Navigate to="/customers" replace />
  if (!link || !product) return <Navigate to={`/customers/${id}`} replace />

  const incomeEntries = product.income.filter((i) => i.customerId === customer.id)
  const expenseEntries = product.expenses.filter((e) => e.customerId === customer.id)
  const incomeTotal = incomeEntries.reduce((s, i) => s + Number(i.amount || 0), 0)
  const expenseTotal = expenseEntries.reduce((s, e) => s + Number(e.amount || 0), 0)
  const net = incomeTotal - expenseTotal

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={
          <span className="inline-flex items-center gap-1">
            <User className="w-3 h-3" /> {customer.name}
          </span>
        }
        back
        action={
          <button
            onClick={() => {
              if (confirm('Unlink this product from this customer?')) {
                removeCustomerProductLink(customer.id, link.id)
                history.back()
              }
            }}
            className="p-2 rounded-full hover:bg-rose-50 text-rose-500"
            aria-label="Unlink"
          >
            <Link2Off className="w-4 h-4" />
          </button>
        }
      />

      <div className="space-y-4">
        <Link to={`/products/${product.id}`} className="card flex items-center gap-3 active:scale-[0.99]">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Open product workspace</p>
            <p className="text-xs text-steel">
              {product.type} · List ${Number(product.price || 0).toLocaleString()}
            </p>
          </div>
        </Link>

        <section className="grid grid-cols-3 gap-2">
          <div className="card !p-3">
            <div className="text-xs text-steel flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Income
            </div>
            <p className="text-lg font-bold text-emerald-700 mt-1">${incomeTotal.toLocaleString()}</p>
          </div>
          <div className="card !p-3">
            <div className="text-xs text-steel flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Expense
            </div>
            <p className="text-lg font-bold text-rose-700 mt-1">${expenseTotal.toLocaleString()}</p>
          </div>
          <div className="card !p-3">
            <div className="text-xs text-steel">Net</div>
            <p className={`text-lg font-bold mt-1 ${net >= 0 ? 'text-brand-700' : 'text-amber-700'}`}>
              ${net.toLocaleString()}
            </p>
          </div>
        </section>

        <div className="flex bg-iron border border-shadow">
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`flex-1 text-xs md:text-sm py-2 font-bold uppercase tracking-wider transition-colors ${
                section === s ? 'bg-charcoal text-brand-500 border-b-2 border-brand-500' : 'text-steel'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {section === 'Income' && (
          <div className="space-y-3">
            <button onClick={() => setOpenModal('income')} className="btn-primary w-full">
              <Receipt className="w-4 h-4" /> New invoice
            </button>
            <MonthlyIncomeList items={incomeEntries} onTap={(x) => setViewingInvoice(x)} />
          </div>
        )}
        {section === 'Expenses' && (
          <Lines
            items={expenseEntries}
            onAdd={() => setOpenModal('expense')}
            onDelete={(entryId) => {
              if (confirm('Delete this expense entry?')) {
                removeCustomerProductExpense(customer.id, product.id, entryId)
              }
            }}
          />
        )}
      </div>

      <Modal open={openModal === 'income'} onClose={() => setOpenModal(null)} title="New invoice">
        <InvoiceForm
          defaultCustomer={{ customerName: customer.name }}
          lockCustomer
          onSubmit={(d) => {
            addCustomerProductIncome(customer.id, product.id, d)
            setOpenModal(null)
          }}
        />
      </Modal>
      <Modal open={openModal === 'expense'} onClose={() => setOpenModal(null)} title="Record expense">
        <ExpenseForm
          onSubmit={(d) => {
            addCustomerProductExpense(customer.id, product.id, d)
            setOpenModal(null)
          }}
        />
      </Modal>
      <Modal
        open={!!viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        title={
          viewingInvoice && Array.isArray(viewingInvoice.items) && viewingInvoice.items.length > 0
            ? 'Invoice'
            : 'Income entry'
        }
      >
        <InvoiceDetail
          invoice={viewingInvoice}
          onDelete={() => {
            if (viewingInvoice && confirm('Delete this entry?')) {
              removeCustomerProductIncome(customer.id, product.id, viewingInvoice.id)
              setViewingInvoice(null)
            }
          }}
        />
      </Modal>
    </>
  )
}

function Lines({ items, onAdd, onDelete }) {
  const sorted = [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return (
    <div className="space-y-3">
      <button onClick={onAdd} className="btn-primary w-full">
        <Plus className="w-4 h-4" /> Add expense
      </button>
      {sorted.length === 0 ? (
        <p className="text-center text-sm text-steel py-6">Nothing recorded yet.</p>
      ) : (
        <ul className="card divide-y divide-shadow p-0">
          {sorted.map((x) => (
            <li key={x.id} className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-rose-50 text-rose-600">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{x.note || x.category}</p>
                <p className="text-xs text-steel">
                  {x.date}{x.category ? ` · ${x.category}` : ''}
                </p>
              </div>
              <p className="font-semibold text-sm text-rose-700">
                -${Number(x.amount || 0).toLocaleString()}
              </p>
              <button
                onClick={() => onDelete(x.id)}
                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ExpenseForm({ onSubmit }) {
  const [form, setForm] = useState({
    amount: '',
    category: 'Ads',
    date: new Date().toISOString().slice(0, 10),
    note: '',
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!form.amount) return
        onSubmit({ ...form, amount: Number(form.amount) })
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount (USD) *</label>
          <input
            className="input"
            type="number"
            autoFocus
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="320"
          />
        </div>
        <div>
          <label className="label">Date</label>
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="label">Category</label>
        <select
          className="input"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {['Ads', 'Tools', 'Production', 'Events', 'Content', 'Other'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Note</label>
        <input
          className="input"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </div>
      <button className="btn-primary w-full">Save expense</button>
    </form>
  )
}
