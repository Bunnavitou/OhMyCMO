import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, Package, TrendingUp, TrendingDown, Plus, Receipt, Layers,
  Camera, Trash2,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import AuthImage from '../components/AuthImage.jsx'
import DateFilterButton from '../components/DateFilterButton.jsx'
import { persistImageRef, hasImage } from '../utils/imageRef.js'
import { compressImage } from '../utils/imageCompress.js'
import { useT } from '../i18n/LanguageContext.jsx'

const LOGO_LIMIT_BYTES = 2 * 1024 * 1024

export default function Products() {
  const { state, addProduct } = useStore()
  const { t } = useT()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [dateRange, setDateRange] = useState(null)

  const filtered = useMemo(
    () => state.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [state.products, q],
  )

  const ordered = useMemo(() => {
    const products = []
    const services = []
    for (const p of filtered) {
      ;(p.type === 'Service' ? services : products).push(p)
    }
    return [...products, ...services]
  }, [filtered])

  const overview = useMemo(() => {
    const startMs = dateRange ? dateRange.start.getTime() : null
    const endMs = dateRange ? dateRange.end.getTime() : null
    const inRange = (d) => {
      if (!dateRange) return true
      if (typeof d !== 'string' || d.length < 10) return false
      const ms = new Date(d).getTime()
      if (isNaN(ms)) return false
      return ms >= startMs && ms <= endMs
    }
    let totalIncome = 0
    let totalExpense = 0
    let totalInvoice = 0
    const activeIds = new Set()
    for (const p of state.products) {
      let touched = false
      for (const i of p.income || []) {
        if (!inRange(i.date)) continue
        totalIncome += Number(i.amount || 0)
        if (Array.isArray(i.items) && i.items.length > 0) totalInvoice += 1
        touched = true
      }
      for (const e of p.expenses || []) {
        if (!inRange(e.date)) continue
        totalExpense += Number(e.amount || 0)
        touched = true
      }
      if (touched) activeIds.add(p.id)
    }
    return {
      totalIncome,
      totalExpense,
      totalInvoice,
      totalProducts: activeIds.size,
    }
  }, [state.products, dateRange])

  const handleCreate = async (data) => {
    const logo = await persistImageRef(data.logo, { entityType: 'product' })
    const created = await addProduct({ ...data, logo })
    setOpen(false)
    if (created?.id) navigate(`/products/${created.id}`)
  }

  return (
    <>
      <PageHeader title={t('product.title')} />
      <div className="space-y-3">
        <section className="card !p-3 md:!p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <h2 className="text-xs md:text-sm font-bold uppercase tracking-wider text-graphite">
              {t('product.overview.title')}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <DateFilterButton
                value={dateRange}
                onChange={setDateRange}
                storageKey="ohmycmo:filter:billing"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <div className="rounded-lg p-2.5 md:p-3 bg-emerald-50 text-emerald-700">
              <div className="flex items-center gap-1 text-[11px] md:text-xs font-semibold">
                <TrendingUp className="w-3.5 h-3.5" /> {t('product.overview.totalIncome')}
              </div>
              <p className="mt-1 text-base md:text-lg font-bold">
                ${overview.totalIncome.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg p-2.5 md:p-3 bg-rose-50 text-rose-700">
              <div className="flex items-center gap-1 text-[11px] md:text-xs font-semibold">
                <TrendingDown className="w-3.5 h-3.5" /> {t('product.overview.totalExpense')}
              </div>
              <p className="mt-1 text-base md:text-lg font-bold">
                ${overview.totalExpense.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg p-2.5 md:p-3 bg-brand-50 text-brand-700">
              <div className="flex items-center gap-1 text-[11px] md:text-xs font-semibold">
                <Receipt className="w-3.5 h-3.5" /> {t('product.overview.totalInvoice')}
              </div>
              <p className="mt-1 text-base md:text-lg font-bold tabular-nums">
                {overview.totalInvoice.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg p-2.5 md:p-3 bg-amber-50 text-amber-700">
              <div className="flex items-center gap-1 text-[11px] md:text-xs font-semibold">
                <Layers className="w-3.5 h-3.5" /> {t('product.overview.totalProducts')}
              </div>
              <p className="mt-1 text-base md:text-lg font-bold tabular-nums">
                {overview.totalProducts.toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('product.search')}
            className="input pl-9"
          />
        </div>

        {state.products.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t('product.empty.title')}
            description={t('product.empty.body')}
            action={
              <button onClick={() => setOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> {t('product.addNew')}
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-graphite py-6">{t('common.noResults')}</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {ordered.map((p) => {
              const income = (p.income || []).reduce((s, i) => s + Number(i.amount || 0), 0)
              const expense = (p.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)
              const net = income - expense
              const isService = p.type === 'Service'
              return (
                <li key={p.id}>
                  <Link to={`/products/${p.id}`} className="card flex flex-col gap-3 active:scale-[0.99]">
                    <div className="flex items-start gap-3">
                      {hasImage(p.logo) ? (
                        <AuthImage
                          value={p.logo}
                          alt={`${p.name} logo`}
                          className="w-11 h-11 rounded-xl object-cover border border-shadow bg-iron"
                        />
                      ) : (
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isService ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{p.name}</p>
                        <span className={`inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${isService ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {t(isService ? 'product.type.service' : 'product.type.product')}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-emerald-50 text-emerald-700 rounded-lg p-2">
                        <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {t('product.metric.income')}</div>
                        <p className="font-semibold mt-0.5">${income.toLocaleString()}</p>
                      </div>
                      <div className="bg-rose-50 text-rose-700 rounded-lg p-2">
                        <div className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> {t('product.metric.expense')}</div>
                        <p className="font-semibold mt-0.5">${expense.toLocaleString()}</p>
                      </div>
                      <div className={`rounded-lg p-2 ${net >= 0 ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>
                        <div>{t('product.metric.net')}</div>
                        <p className="font-semibold mt-0.5">${net.toLocaleString()}</p>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <NewProductModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={handleCreate}
      />

      <button
        onClick={() => setOpen(true)}
        className="btn-primary fixed z-40 right-4 md:right-8 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-8 shadow-xl"
        aria-label={t('product.addNew')}
      >
        <Plus className="w-5 h-5" /> {t('common.new')}
      </button>
    </>
  )
}

const EMPTY_PRODUCT = { name: '', type: 'Product', price: 0, logo: null }

function NewProductModal({ open, onClose, onSubmit }) {
  const { t } = useT()
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [logoError, setLogoError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const reset = () => {
    setForm(EMPTY_PRODUCT)
    setError(null)
    setLogoError('')
    setSubmitting(false)
  }

  const close = () => {
    reset()
    onClose()
  }

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
      const logo = await compressImage(f, { maxDim: 800, quality: 0.85 })
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
      reset()
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title={t('product.modal.new')}>
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
            placeholder="e.g. WeBill365"
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
              placeholder="0.00"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full mt-2 disabled:opacity-60"
        >
          {submitting ? t('common.saving') : t('product.save')}
        </button>
      </form>
    </Modal>
  )
}
