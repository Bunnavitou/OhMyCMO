import { useRef, useState } from 'react'
import { X, Trash2, Trophy } from 'lucide-react'
import Modal from './Modal.jsx'
import PartyPicker from './PartyPicker.jsx'
import SaleActivities from './SaleActivities.jsx'
import WinDialog from './WinDialog.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import { useT } from '../i18n/LanguageContext.jsx'
import { memberLabel } from '../utils/tasks.js'
import { saleApi } from '../api/sales.js'
import {
  STATUSES, CHANNELS, OTHER, statusFromActivities, nextActivityDue, statusStyle, fmtDay, todayKey, dateOnly, splitAt,
  joinAt, saleErrorText,
} from '../utils/sales.js'
import Select from './Select.jsx'

// One "label | field" row, like the sample form.
const Row = ({ label, required, children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 px-4 py-3 items-start">
    <label className="text-sm text-graphite pt-2">{label}{required && ' *'}</label>
    <div className="min-w-0">{children}</div>
  </div>
)

// Add / edit a sale and its activities. `defaults` pre-fills a new one (the
// day clicked on the week calendar, or the customer whose page it was opened
// from).
export default function SaleForm({ sale, defaults, onClose, onSaved }) {
  const { state, applyConversion } = useStore()
  const { user } = useAuth()
  const { t, lang } = useT()
  const isOwner = !user?.ownerId
  // Choosing the sales officer: the owner, or a sub-user given 'sales.assign'.
  const canAssign = hasPermission(user, 'sales.assign')
  // Reps see the whole team's sales but change only their own (A2), as the
  // API enforces; someone else's sale opens read-only.
  const canEdit = !sale || isOwner || sale.userId === user?.id
  const canDelete = sale && (isOwner || sale.userId === user?.id) && hasPermission(user, 'sales.delete')

  const [form, setForm] = useState(() => {
    const when = sale ? splitAt(sale.saleAt) : { date: defaults?.date || todayKey(), time: defaults?.time || '09:00' }
    return {
      productId: sale?.productId || '',
      customerId: sale?.customerId || defaults?.customerId || '',
      partnerId: sale?.partnerId || defaults?.partnerId || '',
      status: sale?.status || 'New',
      date: when.date,
      time: when.time,
      dueDate: dateOnly(sale?.dueDate),
      userId: sale?.userId || user?.id,
      channel: sale?.channel || '',
      notes: sale?.notes || '',
      activities: (sale?.activities || []).map((a) => ({
        id: a.id, type: a.type, title: a.title || '', status: a.status, dueDate: dateOnly(a.dueDate) || null, assigneeId: a.assigneeId,
      })),
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [winOpen, setWinOpen] = useState(false)
  const savedId = useRef(sale?.id) // a new sale saved before winning — reused if winning is retried
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }))

  // With activities, the status follows them (same rule as the API): all New
  // → New, all Done → Completed, else Follow-up. Cancelled stays a manual choice.
  const acts = form.activities
  const auto = acts.length > 0 && form.status !== 'Cancelled'
  const status = auto ? statusFromActivities(acts) : form.status
  const activityDue = nextActivityDue(acts)

  const pickStatus = (s) => {
    // Completed by hand marks every activity Done, so the two never disagree.
    if (s === 'Completed' && acts.length) {
      setForm((f) => ({ ...f, status: s, activities: f.activities.map((a) => ({ ...a, status: 'Done' })) }))
    } else {
      setForm((f) => ({ ...f, status: s }))
    }
  }
  // New / Follow-up come from the activities; they can only be picked to undo Cancelled.
  const locked = (s) => auto && (s === 'New' || s === 'Follow-up') && s !== status

  // A prospect (business card) becomes a customer only through Mark as won,
  // which confirms the customer's details first (WinDialog).
  const partner = !form.customerId && form.partnerId ? state.partners.find((p) => p.id === form.partnerId) : null

  const check = () => {
    if (!form.customerId && !form.partnerId) return t('sales.error.customer')
    if (acts.some((a) => a.type === OTHER && !a.title.trim())) return t('sales.error.otherName')
    return ''
  }

  const buildBody = () => ({
    saleAt: joinAt(form.date, form.time),
    status,
    customerId: form.customerId || null,
    partnerId: form.partnerId || null,
    productId: form.productId || null,
    channel: form.channel || null,
    dueDate: form.dueDate || null,
    notes: form.notes.trim() || null,
    activities: acts.map((a) => ({
      ...(a.id.startsWith('new-') ? {} : { id: a.id }),
      type: a.type,
      title: a.title.trim() || null,
      status: a.status,
      dueDate: a.dueDate || null,
      assigneeId: a.assigneeId || null,
    })),
    ...(canAssign ? { userId: form.userId } : {}),
  })
  const save = () => (sale ? saleApi.update(sale.id, buildBody()) : saleApi.create(buildBody()))

  const submit = async (e) => {
    e.preventDefault()
    const problem = check()
    if (problem) return setError(problem)
    // Saving a prospect's sale with Deal Won done asks to create the customer.
    if (partner && acts.some((a) => a.type === 'Deal Won' && a.status === 'Done')) return setWinOpen(true)
    if (status === 'Follow-up' && !form.dueDate && !activityDue) return setError(t('sales.error.dueDate'))
    setSaving(true)
    setError('')
    try {
      const res = await save()
      applyConversion({ customer: res.customer }) // a won product added to Customer › Products
      onSaved(res.sale)
    } catch (err) {
      setError(saleErrorText(err, t))
      setSaving(false)
    }
  }

  const openWin = () => {
    const problem = check()
    if (problem) return setError(problem)
    setError('')
    setWinOpen(true)
  }
  // Save the sale as it is in the form, already Completed (winning completes
  // it, so no Follow-up date is needed), then win it — the API creates the
  // customer and records the Deal Won. Throws to WinDialog to show errors.
  const win = async (details) => {
    const body = { ...buildBody(), status: 'Completed' }
    if (savedId.current) await saleApi.update(savedId.current, body)
    else savedId.current = (await saleApi.create(body)).sale.id
    const id = savedId.current
    const res = await saleApi.win(id, details)
    applyConversion(res.conversion)
    onSaved(res.sale, res.conversion)
  }

  const remove = async () => {
    if (!window.confirm(t('sales.confirmDelete'))) return
    try {
      await saleApi.remove(sale.id)
      onSaved(null)
    } catch (err) {
      setError(saleErrorText(err, t))
    }
  }

  const officer = (state.team || []).find((m) => m.id === form.userId)

  return (
    <Modal open onClose={onClose} title={!sale ? t('sales.new') : canEdit ? t('sales.edit') : t('sales.view')} size="xl">
      <form onSubmit={submit} className="space-y-4">
        {!canEdit && (
          <p className="text-sm rounded-xl bg-warning-50 text-warning-800 px-3 py-2">
            {t('sales.readOnly', { name: memberLabel(officer, t('role.admin')) || t('sales.anotherOfficer') })}
          </p>
        )}
        <fieldset disabled={!canEdit} className={`min-w-0 ${canEdit ? '' : 'opacity-75 [&_*]:cursor-default'}`}>
        <div className="rounded-3xl border border-shadow divide-y divide-shadow">
          <Row label={t('sales.field.product')}>
            <Select className="input" value={form.productId} onChange={set('productId')}>
              <option value="">{t('sales.chooseProduct')}</option>
              {state.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Row>
          <Row label={t('sales.field.customer')} required>
            <PartyPicker customerId={form.customerId} partnerId={form.partnerId}
              onChange={(v) => setForm((f) => ({ ...f, customerId: v.customerId || '', partnerId: v.partnerId || '' }))} />
            {partner && (
              <button type="button" onClick={openWin}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning-100 hover:bg-warning-200 text-warning-900 font-semibold text-sm px-3 py-1.5">
                <Trophy className="w-4 h-4" /> {t('sales.win.button')}
              </button>
            )}
          </Row>
          <Row label={t('sales.field.status')}>
            {/* Coloured like the status pill; New / Follow-up are greyed out
                while the activities decide them. */}
            <Select
              aria-label={t('sales.field.status')}
              value={status}
              onChange={(e) => pickStatus(e.target.value)}
              className={`input w-auto font-semibold cursor-pointer ${statusStyle(status)}`}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} disabled={locked(s)} className="bg-white text-near-black">
                  {t(`sales.status.${s}`)}
                </option>
              ))}
            </Select>
            {auto && <p className="text-xs text-graphite mt-1.5">{t('sales.statusFromActivities')}</p>}
          </Row>
          <Row label={t('sales.field.saleDate')} required>
            <div className="flex gap-2">
              <input type="date" className="input" value={form.date} onChange={set('date')} required />
              <input type="time" className="input w-32" value={form.time} onChange={set('time')} required />
            </div>
          </Row>
          <Row label={t('sales.field.dueDate')} required={status === 'Follow-up' && !activityDue}>
            <div className="flex items-center gap-2">
              <input type="date" className="input" value={form.dueDate} onChange={set('dueDate')} />
              {form.dueDate && (
                <button type="button" className="text-graphite hover:text-near-black" onClick={() => set('dueDate')('')} aria-label={t('sales.clear')}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {status === 'Follow-up' && !form.dueDate && activityDue && (
              <p className="text-xs text-graphite mt-1">{t('sales.dueFromActivity', { date: fmtDay(activityDue, lang, { day: 'numeric', month: 'short' }) })}</p>
            )}
          </Row>
          <Row label={t('sales.field.officer')}>
            {canAssign ? (
              <Select className="input" value={form.userId} onChange={set('userId')}>
                {(state.team || []).filter((m) => m.active !== false || m.id === form.userId)
                  .map((m) => <option key={m.id} value={m.id}>{memberLabel(m, t('role.admin'))}</option>)}
              </Select>
            ) : (
              <span className="pill bg-iron text-near-black !py-1.5 !px-3">{memberLabel(officer || user, t('role.admin'))}</span>
            )}
          </Row>
          <Row label={t('sales.field.channel')}>
            <Select className="input" value={form.channel} onChange={set('channel')}>
              <option value="">—</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{t(`sales.channel.${c}`)}</option>)}
            </Select>
          </Row>
          <Row label={t('sales.field.notes')}>
            <textarea className="input min-h-[80px]" value={form.notes} onChange={set('notes')} placeholder={t('sales.notesHint')} />
          </Row>

          <SaleActivities value={form.activities} onChange={(activities) => setForm((f) => ({ ...f, activities }))} />
        </div>
        </fieldset>

        {error && <p className="text-sm text-danger-700">{error}</p>}
        <div className="flex items-center gap-2">
          {canDelete && (
            <button type="button" onClick={remove} className="btn-ghost text-danger-700"><Trash2 className="w-4 h-4" /> {t('common.delete')}</button>
          )}
          <button type="button" onClick={onClose} className="btn-ghost ml-auto">{canEdit ? t('common.cancel') : t('common.close')}</button>
          {canEdit && (
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {sale ? t('common.save') : t('sales.save')}
            </button>
          )}
        </div>
      </form>
      {winOpen && partner && (
        <WinDialog partner={partner} productId={form.productId} onClose={() => setWinOpen(false)} onConfirm={win} />
      )}
    </Modal>
  )
}
