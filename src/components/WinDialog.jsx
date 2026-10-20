import { useState } from 'react'
import { Trophy, UserCheck, Info } from 'lucide-react'
import Modal from './Modal.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { similarCustomers, sameCustomerName, saleErrorText } from '../utils/sales.js'
import Select from './Select.jsx'

// Confirms the customer a prospect (Partner business card) becomes, before
// anything is created: name, contact and phone come from the card and can be
// corrected, and a customer with a similar name can be used instead of a
// near-duplicate. `mode` 'sale' (Mark as won — also asks the product) or
// 'partner' (Convert to customer). `onConfirm(details)` does the save and
// throws to show an error here.
export default function WinDialog({ mode = 'sale', partner, productId, onClose, onConfirm }) {
  const { state } = useStore()
  const { t } = useT()
  const [form, setForm] = useState({
    name: (partner.company || '').trim() || partner.name,
    contact: partner.company ? partner.name : '',
    phone: partner.phone || '',
    productId: productId || '',
  })
  const matches = similarCustomers(state.customers, form.name)
  // '' = create new; otherwise the id of the customer to use. Pre-selected
  // only for an exact match — a looser one is just offered.
  const [useId, setUseId] = useState(() => state.customers.find((c) => sameCustomerName(c.name, form.name))?.id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const using = matches.find((c) => c.id === useId)

  const submit = async (e) => {
    e.preventDefault()
    if (!using && !form.name.trim()) return setError(t('sales.win.nameRequired'))
    setSaving(true)
    setError('')
    const details = using
      ? { customerId: using.id }
      : { name: form.name.trim(), contact: form.contact.trim() || null, phone: form.phone.trim() || null }
    if (mode === 'sale') details.productId = form.productId || null
    try {
      await onConfirm(details)
    } catch (err) {
      setError(saleErrorText(err, t))
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={mode === 'sale' ? t('sales.win.title') : t('sales.win.convertTitle')}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-graphite flex items-start gap-2">
          {mode === 'sale' ? <Trophy className="w-4 h-4 mt-0.5 text-warning-600 shrink-0" /> : <UserCheck className="w-4 h-4 mt-0.5 text-success-700 shrink-0" />}
          <span>{t(mode === 'sale' ? 'sales.win.intro' : 'sales.win.convertIntro', { name: partner.company || partner.name })}</span>
        </p>

        {matches.length > 0 && (
          <div className="rounded-2xl bg-warning-50 border border-warning-200 p-3 space-y-1.5 text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-warning-900"><Info className="w-4 h-4" /> {t('sales.win.similar')}</p>
            {matches.map((c) => (
              <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="use" checked={useId === c.id} onChange={() => setUseId(c.id)} />
                <span>{t('sales.win.useExisting')} <b>{c.name}</b>{c.phone && <span className="text-graphite"> · {c.phone}</span>}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="use" checked={!useId} onChange={() => setUseId('')} />
              <span>{t('sales.win.createNew')}</span>
            </label>
          </div>
        )}

        <fieldset disabled={!!using} className="space-y-3 disabled:opacity-50">
          <div>
            <label className="label">{t('sales.win.name')} *</label>
            <input className="input" value={form.name} onChange={set('name')} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('sales.win.contact')}</label>
              <input className="input" value={form.contact} onChange={set('contact')} />
            </div>
            <div>
              <label className="label">{t('sales.win.phone')}</label>
              <input className="input" value={form.phone} onChange={set('phone')} />
            </div>
          </div>
        </fieldset>

        {mode === 'sale' && (
          <div>
            <label className="label">{t('sales.field.product')}</label>
            <Select className="input" value={form.productId} onChange={set('productId')}>
              <option value="">—</option>
              {state.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <p className="text-xs text-graphite mt-1.5">{t('sales.win.closes')}</p>
          </div>
        )}

        {error && <p className="text-sm text-danger-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
            {using ? t('sales.win.confirmExisting') : t('sales.win.confirmNew')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
