import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Plus, TrendingUp, TrendingDown, Receipt, Trash2 } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import { InvoiceForm, MonthlyIncomeList, InvoiceDetail } from '../components/Invoice.jsx'
import { useT } from '../i18n/LanguageContext.jsx'

const TABS = [
  { value: 'Income',   tKey: 'product.tab.income' },
  { value: 'Expenses', tKey: 'product.tab.expenses' },
]

const EXPENSE_CATEGORIES = [
  { value: 'Ads',        tKey: 'product.expense.cat.ads' },
  { value: 'Tools',      tKey: 'product.expense.cat.tools' },
  { value: 'Production', tKey: 'product.expense.cat.production' },
  { value: 'Events',     tKey: 'product.expense.cat.events' },
  { value: 'Content',    tKey: 'product.expense.cat.content' },
  { value: 'Other',      tKey: 'product.expense.cat.other' },
]

export default function ProductDetail() {
  const { id } = useParams()
  const { state, addProductChild, removeProductChild } = useStore()
  const { t } = useT()
  const product = state.products.find((p) => p.id === id)
  const [tab, setTab] = useState('Income')
  const [openModal, setOpenModal] = useState(null)
  const [viewingInvoice, setViewingInvoice] = useState(null)

  if (!product) return <Navigate to="/products" replace />

  const income = product.income.reduce((s, i) => s + Number(i.amount || 0), 0)
  const expense = product.expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const net = income - expense

  return (
    <>
      <PageHeader title={product.name} subtitle={product.type} back />

      <div className="space-y-4">
        <section className="grid grid-cols-3 gap-2">
          <div className="card !p-3">
            <div className="text-xs text-graphite flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {t('product.metric.income')}
            </div>
            <p className="text-lg font-bold text-emerald-700 mt-1">${income.toLocaleString()}</p>
          </div>
          <div className="card !p-3">
            <div className="text-xs text-graphite flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> {t('product.metric.expense')}
            </div>
            <p className="text-lg font-bold text-rose-700 mt-1">${expense.toLocaleString()}</p>
          </div>
          <div className="card !p-3">
            <div className="text-xs text-graphite">{t('product.metric.net')}</div>
            <p className={`text-lg font-bold mt-1 ${net >= 0 ? 'text-brand-700' : 'text-amber-700'}`}>
              ${net.toLocaleString()}
            </p>
          </div>
        </section>

        <div className="flex bg-iron border border-shadow">
          {TABS.map((tabDef) => (
            <button
              key={tabDef.value}
              onClick={() => setTab(tabDef.value)}
              className={`flex-1 text-xs md:text-sm py-2 font-bold uppercase tracking-wider transition-colors ${
                tab === tabDef.value ? 'bg-charcoal text-brand-500 border-b-2 border-brand-500' : 'text-graphite'
              }`}
            >
              {t(tabDef.tKey)}
            </button>
          ))}
        </div>

        {tab === 'Income' && (
          <div className="space-y-3">
            <button onClick={() => setOpenModal('income')} className="btn-primary w-full">
              <Receipt className="w-4 h-4" /> {t('product.newInvoice')}
            </button>
            <MonthlyIncomeList
              items={product.income}
              onTap={(x) => setViewingInvoice(x)}
              productName={product.name}
            />
          </div>
        )}
        {tab === 'Expenses' && (
          <ExpenseLines
            items={product.expenses}
            onAdd={() => setOpenModal('expense')}
            onDelete={(eid) => {
              if (confirm(t('product.deleteExpense'))) removeProductChild(product.id, 'expenses', eid)
            }}
          />
        )}
      </div>

      <Modal open={openModal === 'income'} onClose={() => setOpenModal(null)} title={t('product.newInvoice')}>
        <InvoiceForm
          onSubmit={(d) => {
            addProductChild(product.id, 'income', d)
            setOpenModal(null)
          }}
        />
      </Modal>
      <Modal open={openModal === 'expense'} onClose={() => setOpenModal(null)} title={t('product.addExpense')}>
        <ExpenseForm
          categories={EXPENSE_CATEGORIES}
          onSubmit={(d) => {
            addProductChild(product.id, 'expenses', d)
            setOpenModal(null)
          }}
        />
      </Modal>
      <Modal
        open={!!viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        title={
          viewingInvoice && Array.isArray(viewingInvoice.items) && viewingInvoice.items.length > 0
            ? t('product.invoice')
            : t('product.incomeEntry')
        }
      >
        <InvoiceDetail
          invoice={viewingInvoice}
          onDelete={() => {
            if (viewingInvoice && confirm(t('product.deleteEntry'))) {
              removeProductChild(product.id, 'income', viewingInvoice.id)
              setViewingInvoice(null)
            }
          }}
        />
      </Modal>
    </>
  )
}

function ExpenseLines({ items, onAdd, onDelete }) {
  const { t } = useT()
  const sorted = [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return (
    <div className="space-y-3">
      <button onClick={onAdd} className="btn-primary w-full">
        <Plus className="w-4 h-4" /> {t('product.addExpense')}
      </button>
      {sorted.length === 0 ? (
        <p className="text-center text-sm text-graphite py-6">{t('product.nothingRecorded')}</p>
      ) : (
        <ul className="card divide-y divide-shadow p-0">
          {sorted.map((x) => (
            <li key={x.id} className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-50 text-rose-600 shrink-0">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{x.note || x.category}</p>
                <p className="text-xs text-graphite">
                  {x.date}{x.category ? ` · ${x.category}` : ''}
                </p>
              </div>
              <p className="font-semibold text-sm text-rose-700">
                -${Number(x.amount || 0).toLocaleString()}
              </p>
              <button
                onClick={() => onDelete(x.id)}
                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                aria-label={t('common.delete')}
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

function ExpenseForm({ categories, onSubmit }) {
  const { t } = useT()
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
        if (form.amount) onSubmit({ ...form, amount: Number(form.amount) })
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('product.expense.amountUsd')} *</label>
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
          <label className="label">{t('field.date')}</label>
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="label">{t('field.category')}</label>
        <select
          className="input"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{t(c.tKey)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{t('field.note')}</label>
        <input
          className="input"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="LinkedIn promo"
        />
      </div>
      <button className="btn-primary w-full">{t('product.saveExpense')}</button>
    </form>
  )
}
