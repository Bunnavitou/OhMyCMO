import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, CheckCircle2, Circle, HeartHandshake, ClipboardList, Plus, PartyPopper, Trophy } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Select from '../components/Select.jsx'
import SaleForm from '../components/SaleForm.jsx'
import WinDialog from '../components/WinDialog.jsx'
import NoteTip from '../components/NoteTip.jsx'
import SalesDashboard from './SalesDashboard.jsx'
import { useSales, useFollowups, useCalendar, saleApi } from '../api/sales.js'
import { useCheckins } from '../api/customers.js'
import { checkinWhen } from '../utils/care.js'
import { memberLabel } from '../utils/tasks.js'
import {
  ACTIVITY_TYPES, STATUSES, statusStyle, activityStyle, followupStyle, activityLabel, todayKey, dateOnly, splitAt, addDays,
  weekStart, weekDays, fmtDay, fmtDate, saleErrorText, isProspect, partyName, partyPhone, partyLink,
  saleOutcome,
} from '../utils/sales.js'

// Dashboard first and the default (no ?tab in the URL).
const TABS = ['dashboard', 'sales', 'week']

export default function Sales() {
  const { t } = useT()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'dashboard'
  const [form, setForm] = useState(null) // null | { sale } | { defaults }
  const [version, setVersion] = useState(0) // bump to reload the open tab after a save
  const [converted, setConverted] = useState(null) // customer just created from a prospect

  const saved = (_sale, conversion) => {
    setForm(null)
    setVersion((v) => v + 1)
    if (conversion) setConverted(conversion.customer)
  }
  // The calendar holds activities; open their sale with all its activities.
  const openSaleById = async (id) => setForm({ sale: await saleApi.get(id) })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-graphite">{t('sales.kicker')}</p>
          <h1 className="display text-3xl md:text-5xl text-near-black mt-1">{t('sales.title')}</h1>
        </div>
        <button className="btn-primary" onClick={() => setForm({ defaults: {} })}><Plus className="w-4 h-4" /> {t('sales.new')}</button>
      </div>

      <div className="flex gap-6 border-b border-shadow">
        {TABS.map((k) => (
          <button key={k} onClick={() => setParams(k === 'dashboard' ? {} : { tab: k }, { replace: true })}
            className={`pb-2 -mb-px text-sm font-semibold border-b-2 ${tab === k ? 'border-wise-dark text-near-black' : 'border-transparent text-graphite hover:text-near-black'}`}>
            {t(`sales.tab.${k}`)}
          </button>
        ))}
      </div>

      {converted && <ConvertedNotice customer={converted} onClose={() => setConverted(null)} />}

      {tab === 'sales' && <SalesTable key={version} onOpen={(s) => setForm({ sale: s })} />}
      {tab === 'week' && (
        <WeekView key={version} onOpenSale={openSaleById} onAdd={(defaults) => setForm({ defaults })}
          onConverted={(c) => setConverted(c.customer)} />
      )}
      {tab === 'dashboard' && (
        <SalesDashboard key={version}>
          <h2 className="display text-2xl text-near-black pt-4">{t('sales.followup.box')}</h2>
          <FollowupsView onOpen={(s) => setForm({ sale: s })} />
        </SalesDashboard>
      )}

      {form && <SaleForm sale={form.sale} defaults={form.defaults} onClose={() => setForm(null)} onSaved={saved} />}
    </div>
  )
}

// Shown after a Deal Won turned a prospect into a customer.
export function ConvertedNotice({ customer, onClose }) {
  const { t } = useT()
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-success-50 border border-success-200 px-4 py-3 text-sm">
      <PartyPopper className="w-5 h-5 text-success-700 shrink-0" />
      <p className="flex-1">
        {t('sales.converted', { name: customer.name })}{' '}
        <Link to={`/customers/${customer.id}`} className="font-semibold text-wise-dark hover:underline">{t('sales.openCustomer')} →</Link>
      </p>
      <button className="text-graphite hover:text-near-black text-xs" onClick={onClose}>{t('common.close')}</button>
    </div>
  )
}

const ProspectTag = ({ small }) => {
  const { t } = useT()
  return <span className={`pill bg-accent-100 text-accent-700 align-middle ${small ? '!text-[9px] !px-1 !py-0 ml-1' : '!text-[10px] ml-1.5'}`}>{t('sales.prospect')}</span>
}

// "🏆 Won" / "Lost" beside the status once the deal has a result.
function OutcomeTag({ s }) {
  const { t } = useT()
  const outcome = saleOutcome(s)
  if (!outcome) return null
  return outcome === 'won'
    ? <span className="pill inline-flex items-center gap-1 bg-warning-100 text-warning-800"><Trophy className="w-3 h-3" />{t('sales.outcome.won')}</span>
    : <span className="pill bg-iron text-graphite">{t('sales.outcome.lost')}</span>
}

// Customer or prospect name, linking to its page, with a Prospect tag and
// the business card's note behind an icon.
function PartyCell({ s }) {
  const { t } = useT()
  return (
    <span className="flex items-center gap-2 font-semibold text-wise-dark">
      <Avatar name={partyName(s)} />
      <span className="min-w-0">
        <Link to={partyLink(s)} onClick={(e) => e.stopPropagation()} className="hover:underline">{partyName(s)}</Link>
        {isProspect(s) && <ProspectTag />}
        {(s.customer?.notes || s.partner?.notes) && <NoteTip note={s.customer?.notes || s.partner.notes} label={t('partner.field.notes')} />}
        {isProspect(s) && s.partner?.company && <span className="block text-xs font-normal text-graphite">{s.partner.name}</span>}
      </span>
    </span>
  )
}

// The sale's activities at a glance: the next open ones, and how many are done.
function ActivitiesCell({ s }) {
  const { t, lang } = useT()
  const acts = s.activities || []
  if (!acts.length) return <span className="text-graphite">—</span>
  const open = acts.filter((a) => a.status !== 'Done')
  const done = acts.length - open.length
  return (
    <div className="space-y-0.5">
      {open.slice(0, 2).map((a) => (
        <p key={a.id} className="whitespace-nowrap">
          <span className="font-semibold">{activityLabel(a, t)}</span>
          {a.dueDate && <span className="text-graphite"> · {fmtDay(dateOnly(a.dueDate), lang, { day: 'numeric', month: 'short' })}</span>}
        </p>
      ))}
      <p className="text-[11px] text-graphite">{t('sales.activityCount', { done, n: acts.length })}</p>
    </div>
  )
}

const Avatar = ({ name }) => (
  <span className="w-6 h-6 shrink-0 rounded-full bg-near-black text-white text-[11px] font-bold flex items-center justify-center">
    {(name || '?').trim().charAt(0).toUpperCase()}
  </span>
)

const Filter = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-bold uppercase tracking-wider text-graphite mb-1">{label}</p>
    {children}
  </div>
)

// ── Sales table (the main view). Also used on Customer detail with
// `customerId` fixed.
export function SalesTable({ onOpen, customerId }) {
  const { state } = useStore()
  const { t } = useT()
  // ?outcome=won (the dashboard's "View all" on deals won) presets the Result filter.
  const [params] = useSearchParams()
  const startOutcome = ['won', 'lost', 'open'].includes(params.get('outcome')) ? params.get('outcome') : ''
  const [f, setF] = useState({ q: '', userId: '', customerId: customerId || '', activityType: '', status: '', outcome: customerId ? '' : startOutcome, from: '', to: '' })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1) }
  const { items, total, loading } = useSales({ ...f, page, limit })

  const team = (state.team || []).filter((m) => m.active !== false)
  const first = total === 0 ? 0 : (page - 1) * limit + 1
  const last = Math.min(page * limit, total)
  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 items-end">
        <div className="col-span-2 md:w-72">
          <Filter label={t('sales.filter.search')}>
            <div className="relative">
              <Search className="w-4 h-4 text-graphite absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="input pl-9" placeholder={t('sales.searchHint')} value={f.q} onChange={set('q')} />
            </div>
          </Filter>
        </div>
        <Filter label={t('sales.field.officer')}>
          <Select className="input" value={f.userId} onChange={set('userId')}>
            <option value="">{t('sales.filter.allOfficers')}</option>
            {team.map((m) => <option key={m.id} value={m.id}>{memberLabel(m, t('role.admin'))}</option>)}
          </Select>
        </Filter>
        {!customerId && (
          <Filter label={t('sales.field.customer')}>
            <Select className="input md:max-w-[200px]" value={f.customerId} onChange={set('customerId')}>
              <option value="">{t('sales.filter.allCustomers')}</option>
              {state.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Filter>
        )}
        <Filter label={t('sales.activities')}>
          <Select className="input" value={f.activityType} onChange={set('activityType')}>
            <option value="">{t('sales.filter.allTypes')}</option>
            {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{t(`activity.type.${a}`)}</option>)}
          </Select>
        </Filter>
        <Filter label={t('sales.field.status')}>
          <Select className="input" value={f.status} onChange={set('status')}>
            <option value="">{t('sales.filter.allStatuses')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`sales.status.${s}`)}</option>)}
          </Select>
        </Filter>
        <Filter label={t('sales.outcome')}>
          <Select className="input" value={f.outcome} onChange={set('outcome')}>
            <option value="">{t('sales.outcome.all')}</option>
            {['won', 'lost', 'open'].map((o) => <option key={o} value={o}>{t(`sales.outcome.${o}`)}</option>)}
          </Select>
        </Filter>
        <Filter label={t('sales.filter.from')}><input type="date" className="input" value={f.from} onChange={set('from')} /></Filter>
        <Filter label={t('sales.filter.to')}><input type="date" className="input" value={f.to} onChange={set('to')} /></Filter>
      </div>

      <div className={`card !p-0 overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-graphite border-b border-shadow">
              {!customerId && <th className="px-4 py-3">{t('sales.field.customer')}</th>}
              {!customerId && <th className="px-3 py-3">{t('sales.col.phone')}</th>}
              <th className="px-3 py-3">{t('sales.field.product')}</th>
              <th className="px-3 py-3">{t('sales.field.officer')}</th>
              <th className="px-3 py-3">{t('sales.field.saleDate')}</th>
              <th className="px-3 py-3">{t('sales.field.status')}</th>
              <th className="px-3 py-3">{t('sales.activities')}</th>
              <th className="px-3 py-3">{t('sales.field.channel')}</th>
              <th className="px-3 py-3">{t('sales.field.dueDate')}</th>
              <th className="px-3 py-3">{t('sales.field.notes')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-shadow">
            {items.map((s) => {
              const when = splitAt(s.saleAt)
              return (
                <tr key={s.id} onClick={() => onOpen(s)} className="hover:bg-iron cursor-pointer align-middle">
                  {!customerId && <td className="px-4 py-3"><PartyCell s={s} /></td>}
                  {!customerId && <td className="px-3 py-3 tabular-nums text-graphite whitespace-nowrap">{partyPhone(s) || '—'}</td>}
                  <td className="px-3 py-3">{s.product?.name || <span className="text-graphite">—</span>}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2"><Avatar name={memberLabel(s.user, t('role.admin'))} />{memberLabel(s.user, t('role.admin')) || '—'}</span>
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">{fmtDate(when.date)} <span className="text-graphite">{when.time}</span></td>
                  <td className="px-3 py-3">
                    <span className="flex flex-wrap items-center gap-1">
                      <span className={`pill ${statusStyle(s.status)}`}>{t(`sales.status.${s.status}`)}</span>
                      <OutcomeTag s={s} />
                    </span>
                  </td>
                  <td className="px-3 py-3"><ActivitiesCell s={s} /></td>
                  <td className="px-3 py-3 text-graphite">{s.channel ? t(`sales.channel.${s.channel}`) : '—'}</td>
                  <td className={`px-3 py-3 tabular-nums whitespace-nowrap ${followupStyle(s.followupStatus)}`}>{fmtDate(dateOnly(s.dueDate)) || '—'}</td>
                  <td className="px-3 py-3 text-graphite max-w-[240px]"><span className="line-clamp-2">{s.notes}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && items.length === 0 && (
          <div className="p-6"><EmptyState icon={ClipboardList} title={t('sales.empty.title')} description={t('sales.empty.body')} /></div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-3 border-t border-shadow text-sm">
          <span className="text-graphite">{t('sales.rowsPerPage')}</span>
          <Select className="input w-auto !py-1" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <span className="text-graphite tabular-nums">{t('sales.showing', { first, last, total })}</span>
          <button className="font-semibold disabled:text-graphite disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('sales.prev')}</button>
          <span className="tabular-nums">{t('sales.pageOf', { page, pages })}</span>
          <button className="font-semibold disabled:text-graphite disabled:opacity-50" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('sales.next')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Week calendar: each activity on its due date. A rep starts on their own
// (in their charge, or on their sales with nobody in charge), the owner on
// everyone's. ✓ on a card marks it Done without opening the sale.
function WeekView({ onOpenSale, onAdd, onConverted }) {
  const { state, applyConversion, logCustomerCheckin } = useStore()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, lang } = useT()
  const today = todayKey()
  const [monday, setMonday] = useState(() => weekStart(today))
  const [day, setDay] = useState(today) // mobile: one day at a time
  const [person, setPerson] = useState(user?.ownerId ? user.id : '')
  const [error, setError] = useState('')
  const [winning, setWinning] = useState(null) // Deal Won ticked on a prospect's sale
  const days = weekDays(monday)
  const { items, loading, refresh } = useCalendar({ from: monday, to: addDays(monday, 6), userId: person })
  // Regular check-ins due this week; overdue ones sit on today (this week only).
  const { items: checkins, done: checkinsDone, refresh: refreshCheckins } = useCheckins({ from: monday, to: addDays(monday, 6), userId: person })
  const checkinDay = (c) => (c.status === 'overdue' ? (days.includes(today) ? today : null) : c.nextDue)
  const checkinsOn = (d) => checkins.filter((c) => checkinDay(c) === d)
  const doneCheckinsOn = (d) => checkinsDone.filter((c) => c.date === d)
  const countOn = (d) => byDay(d).length + checkinsOn(d).length + doneCheckinsOn(d).length

  const byDay = (d) => items.filter((a) => dateOnly(a.dueDate) === d)
  // Logged check-ins count as done; due ones as still planned.
  const done = items.filter((a) => a.status === 'Done').length + checkinsDone.length
  const planned = items.length + checkins.length + checkinsDone.length
  const canTouch = (a) => !user?.ownerId || a.assigneeId === user?.id || a.sale?.userId === user?.id

  const moveWeek = (n) => { const m = addDays(monday, 7 * n); setMonday(m); setDay(m) }
  const toggleDone = async (a) => {
    setError('')
    // Deal Won on a prospect: confirm the customer first (WinDialog).
    if (a.type === 'Deal Won' && a.status !== 'Done' && a.sale && !a.sale.customerId && a.sale.partner) {
      setWinning(a)
      return
    }
    try {
      const res = await saleApi.updateActivity(a.id, { status: a.status === 'Done' ? 'In progress' : 'Done' })
      applyConversion({ customer: res.customer })
      refresh()
    } catch (err) {
      setError(saleErrorText(err, t))
    }
  }
  const win = async (details) => {
    const res = await saleApi.win(winning.saleId, details)
    applyConversion(res.conversion)
    onConverted(res.conversion)
    setWinning(null)
    refresh()
  }
  const card = (a) => <WeekCard key={a.id} a={a} onOpen={() => onOpenSale(a.saleId)} onToggle={canTouch(a) ? () => toggleDone(a) : null} />
  // Anyone may log a check-in for a customer with no care owner; otherwise its owner or the account owner.
  const canCheckin = (c) => !user?.ownerId || !c.careOwner || c.careOwner.id === user?.id
  const logCheckin = async (c) => {
    setError('')
    try {
      await logCustomerCheckin(c.customerId)
      refreshCheckins()
    } catch (err) {
      setError(saleErrorText(err, t))
    }
  }
  const checkinCard = (c) => (
    <CheckinCard key={`care-${c.customerId}`} c={c}
      onOpen={() => navigate(`/customers/${c.customerId}`)}
      onLog={canCheckin(c) ? () => logCheckin(c) : null} />
  )
  const doneCheckinCard = (c) => (
    <DoneCheckinCard key={`care-done-${c.id}`} c={c} by={(state.team || []).find((m) => m.id === c.byId)}
      onOpen={() => navigate(`/customers/${c.customerId}`)} />
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost !px-2" onClick={() => moveWeek(-1)} aria-label={t('sales.prevWeek')}><ChevronLeft className="w-5 h-5" /></button>
        <p className="font-semibold tabular-nums">
          {fmtDay(monday, lang, { day: 'numeric', month: 'short' })} – {fmtDay(addDays(monday, 6), lang, { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <button className="btn-ghost !px-2" onClick={() => moveWeek(1)} aria-label={t('sales.nextWeek')}><ChevronRight className="w-5 h-5" /></button>
        {monday !== weekStart(today) && (
          <button className="btn-ghost text-sm" onClick={() => { setMonday(weekStart(today)); setDay(today) }}>{t('sales.thisWeek')}</button>
        )}
        <Select className="input w-auto" value={person} onChange={(e) => setPerson(e.target.value)} aria-label={t('sales.inCharge')}>
          <option value="">{t('sales.everyone')}</option>
          {(state.team || []).filter((m) => m.active !== false).map((m) => (
            <option key={m.id} value={m.id}>{m.id === user?.id ? t('sales.me') : memberLabel(m, t('role.admin'))}</option>
          ))}
        </Select>
        <span className="text-sm text-graphite md:ml-auto">{t('sales.completion', { done, planned })}</span>
      </div>
      {error && <p className="text-sm text-danger-700">{error}</p>}

      {/* Desktop: 7 columns */}
      <div className={`hidden md:grid grid-cols-7 gap-1.5 ${loading ? 'opacity-60' : ''}`}>
        {days.map((d) => (
          <div key={d} className="space-y-1.5">
            <div className={`px-2 py-1 rounded-xl text-center text-xs font-bold ${d === today ? 'bg-wise-dark text-white' : 'text-graphite'}`}>
              {fmtDay(d, lang, { weekday: 'short' })} {fmtDay(d, lang, { day: 'numeric' })}
            </div>
            <div className="group min-h-[320px] rounded-2xl bg-iron p-1.5 space-y-1.5">
              {checkinsOn(d).map(checkinCard)}
              {byDay(d).map(card)}
              {doneCheckinsOn(d).map(doneCheckinCard)}
              <button onClick={() => onAdd({ date: d })} className="w-full py-1 text-xs text-graphite opacity-0 group-hover:opacity-100 hover:text-wise-dark">+ {t('sales.new')}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: one day */}
      <div className="md:hidden space-y-3">
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => (
            <button key={d} onClick={() => setDay(d)}
              className={`py-2 rounded-xl text-xs font-bold ${d === day ? 'bg-wise-dark text-white' : d === today ? 'bg-brand-50 text-brand-700' : 'bg-iron text-graphite'}`}>
              {fmtDay(d, lang, { weekday: 'narrow' })}<br />{fmtDay(d, lang, { day: 'numeric' })}
              {countOn(d) > 0 && <span className="block text-[10px] font-semibold opacity-80">{countOn(d)}</span>}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {checkinsOn(day).map(checkinCard)}
          {byDay(day).map(card)}
          {doneCheckinsOn(day).map(doneCheckinCard)}
          <button className="w-full rounded-2xl border border-dashed border-shadow py-3 text-sm text-graphite" onClick={() => onAdd({ date: day })}>
            + {t('sales.new')}
          </button>
        </div>
      </div>
      {!loading && planned === 0 && <p className="text-sm text-graphite">{t('sales.week.empty')}</p>}
      {winning && (
        <WinDialog partner={winning.sale.partner} productId={winning.sale.productId}
          onClose={() => setWinning(null)} onConfirm={win} />
      )}
    </div>
  )
}

function WeekCard({ a, onOpen, onToggle }) {
  const { t } = useT()
  const done = a.status === 'Done'
  const who = a.assignee || a.sale?.user
  return (
    <div className="card !p-2 flex gap-1.5 items-start hover:ring-2 hover:ring-brand-300">
      {onToggle ? (
        <button type="button" onClick={onToggle} aria-label={done ? t('sales.markNotDone') : t('sales.markDone')}
          className={`mt-0.5 shrink-0 ${done ? 'text-success-600' : 'text-graphite hover:text-wise-dark'}`}>
          {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
        </button>
      ) : <span className="w-4 shrink-0" />}
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left space-y-0.5">
        <p className={`text-[12px] font-bold truncate ${done ? 'line-through text-graphite' : ''}`}>
          {activityLabel(a, t)}{a.type !== 'Other' && a.title && <span className="font-normal text-graphite"> · {a.title}</span>}
        </p>
        <p className="text-xs font-semibold text-graphite truncate">
          {a.sale ? partyName(a.sale) : ''}
          {a.sale && isProspect(a.sale) && <ProspectTag small />}
        </p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className={`pill !text-[10px] !px-1.5 !py-0 ${activityStyle(a.status)}`}>{t(`sales.activityStatus.${a.status}`)}</span>
          <span className="text-[10px] text-graphite truncate">{memberLabel(who, t('role.admin'))}</span>
        </div>
      </button>
    </div>
  )
}

// A regular check-in on the week calendar: ✓ logs it, the card opens the customer.
function CheckinCard({ c, onOpen, onLog }) {
  const { t } = useT()
  const overdue = c.status === 'overdue'
  return (
    <div className={`card !p-2 flex gap-1.5 items-start hover:ring-2 hover:ring-brand-300 ${overdue ? '!border-danger-200' : ''}`}>
      {onLog ? (
        <button type="button" onClick={onLog} aria-label={t('care.log')} title={t('care.log')}
          className="mt-0.5 shrink-0 text-graphite hover:text-wise-dark">
          <Circle className="w-4 h-4" />
        </button>
      ) : <span className="w-4 shrink-0" />}
      <button type="button" onClick={onOpen} aria-label={t('care.openCustomer')} className="flex-1 min-w-0 text-left space-y-0.5">
        <p className="text-[12px] font-bold truncate flex items-center gap-1">
          <HeartHandshake className="w-3.5 h-3.5 shrink-0 text-accent-600" /> {t('care.checkin')}
        </p>
        <p className="text-xs font-semibold text-graphite truncate">{c.name}</p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className={`pill !text-[10px] !px-1.5 !py-0 ${overdue ? 'bg-danger-100 text-danger-700' : 'bg-accent-100 text-accent-700'}`}>
            {overdue ? checkinWhen(c, t) : t(`care.cadence.${c.cadence}`)}
          </span>
          {c.careOwner && <span className="text-[10px] text-graphite truncate">{memberLabel(c.careOwner, t('role.admin'))}</span>}
        </div>
      </button>
    </div>
  )
}

// A check-in logged this week: ticked, with who did it and the note.
function DoneCheckinCard({ c, by, onOpen }) {
  const { t } = useT()
  return (
    <button type="button" onClick={onOpen} aria-label={t('care.openCustomer')}
      className="card !p-2 w-full flex gap-1.5 items-start text-left hover:ring-2 hover:ring-brand-300">
      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-success-600" />
      <span className="flex-1 min-w-0 space-y-0.5">
        <span className="text-[12px] font-bold truncate flex items-center gap-1 line-through text-graphite">
          <HeartHandshake className="w-3.5 h-3.5 shrink-0" /> {t('care.checkin')}
        </span>
        <span className="block text-xs font-semibold text-graphite truncate">{c.name}</span>
        {c.note && <span className="block text-[11px] text-graphite truncate" title={c.note}>{c.note}</span>}
        <span className="flex items-center gap-1 flex-wrap">
          <span className="pill !text-[10px] !px-1.5 !py-0 bg-success-100 text-success-700">{t('care.logged')}</span>
          {by && <span className="text-[10px] text-graphite truncate">{memberLabel(by, t('role.admin'))}</span>}
        </span>
      </span>
    </button>
  )
}

// ── Follow-ups: Follow-up sales by due date (Excel BR-02).
function FollowupsView({ onOpen }) {
  const { applyConversion } = useStore()
  const { user } = useAuth()
  const { t, lang } = useT()
  const { groups, loading, refresh } = useFollowups({ userId: user?.ownerId ? user.id : undefined })
  const [error, setError] = useState('')
  const total = groups.overdue.length + groups.today.length + groups.upcoming.length
  const canEdit = (s) => !user?.ownerId || s.userId === user?.id

  const complete = async (s) => {
    setError('')
    try { applyConversion({ customer: (await saleApi.update(s.id, { status: 'Completed' })).customer }); refresh() } catch (err) { setError(saleErrorText(err, t)) }
  }

  return (
    <div className={`space-y-5 ${loading ? 'opacity-60' : ''}`}>
      {error && <p className="text-sm text-danger-700">{error}</p>}
      {['overdue', 'today', 'upcoming'].map((g) => (
        <section key={g}>
          <h2 className={`section-title mb-2 ${g === 'overdue' && groups.overdue.length ? 'text-danger-700' : ''}`}>
            {t(`sales.followup.${g}`)} · {groups[g].length}
          </h2>
          {groups[g].length > 0 && (
            <ul className="card divide-y divide-shadow !p-0">
              {groups[g].map((s) => {
                const next = (s.activities || []).find((a) => a.status !== 'Done')
                return (
                  <li key={s.id} className="p-3 md:p-4 flex gap-3 items-center">
                    <button className="flex-1 min-w-0 text-left space-y-0.5" onClick={() => onOpen(s)}>
                      <p className="text-sm">
                        <span className={followupStyle(s.followupStatus)}>{fmtDay(dateOnly(s.dueDate), lang, { day: 'numeric', month: 'short' })}</span>
                        {' · '}<span className="font-semibold">{partyName(s)}</span>
                        {isProspect(s) && <ProspectTag />}
                        {(s.customer?.notes || s.partner?.notes) && <NoteTip note={s.customer?.notes || s.partner.notes} label={t('partner.field.notes')} />}
                        {partyPhone(s) && <span className="text-graphite"> · {partyPhone(s)}</span>}
                      </p>
                      {next && <p className="text-sm">{t('sales.next')}: <span className="font-semibold">{activityLabel(next, t)}</span></p>}
                      {s.notes && <p className="text-sm text-graphite line-clamp-2">{s.notes}</p>}
                      <p className="text-xs text-graphite">{memberLabel(s.user, t('role.admin')) || '—'}</p>
                    </button>
                    {canEdit(s) && (
                      <button className="btn-ghost !px-3 text-sm shrink-0" onClick={() => complete(s)}>
                        <CheckCircle2 className="w-4 h-4" /> <span className="hidden sm:inline">{t('sales.markCompleted')}</span>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
      {!loading && total === 0 && <EmptyState icon={CheckCircle2} title={t('sales.followup.emptyTitle')} description={t('sales.followup.emptyBody')} />}
    </div>
  )
}
