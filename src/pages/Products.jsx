import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Package, TrendingUp, TrendingDown, Plus } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useT } from '../i18n/LanguageContext.jsx'

export default function Products() {
  const { state, addProduct } = useStore()
  const { t } = useT()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(
    () => state.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [state.products, q],
  )

  const grouped = useMemo(() => {
    const out = { Product: [], Service: [] }
    for (const p of filtered) {
      const bucket = p.type === 'Service' ? 'Service' : 'Product'
      out[bucket].push(p)
    }
    return out
  }, [filtered])

  const handleCreate = async (data) => {
    const created = await addProduct(data)
    setOpen(false)
    if (created?.id) navigate(`/products/${created.id}`)
  }

  return (
    <>
      <PageHeader title={t('product.title')} />
      <div className="space-y-3">
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
          (['Product', 'Service']).map((bucket) =>
            grouped[bucket].length === 0 ? null : (
              <section key={bucket}>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {grouped[bucket].map((p) => {
                    const income = (p.income || []).reduce((s, i) => s + Number(i.amount || 0), 0)
                    const expense = (p.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)
                    const net = income - expense
                    return (
                      <li key={p.id}>
                        <Link to={`/products/${p.id}`} className="card flex flex-col gap-3 active:scale-[0.99]">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                              <Package className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{p.name}</p>
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
              </section>
            ),
          )
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

const EMPTY_PRODUCT = { name: '', type: 'Product', price: 0 }

function NewProductModal({ open, onClose, onSubmit }) {
  const { t } = useT()
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const reset = () => {
    setForm(EMPTY_PRODUCT)
    setError(null)
    setSubmitting(false)
  }

  const close = () => {
    reset()
    onClose()
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
