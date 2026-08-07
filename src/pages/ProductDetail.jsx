import { useState } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { Plus, TrendingUp, TrendingDown, Receipt, Trash2, Pencil, Search, Camera, Package } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import { InvoiceForm, MonthlyIncomeList, InvoiceDetail } from '../components/Invoice.jsx'
import AuthImage from '../components/AuthImage.jsx'
import { uploadImageRef, hasImage } from '../utils/imageRef.js'
import { validRecipients } from '../utils/email.js'
import { useT } from '../i18n/LanguageContext.jsx'

const LOGO_LIMIT_BYTES = 2 * 1024 * 1024

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
  const {
    state,
    addProductChild,
    addProductChildren,
    updateProductChild,
    removeProductChild,
    updateProduct,
    removeProduct,
    updateCustomer,
    appendCustomerLog,
  } = useStore()
  const { user } = useAuth()
  const canDelete = hasPermission(user, 'billing.delete')
  const { t } = useT()
  const navigate = useNavigate()
  const product = state.products.find((p) => p.id === id)
  const [tab, setTab] = useState('Income')
  const [openModal, setOpenModal] = useState(null)
  const [viewingInvoice, setViewingInvoice] = useState(null)
  const [invoiceQuery, setInvoiceQuery] = useState('')
  const [invoiceDraft, setInvoiceDraft] = useState(null)

  if (!product) return <Navigate to="/products" replace />

  const income = product.income.reduce((s, i) => s + Number(i.amount || 0), 0)
  const expense = product.expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const net = income - expense

  const handleDelete = async () => {
    if (!confirm(t('product.delete.confirm'))) return
    await removeProduct(product.id)
    navigate('/products', { replace: true })
  }

  const handleEdit = async (patch) => {
    await updateProduct(product.id, patch)
    setOpenModal(null)
  }

  // Save the invoice's email settings back onto the customer as their billing
  // defaults, so the next invoice for that customer pre-fills with them. Only
  // valid pieces are written, and empty fields never wipe an existing default.
  // Build a fresh copy of an invoice for duplication: new date, blank invoice
  // number, fresh line-item ids, and no carried-over send history.
  const duplicateInvoiceData = (src) => {
    const copy = { ...src, date: new Date().toISOString().slice(0, 10), invoiceNo: '' }
    delete copy.id
    delete copy.sends
    copy.items = Array.isArray(src.items)
      ? src.items.map((it) => {
          const item = { ...it }
          delete item.id
          return item
        })
      : []
    return copy
  }

  const saveEmailDefaults = (d) => {
    if (!d?.customerId || !d.email) return
    const { to, cc, subject, body } = d.email
    const patch = {}
    // `to` is a recipient LIST, not a string — validRecipients normalizes both
    // shapes (array, or a legacy comma-separated string). `billingEmail` is a
    // single address both here and in the API validator, so only the first
    // recipient becomes the default; the rest live on the customer's Email tab,
    // which resolveEmailTemplate reads first anyway.
    const [primary] = validRecipients(to)
    if (primary) patch.billingEmail = primary
    const validCc = validRecipients(cc)
    if (validCc.length) patch.emailCc = validCc
    if ((subject || '').trim() || (body || '').trim()) {
      patch.emailTemplate = { subject: subject || '', body: body || '' }
    }
    if (Object.keys(patch).length) updateCustomer(d.customerId, patch)
  }

  return (
    <>
      <PageHeader
        subtitle={product.type}
        action={
          <>
            <button
              type="button"
              onClick={() => setOpenModal('edit')}
              className="p-2 rounded-full hover:bg-iron text-graphite"
              aria-label={t('common.edit')}
            >
              <Pencil className="w-4 h-4" />
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 rounded-full hover:bg-rose-50 text-rose-600"
                aria-label={t('common.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </>
        }
      />

      <div className="space-y-4">
        <section className="card !p-3 flex items-center gap-3">
          {hasImage(product.logo) ? (
            <AuthImage
              value={product.logo}
              alt={`${product.name} logo`}
              className="w-14 h-14 rounded-xl object-cover border border-shadow bg-iron shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold truncate text-near-black">{product.name}</p>
            <p className="text-xs text-graphite">{product.type}</p>
          </div>
        </section>

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
            <button
              onClick={() => {
                setInvoiceDraft(null)
                setOpenModal('income')
              }}
              className="btn-primary w-full"
            >
              <Receipt className="w-4 h-4" /> {t('product.newInvoice')}
            </button>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
              <input
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                placeholder={t('common.search')}
                className="input pl-9"
              />
            </div>
            <MonthlyIncomeList
              items={product.income}
              onTap={(x) => setViewingInvoice(x)}
              productName={product.name}
              query={invoiceQuery}
              onBulkDuplicate={(list) => {
                if (!list.length) return
                if (!confirm(`Duplicate ${list.length} invoice${list.length > 1 ? 's' : ''}?`)) return
                addProductChildren(product.id, 'income', list.map(duplicateInvoiceData))
              }}
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

      <Modal
        open={openModal === 'income'}
        onClose={() => {
          setOpenModal(null)
          setInvoiceDraft(null)
        }}
        title={t('product.newInvoice')}
        size="2xl"
      >
        <InvoiceForm
          initial={invoiceDraft || undefined}
          customers={state.customers}
          onSubmit={(d) => {
            addProductChild(product.id, 'income', d)
            saveEmailDefaults(d)
            setOpenModal(null)
            setInvoiceDraft(null)
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
        size="2xl"
        title={
          viewingInvoice && Array.isArray(viewingInvoice.items) && viewingInvoice.items.length > 0
            ? t('product.invoice')
            : t('product.incomeEntry')
        }
      >
        <InvoiceDetail
          invoice={viewingInvoice}
          customers={state.customers}
          onLogSend={(meta) => {
            if (!viewingInvoice?.customerId) return
            appendCustomerLog(viewingInvoice.customerId, {
              type: 'invoice.send',
              message: `Sent invoice ${meta.invoiceNo || ''} report to ${meta.to}`.replace(/\s+/g, ' ').trim(),
              meta,
            })
          }}
          onDelete={() => {
            if (viewingInvoice && confirm(t('product.deleteEntry'))) {
              removeProductChild(product.id, 'income', viewingInvoice.id)
              setViewingInvoice(null)
            }
          }}
          onUpdate={(patch) => {
            if (!viewingInvoice) return
            updateProductChild(product.id, 'income', viewingInvoice.id, patch)
            saveEmailDefaults({ ...viewingInvoice, ...patch })
            setViewingInvoice({ ...viewingInvoice, ...patch })
          }}
          onDuplicate={(src) => {
            setViewingInvoice(null)
            setInvoiceDraft(duplicateInvoiceData(src))
            setOpenModal('income')
          }}
        />
      </Modal>

      <Modal open={openModal === 'edit'} onClose={() => setOpenModal(null)} title={t('product.modal.edit')}>
        <EditProductForm product={product} onSubmit={handleEdit} />
      </Modal>
    </>
  )
}

function EditProductForm({ product, onSubmit }) {
  const { t } = useT()
  const [form, setForm] = useState({
    name: product.name || '',
    type: product.type || 'Product',
    price: product.price ?? 0,
    logo: product.logo || null,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [logoError, setLogoError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const onLogoFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > LOGO_LIMIT_BYTES) {
      setLogoError(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB — max 2 MB.`)
      return
    }
    setLogoError('')
    try {
      const logo = await uploadImageRef(f, {
        maxDim: 800, quality: 0.85, entityType: 'product', entityId: product.id,
      })
      set('logo', logo)
    } catch {
      setLogoError('Could not read that image — try a different file.')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required.')
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: form.name.trim(),
        type: form.type,
        price: Number(form.price) || 0,
        logo: form.logo,
      })
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">{t('product.field.logo')}</label>
        {hasImage(form.logo) ? (
          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-shadow bg-iron">
            <AuthImage
              value={form.logo}
              alt="Logo"
              className="w-14 h-14 object-cover rounded-md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{form.logo.name || 'logo'}</p>
            </div>
            <label className="p-1.5 text-graphite hover:bg-iron rounded cursor-pointer" aria-label="Replace">
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
            </label>
            <button
              type="button"
              onClick={() => set('logo', null)}
              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
              aria-label="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-graphite text-sm text-graphite cursor-pointer hover:bg-iron">
            <Camera className="w-4 h-4" /> {t('product.field.uploadLogo')}
            <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
          </label>
        )}
        {logoError && <p className="text-xs text-rose-600 mt-1">{logoError}</p>}
      </div>

      <div>
        <label className="label">{t('field.name')} *</label>
        <input
          className="input"
          autoFocus
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <div>
        <label className="label">{t('field.type')}</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'Product', tKey: 'product.type.product' },
            { value: 'Service', tKey: 'product.type.service' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('type', opt.value)}
              className={`px-3 py-2 rounded-full border text-sm font-semibold transition-colors ${
                form.type === opt.value
                  ? 'bg-mint-bg border-wise-green text-wise-dark'
                  : 'bg-white border-shadow text-graphite hover:bg-iron'
              }`}
            >
              {t(opt.tKey)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">{t('product.field.defaultPrice')}</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite text-sm">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input pl-7"
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full mt-2 disabled:opacity-60">
        {submitting ? t('common.saving') : t('product.save')}
      </button>
    </form>
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
