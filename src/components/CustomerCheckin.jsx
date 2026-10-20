import { useEffect, useState } from 'react'
import { CalendarHeart, Check } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { memberName } from '../utils/tasks.js'
import { fmtDay, todayKey } from '../utils/sales.js'
import { checkinWhen } from '../utils/care.js'
import { CARE_CADENCES } from '../api/customers.js'
import Select from './Select.jsx'

// Regular check-ins (care proposal, feature 4), inside the health card on
// Customer detail: the rhythm, the care owner, when the next one is due, and
// a button to log one. `checkIn` comes from the customer's health.

const TONE = { overdue: 'text-danger-700', due: 'text-warning-800', upcoming: 'text-near-black' }

export default function CustomerCheckin({ customer, checkIn, onLogged }) {
  const { state, updateCustomer, logCustomerCheckin } = useStore()
  const { user } = useAuth()
  const { t, lang } = useT()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  // Brief "✓ Logged" on the button — logging often leaves the dates as they
  // were (e.g. a second contact on the same day), so say it worked.
  const [logged, setLogged] = useState(false)
  useEffect(() => {
    if (!logged) return
    const id = setTimeout(() => setLogged(false), 2500)
    return () => clearTimeout(id)
  }, [logged])
  const team = (state.team || []).filter((m) => m.active !== false || m.id === customer.careOwnerId)

  const log = async () => {
    setBusy(true)
    try {
      await logCustomerCheckin(customer.id, note.trim())
      setNote('')
      setLogged(true)
      onLogged?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-shadow px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-graphite flex items-center gap-1.5">
        <CalendarHeart className="w-3.5 h-3.5" /> {t('care.checkins')}
      </p>
      <Select
        className="input w-auto !py-1 text-sm"
        aria-label={t('care.rhythm')}
        value={customer.careCadence || ''}
        onChange={(e) => updateCustomer(customer.id, { careCadence: e.target.value || null })}
      >
        <option value="">{t('care.cadence.none')}</option>
        {CARE_CADENCES.map((c) => <option key={c} value={c}>{t(`care.cadence.${c}`)}</option>)}
      </Select>
      <Select
        className="input w-auto !py-1 text-sm"
        aria-label={t('care.owner')}
        value={customer.careOwnerId || ''}
        onChange={(e) => updateCustomer(customer.id, { careOwnerId: e.target.value || null })}
      >
        <option value="">{t('care.ownerNone')}</option>
        {team.map((m) => <option key={m.id} value={m.id}>{m.id === user?.id ? t('sales.me') : memberName(m)}</option>)}
      </Select>
      {checkIn && (
        <p className="text-sm text-graphite">
          {t('care.last')}:{' '}
          <span className="font-semibold text-near-black">{lastLabel(checkIn.lastAt, t)}</span>
        </p>
      )}
      {checkIn && (
        <p className="text-sm">
          {t('care.next')}:{' '}
          <span className={`font-semibold ${TONE[checkIn.status]}`}>
            {fmtDay(checkIn.nextDue, lang, { day: 'numeric', month: 'short' })} · {checkinWhen(checkIn, t)}
          </span>
        </p>
      )}
      <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
        <input
          className="input !py-1 text-sm flex-1 sm:w-48"
          placeholder={t('care.note')}
          aria-label={t('care.note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); log() } }}
        />
        <button type="button" className="btn-primary !py-1.5 text-sm shrink-0" disabled={busy || logged} onClick={log}>
          <Check className="w-4 h-4" /> <span aria-live="polite">{logged ? t('care.logged') : t('care.log')}</span>
        </button>
      </div>
    </div>
  )
}

// "Today" / "5 days ago" / "Never" for the last logged check-in.
function lastLabel(lastAt, t) {
  if (!lastAt) return t('care.never')
  const days = Math.round((Date.parse(todayKey()) - Date.parse(lastAt)) / 864e5)
  return days <= 0 ? t('health.today') : t('health.daysAgo', { count: days })
}
