import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Trophy, ArrowRight } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { useDashboard } from '../api/sales.js'
import { chart, neutral } from '../theme/colors.js'
import { memberLabel } from '../utils/tasks.js'
import { todayKey, fmtDay, partyName, partyLink, splitAt } from '../utils/sales.js'
import Select from '../components/Select.jsx'

// Sales › Dashboard: overview cards, products in use by customers, and deals
// won by month or year. Colors follow the dataviz method: categorical slots
// in fixed order (validated, light mode — the app has no dark theme), "Other"
// in neutral gray, a single brand hue for the one-series bar chart.
const SLOTS = chart.series
const OTHER = chart.other
const BAR = chart.bar   // one series, named by the title
const MAX_SLICES = SLOTS.length

const Filter = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-bold uppercase tracking-wider text-graphite mb-1">{label}</p>
    {children}
  </div>
)

export default function SalesDashboard({ children }) {
  const { state } = useStore()
  const { user } = useAuth()
  const { t } = useT()
  // A rep starts on their own numbers, the owner on everyone's.
  const [f, setF] = useState({ userId: user?.ownerId ? user.id : '', customerId: '', from: '', to: '' })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const { totals, wonByMonth, wins, winsTotal, loading } = useDashboard(f)
  const team = (state.team || []).filter((m) => m.active !== false)

  const cards = [
    { key: 'total', value: totals?.total, accent: chart.kpi.total },
    { key: 'progress', value: totals && totals.new + totals.followUp, sub: totals && t('sales.dash.progressSub', { n: totals.new, f: totals.followUp }), accent: chart.kpi.progress },
    // Completed only means the work is finished; say how many were won or lost.
    { key: 'completed', value: totals?.completed, sub: totals && t('sales.dash.completedSub', { won: totals.won, lost: totals.lost }), accent: chart.kpi.completed },
    { key: 'rejected', value: totals?.rejected, accent: chart.kpi.rejected },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 items-end">
        <Filter label={t('sales.field.officer')}>
          <Select className="input" value={f.userId} onChange={set('userId')}>
            <option value="">{t('sales.filter.allOfficers')}</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.id === user?.id ? t('sales.me') : memberLabel(m, t('role.admin'))}</option>)}
          </Select>
        </Filter>
        <Filter label={t('sales.field.customer')}>
          <Select className="input md:max-w-[220px]" value={f.customerId} onChange={set('customerId')}>
            <option value="">{t('sales.filter.allCustomers')}</option>
            {state.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Filter>
        <Filter label={t('sales.filter.from')}><input type="date" className="input" value={f.from} onChange={set('from')} /></Filter>
        <Filter label={t('sales.filter.to')}><input type="date" className="input" value={f.to} onChange={set('to')} /></Filter>
      </div>

      {/* Overview cards — numbers, not charts */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${loading ? 'opacity-60' : ''}`}>
        {cards.map((c) => (
          // Status colors on the top edge only; the label carries the meaning.
          <div key={c.key} className="card !rounded-2xl border-t-4 !p-4" style={{ borderTopColor: c.accent }}>
            <p className="text-sm font-semibold">{t(`sales.dash.${c.key}`)}</p>
            <p className="display text-3xl md:text-4xl mt-1 tabular-nums">{c.value ?? '—'}</p>
            {c.sub && <p className="text-xs text-graphite mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
        <ProductsCard customerId={f.customerId} />
        <WonChart wonByMonth={wonByMonth} loading={loading} />
      </div>

      <WinsCard wins={wins} total={winsTotal} loading={loading} />

      {children}
    </div>
  )
}

// ── Products in use: customers linked to each product (Customer › Products).

function ProductsCard({ customerId }) {
  const { state } = useStore()
  const { t } = useT()
  const [hover, setHover] = useState(null)

  // productId → Set(customerId), for all customers and for the filtered view.
  const usersOf = (only) => {
    const m = new Map()
    for (const c of state.customers) {
      if (only && c.id !== only) continue
      for (const l of c.productLinks || []) {
        if (!m.has(l.productId)) m.set(l.productId, new Set())
        m.get(l.productId).add(c.id)
      }
    }
    return m
  }
  const rank = (m) => state.products
    .map((p) => ({ id: p.id, name: p.name, n: m.get(p.id)?.size || 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
  // Color follows the product, not its rank in this view: slots come from the
  // ranking across all customers, so the customer filter never repaints a
  // product, and the top products always get distinct slots.
  const overall = rank(usersOf(null))
  const keep = overall.length > MAX_SLICES ? MAX_SLICES - 1 : MAX_SLICES
  const slot = new Map(overall.slice(0, keep).map((r, i) => [r.id, SLOTS[i]]))
  const users = usersOf(customerId)
  const ranked = rank(users)
  const shown = ranked.filter((r) => slot.has(r.id))
  const rest = ranked.filter((r) => !slot.has(r.id))
  const slices = [
    ...shown.map((r) => ({ ...r, color: slot.get(r.id) })),
    ...(rest.length ? [{ id: 'other', name: t('sales.dash.otherProducts'), n: rest.reduce((s, r) => s + r.n, 0), color: OTHER }] : []),
  ]
  const total = slices.reduce((s, r) => s + r.n, 0)
  // Products nobody uses yet still get a row, so none silently disappears.
  const unused = customerId ? [] : state.products.filter((p) => !users.has(p.id))
  const customersUsing = new Set([...users.values()].flatMap((set) => [...set])).size

  return (
    <section className="card !rounded-2xl !p-0">
      <h2 className="px-4 py-3 border-b border-shadow text-sm font-bold">{t('sales.dash.products')}</h2>
      {total === 0 ? (
        <p className="p-4 text-sm text-graphite">{t('sales.dash.noProducts')}</p>
      ) : (
        <div className="p-4 space-y-4">
          <div className="relative mx-auto w-44 h-44">
            <Donut slices={slices} total={total} hover={hover} onHover={setHover} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {hover ? (
                <>
                  <span className="display text-2xl tabular-nums">{hover.n}</span>
                  <span className="text-[11px] text-graphite text-center px-6 leading-tight">{hover.name}</span>
                </>
              ) : (
                <>
                  <span className="display text-3xl tabular-nums">{customersUsing}</span>
                  <span className="text-[11px] text-graphite">{t('sales.dash.customers')}</span>
                </>
              )}
            </div>
          </div>
          {/* Legend = the table view: every slice named with its count and share. */}
          <ul className="space-y-1.5 text-sm">
            {slices.map((s) => (
              <li key={s.id} className={`flex items-center gap-2 rounded-lg px-1 ${hover?.id === s.id ? 'bg-iron' : ''}`}
                onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)}>
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="flex-1 min-w-0 truncate">{s.name}</span>
                <span className="tabular-nums font-semibold">{s.n}</span>
                <span className="tabular-nums text-graphite w-10 text-right">{Math.round((s.n / total) * 100)}%</span>
              </li>
            ))}
            {unused.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-1 text-graphite">
                <span className="w-3 h-3 rounded-sm shrink-0 border border-shadow" />
                <span className="flex-1 min-w-0 truncate">{p.name}</span>
                <span className="tabular-nums">0</span>
                <span className="w-10" />
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-graphite">{t('sales.dash.productsNote')}</p>
        </div>
      )}
    </section>
  )
}

// Ring of slices with a 2px surface gap between them (the stroke).
function Donut({ slices, total, hover, onHover }) {
  const R = 80, r = 50, C = 88
  let angle = -Math.PI / 2
  const arc = (a0, a1) => {
    const large = a1 - a0 > Math.PI ? 1 : 0
    const p = (rad, a) => `${C + rad * Math.cos(a)} ${C + rad * Math.sin(a)}`
    return `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`
  }
  return (
    <svg viewBox="0 0 176 176" className="w-full h-full" role="img" aria-label={slices.map((s) => `${s.name} ${s.n}`).join(', ')}>
      {slices.length === 1 ? (
        <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke={slices[0].color} strokeWidth={R - r}
          onMouseEnter={() => onHover(slices[0])} onMouseLeave={() => onHover(null)} />
      ) : slices.map((s) => {
        const a0 = angle
        angle += (s.n / total) * Math.PI * 2
        return (
          <path key={s.id} d={arc(a0, angle)} fill={s.color} stroke={neutral.white} strokeWidth="2"
            opacity={hover && hover.id !== s.id ? 0.45 : 1}
            onMouseEnter={() => onHover(s)} onMouseLeave={() => onHover(null)}>
            <title>{`${s.name}: ${s.n}`}</title>
          </path>
        )
      })}
    </svg>
  )
}

// ── Deals won: Done "Deal Won" activities, by month of a year or by year.

function WonChart({ wonByMonth, loading }) {
  const { t, lang } = useT()
  const thisYear = Number(todayKey().slice(0, 4))
  const [mode, setMode] = useState('month') // 'month' | 'year'
  const [year, setYear] = useState(thisYear)
  const [hover, setHover] = useState(null)

  const keys = Object.keys(wonByMonth)
  const firstYear = Math.min(thisYear, ...keys.map((k) => Number(k.slice(0, 4))))
  const bars = mode === 'month'
    ? Array.from({ length: 12 }, (_, i) => {
        const k = `${year}-${String(i + 1).padStart(2, '0')}`
        const d = new Date(`${k}-01T00:00:00Z`)
        return {
          key: k,
          // 3 letters so all 12 fit on a phone ("Sep", not "Sept").
          label: lang === 'ko' ? `${i + 1}월` : d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }).slice(0, 3),
          full: d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
          n: wonByMonth[k] || 0,
        }
      })
    : Array.from({ length: thisYear - firstYear + 1 }, (_, i) => {
        const y = String(firstYear + i)
        return { key: y, label: y, full: y, n: keys.filter((k) => k.startsWith(y)).reduce((s, k) => s + wonByMonth[k], 0) }
      })
  const max = Math.max(1, ...bars.map((b) => b.n))
  const sum = bars.reduce((s, b) => s + b.n, 0)

  return (
    <section className="card !rounded-2xl !p-0 min-w-0">
      <div className="px-4 py-3 border-b border-shadow flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold flex-1">
          {t('sales.dash.won')}{mode === 'month' ? ` · ${year}` : ''} <span className="font-normal text-graphite">· {t('sales.dash.wonTotal', { n: sum })}</span>
        </h2>
        {mode === 'month' && (
          <div className="flex items-center">
            <button className="p-1 rounded hover:bg-iron disabled:opacity-30" disabled={year <= firstYear} onClick={() => setYear(year - 1)} aria-label={t('sales.dash.prevYear')}><ChevronLeft className="w-4 h-4" /></button>
            <button className="p-1 rounded hover:bg-iron disabled:opacity-30" disabled={year >= thisYear} onClick={() => setYear(year + 1)} aria-label={t('sales.dash.nextYear')}><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}
        <div className="flex rounded-lg border border-shadow overflow-hidden text-xs font-semibold">
          {['year', 'month'].map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 ${mode === m ? 'bg-near-black text-white' : 'text-graphite hover:bg-iron'}`}>
              {t(`sales.dash.by.${m}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={`relative p-4 ${loading ? 'opacity-60' : ''}`} onMouseLeave={() => setHover(null)}>
        {/* Bars hang from a shared baseline; value labels only on non-zero bars. */}
        <div className="flex items-end gap-1.5 h-56 border-b border-shadow">
          {bars.map((b) => (
            <div key={b.key} className="relative flex-1 h-full flex flex-col justify-end items-center cursor-default"
              onMouseEnter={() => setHover(b)}>
              {b.n > 0 && <span className="text-[11px] font-bold text-near-black tabular-nums mb-1">{b.n}</span>}
              <div className="w-full max-w-[36px] rounded-t-[4px] transition-opacity"
                style={{ height: b.n ? `${(b.n / max) * 85}%` : '2px', background: b.n ? BAR : chart.empty, opacity: hover && hover.key !== b.key ? 0.5 : 1 }} />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {bars.map((b) => <span key={b.key} className="flex-1 min-w-0 text-center text-[10px] sm:text-[11px] text-graphite">{b.label}</span>)}
        </div>
        {hover && (
          <div className="absolute top-3 right-4 rounded-xl bg-near-black text-white text-xs px-3 py-2 shadow-lg pointer-events-none">
            <p className="font-semibold">{hover.full}</p>
            <p className="tabular-nums">{t('sales.dash.wonTip', { n: hover.n })}</p>
          </div>
        )}
        {/* Table view for screen readers */}
        <table className="sr-only">
          <caption>{t('sales.dash.won')}</caption>
          <tbody>{bars.map((b) => <tr key={b.key}><th>{b.full}</th><td>{b.n}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}

// Which customers bought: the latest deals won (Done "Deal Won" activities)
// for the filters above, newest first.
function WinsCard({ wins, total, loading }) {
  const { t, lang } = useT()
  return (
    <section className={`card !rounded-2xl !p-0 overflow-hidden ${loading ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-shadow">
        <p className="font-semibold flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-warning-600" /> {t('sales.dash.wins')}
          <span className="text-graphite font-normal">· {t('sales.dash.winsTotal', { n: total })}</span>
        </p>
        {total > 0 && (
          <Link to="/sales?tab=sales&outcome=won" className="text-sm font-semibold text-wise-dark hover:underline flex items-center gap-1">
            {t('sales.dash.viewAll')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      {wins.length === 0 ? (
        <p className="px-4 py-6 text-sm text-graphite">{t('sales.dash.noWins')}</p>
      ) : (
        <ul className="divide-y divide-shadow">
          {wins.map((w) => (
            <li key={w.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <Link to={partyLink(w)} className="font-semibold text-wise-dark hover:underline truncate min-w-0 flex-1">{partyName(w)}</Link>
              <span className="text-graphite truncate hidden sm:block w-32">{w.product?.name || '—'}</span>
              <span className="text-graphite truncate w-24">{memberLabel(w.user, t('role.admin'))}</span>
              <span className="tabular-nums text-graphite w-20 text-right">{fmtDay(splitAt(w.wonAt).date, lang, { day: 'numeric', month: 'short' })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
