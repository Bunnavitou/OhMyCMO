import { Fragment, useState, useMemo, useRef, useEffect } from 'react'
import { Plus, FileBarChart, Pencil, Trash2, Save, AlertCircle, X, Download, Upload, Table2, FileDown, History, TrendingUp, Calendar } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { exportFullExcel, parseReportFile, downloadMonthlyTemplate } from '../utils/reportExcel.js'
import {
  collectTasks, memberName, statusStyle, sourceStyle, dueBucket, clampProgress, progressBarStyle,
} from '../utils/tasks.js'

// A report is a customizable table: fixed prev-year / current-year columns plus
// a DYNAMIC set of weekly/period columns (add/remove) that feed the auto-summed
// 합계. Headers and rows are editable and stored in `data` as { headers, rows }.
// New reports prefill the standard WeBill365 rows for the chosen account.
const ACCOUNTS = ['LM', 'SM']
const DEFAULT_WEEKS = 4

// Default rows per account: [i18n metric key, is-currency].
const DEFAULT_ROWS = {
  LM: [
    ['paymentCount', false],
    ['paymentAmount', true],
    ['feeAmount', true],
  ],
  SM: [
    ['billCount', false],
    ['billAmount', true],
    ['wePointFee', true],
    ['taxInvoice', true],
  ],
}

const newId = () => 'r' + Math.random().toString(36).slice(2, 9)
const yy = (year) => String((((year % 100) + 100) % 100)).padStart(2, '0')

// Filename timestamp: yyyyMMhhmmss (year, month, hours, minutes, seconds).
const ts = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

const isNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v))
const fmtFull = (v, money) => (isNum(v) ? (money ? '$' : '') + Number(v).toLocaleString('en-US') : '')
const weekTotal = (weeks) => {
  const vals = (weeks || []).filter(isNum).map(Number)
  return vals.length ? vals.reduce((s, n) => s + n, 0) : null
}

const normWeeks = (w, len) => {
  const out = Array.isArray(w) ? w.slice(0, len) : []
  while (out.length < len) out.push(null)
  return out
}

const defaultHeaders = (year, month, t) => ({
  category: t('report.hdr.category'),
  prevYear: t('report.hdr.prevYear', { yy: yy(year - 1) }),
  currentYear: t('report.hdr.year', { yy: yy(year) }),
  month: t('report.hdr.month', { m: month }),
  weeks: Array.from({ length: DEFAULT_WEEKS }, (_, i) => t('report.hdr.week', { m: month, w: i + 1 })),
  total: t('report.hdr.total'),
})

const defaultRows = (account, t) =>
  (DEFAULT_ROWS[account] || []).map(([key, money]) => ({
    id: newId(),
    label: t(`report.metric.${key}`),
    money,
    prevYear: null,
    currentYear: null,
    weeks: Array(DEFAULT_WEEKS).fill(null),
  }))

const buildInitialData = (account, year, month, t) => ({
  headers: defaultHeaders(year, month, t),
  rows: defaultRows(account, t),
})

// Row labels for the blank monthly template.
const defaultRowLabels = (account, t) => (DEFAULT_ROWS[account] || []).map(([key]) => t(`report.metric.${key}`))

// Normalize a stored report into { headers, rows }, tolerating the legacy
// metric-keyed data shape (from before rows were customizable).
const normalize = (report, t) => {
  const d = report.data || {}
  const dh = defaultHeaders(report.year, report.month, t)
  const sh = d.headers || {}
  const weeks = Array.isArray(sh.weeks) && sh.weeks.length ? sh.weeks.map((w) => String(w ?? '')) : dh.weeks
  const headers = {
    category: sh.category ?? dh.category,
    prevYear: sh.prevYear ?? dh.prevYear,
    currentYear: sh.currentYear ?? dh.currentYear,
    month: sh.month ?? dh.month,
    total: sh.total ?? dh.total,
    weeks,
  }
  const W = headers.weeks.length

  let rows
  if (Array.isArray(d.rows)) {
    rows = d.rows.map((r) => ({
      id: r.id || newId(),
      label: r.label || '',
      money: !!r.money,
      prevYear: r.prevYear ?? null,
      currentYear: r.currentYear ?? null,
      weeks: normWeeks(r.weeks, W),
      // Older years imported alongside prev/current (e.g. 2024 when the report is
      // 2025→2026). Kept as { [year]: value } so the combined view can show them.
      ...(r.extra && typeof r.extra === 'object' ? { extra: r.extra } : {}),
    }))
  } else {
    // Legacy: data keyed by metric → build rows from the account defaults.
    rows = (DEFAULT_ROWS[report.account] || []).map(([key, money]) => {
      const m = d[key] || {}
      return {
        id: newId(),
        label: t(`report.metric.${key}`),
        money,
        prevYear: m.prevYear ?? null,
        currentYear: m.currentYear ?? null,
        weeks: normWeeks(m.weeks, W),
      }
    })
  }
  return { headers, rows }
}

// Year-to-date auto totals for the '26 (current-year) column: for one
// account+year, the running sum of every month's weekly Total (per row label)
// through `uptoMonth`. The in-progress month counts as soon as W1–W4 are typed
// — the year column is a live roll-up of the weekly figures, which are now the
// only numbers anyone enters. This is added on top of any typed prior/opening
// amount left over from before those columns became read-only.
// `excludeId` skips one report — the editor passes its own id so it can add the
// live, unsaved weekly totals on top of the rest.
const ytdByLabel = (reports, account, year, uptoMonth, t, excludeId) => {
  const acc = {}
  for (const r of reports || []) {
    if (r.account !== account || r.year !== year || r.month > uptoMonth) continue
    if (r.id === excludeId || r.data?.imported) continue
    for (const row of normalize(r, t).rows) {
      const tot = weekTotal(row.weeks)
      if (tot == null) continue
      const label = row.label || '—'
      acc[label] = (acc[label] || 0) + tot
    }
  }
  return acc
}

// Per-label opening baseline for one account-year: the typed prior/opening
// amount stored on that year's most recent report. Those baselines are carried
// forward month to month by the auto-roll, so every month holds the SAME copy —
// they must never be summed, only read from the latest month.
const openingByLabel = (reports, account, year, t) => {
  let latest = null
  for (const r of reports || []) {
    if (r.account !== account || r.year !== year || r.data?.imported) continue
    if (!latest || r.month > latest.month) latest = r
  }
  if (!latest) return {}
  const out = {}
  for (const row of normalize(latest, t).rows) {
    if (isNum(row.currentYear)) out[row.label || '—'] = Number(row.currentYear)
  }
  return out
}

// What a whole account-year is worth, per row label: opening baseline plus every
// month's weekly total. This is the figure the FOLLOWING year shows in its
// previous-year column, which is why that column no longer needs typing.
const yearTotalsByLabel = (reports, account, year, t) => {
  const out = { ...openingByLabel(reports, account, year, t) }
  for (const [label, v] of Object.entries(ytdByLabel(reports, account, year, 12, t))) {
    out[label] = (out[label] || 0) + v
  }
  return out
}

// The '26 value actually shown. A typed value is a prior/opening amount (e.g.
// months not tracked week-by-week); the auto weekly YTD sum is ADDED on top of
// it. Empty typed field → pure auto sum. Both empty → blank.
const effectiveYear = (row, ytd) => {
  const base = isNum(row.currentYear) ? Number(row.currentYear) : null
  const auto = ytd?.[row.label || '—'] ?? null
  if (base == null && auto == null) return null
  return (base || 0) + (auto || 0)
}

// The two year figures a row actually shows. Previous year is last year's
// calculated total, with the stored value standing in only when there is
// nothing to calculate from; current year is any legacy opening amount plus
// this year's weekly roll-up. The grid and the Excel export both go through
// here so the sheet can never disagree with the screen.
const resolveYears = (row, yearMap, prevMap) => {
  const pDerived = prevMap ? prevMap[row.label || '—'] ?? null : null
  return {
    prevYear: pDerived != null ? pDerived : isNum(row.prevYear) ? Number(row.prevYear) : null,
    currentYear: effectiveYear(row, yearMap),
  }
}

// Build the combined "all years" table for one account by reading every report
// of that account: each report contributes its current-year figure (year N) and
// its previous-year figure (year N-1), so the full history is reconstructed and
// nothing is lost as new years are added. Rows are matched by label.
const buildCombined = (reports, account, t) => {
  const sorted = [...reports.filter((r) => r.account === account)].sort(
    (a, b) => b.year - a.year || b.month - a.month,
  )
  const order = [] // label order, from most-recent report
  const money = {} // label -> money flag
  const cell = {} // `label||year` -> { val, pri }  (pri: currentYear=2 beats prevYear=1)
  const years = new Set()

  const put = (label, year, val, pri) => {
    if (!isNum(val)) return
    years.add(year)
    const k = `${label}||${year}`
    const ex = cell[k]
    if (!ex || pri > ex.pri) cell[k] = { val: Number(val), pri }
  }

  for (const r of sorted) {
    const { rows } = normalize(r, t)
    const ytd = ytdByLabel(reports, account, r.year, r.month, t)
    for (const row of rows) {
      const label = row.label || '—'
      if (!(label in money)) {
        money[label] = row.money
        order.push(label)
      }
      put(label, r.year, effectiveYear(row, ytd), 2)
      put(label, r.year - 1, row.prevYear, 1)
      // Older years carried on the row (e.g. an imported 2024 column).
      for (const [y, v] of Object.entries(row.extra || {})) put(label, Number(y), v, 1)
    }
  }

  const yrs = [...years].sort((a, b) => a - b)
  const rows = order.map((label) => ({
    label,
    money: money[label],
    byYear: Object.fromEntries(yrs.map((y) => [y, cell[`${label}||${y}`]?.val ?? null])),
  }))
  return { years: yrs, rows }
}

// Read-only "all years" table: one column per year (compact figures).
function CombinedTable({ years, rows }) {
  const { t } = useT()
  const headBlue = 'bg-sky-100 text-near-black'
  if (!years.length || !rows.length) {
    return <p className="text-sm text-graphite py-2">{t('report.empty')}</p>
  }
  return (
    <div className="overflow-x-auto border border-shadow rounded-2xl">
      <table className="w-full text-sm border-collapse min-w-[360px]">
        <thead>
          <tr>
            <th className={`${headBlue} border border-shadow px-3 py-2 font-bold`}>{t('report.hdr.category')}</th>
            {years.map((y) => (
              <th key={y} className={`${headBlue} border border-shadow px-3 py-2 font-bold whitespace-nowrap`}>
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="border border-shadow px-3 py-2 font-semibold whitespace-nowrap">{r.label}</td>
              {years.map((y) => (
                <td key={y} className="border border-shadow px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {fmtFull(r.byYear[y], r.money)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Presentational grid (read-only or editable) ────────────────────────────
// Even in edit mode the two year columns are calculated, never typed: the
// previous-year column comes from last year's reports and the current-year one
// from this year's weekly figures. Only W1–W4 (and the labels/headers) are
// entered by hand.
function ReportGrid({ headers, rows, editable = false, on = {}, yearMap, prevMap }) {
  const { t } = useT()
  const headBlue = 'bg-sky-100 text-near-black'
  const hInput =
    'w-full min-w-[70px] bg-transparent text-center font-bold outline-none focus:bg-white rounded px-1 py-0.5'

  // Fixed column widths so every report table lines up column-for-column,
  // regardless of its content. Category + prev + current take 44%; the weeks
  // and Total split the remaining 56% evenly.
  const W = headers.weeks.length
  const wkPct = (56 / (W + 1)).toFixed(3)

  return (
    <div className="overflow-x-auto border border-shadow rounded-2xl">
      <table className="w-full text-sm border-collapse min-w-[760px] table-fixed">
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          {headers.weeks.map((_, i) => (
            <col key={i} style={{ width: `${wkPct}%` }} />
          ))}
          <col style={{ width: `${wkPct}%` }} />
        </colgroup>
        <thead>
          <tr>
            <th className={`${headBlue} border border-shadow px-2 py-2 font-bold`} rowSpan={2}>
              {editable ? (
                <input className={hInput} value={headers.category} onChange={(e) => on.header('category', e.target.value)} />
              ) : (
                headers.category
              )}
            </th>
            <th className={`${headBlue} border border-shadow px-2 py-2 font-bold whitespace-nowrap`} rowSpan={2}>
              {editable ? (
                <input className={hInput} value={headers.prevYear} onChange={(e) => on.header('prevYear', e.target.value)} />
              ) : (
                headers.prevYear
              )}
            </th>
            <th className={`${headBlue} border border-shadow px-2 py-2 font-bold whitespace-nowrap`} rowSpan={2}>
              {editable ? (
                <input className={hInput} value={headers.currentYear} onChange={(e) => on.header('currentYear', e.target.value)} />
              ) : (
                headers.currentYear
              )}
            </th>
            <th className={`${headBlue} border border-shadow px-2 py-2 font-bold text-center`} colSpan={headers.weeks.length + 1}>
              {editable ? (
                <input className={hInput} value={headers.month} onChange={(e) => on.header('month', e.target.value)} />
              ) : (
                headers.month
              )}
            </th>
          </tr>
          <tr>
            {headers.weeks.map((wLabel, i) => (
              <th key={i} className={`${headBlue} border border-shadow px-2 py-2 font-bold whitespace-nowrap`}>
                {editable ? (
                  <input className={hInput} value={wLabel} onChange={(e) => on.weekHeader(i, e.target.value)} />
                ) : (
                  wLabel
                )}
              </th>
            ))}
            <th className={`${headBlue} border border-shadow px-2 py-2 font-bold`}>
              {editable ? (
                <input className={hInput} value={headers.total} onChange={(e) => on.header('total', e.target.value)} />
              ) : (
                headers.total
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const total = weekTotal(row.weeks)
            const { prevYear: pEff, currentYear: yEff } = resolveYears(row, yearMap, prevMap)
            return (
              <tr key={row.id}>
                {/* Row label (+ format toggle + delete in edit mode) */}
                <td className="border border-shadow px-2 py-1.5 font-semibold break-words">
                  {editable ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => on.row(row.id, { money: !row.money })}
                        title={row.money ? 'Currency ($)' : 'Count (#)'}
                        className="w-6 h-6 shrink-0 rounded border border-shadow text-xs font-bold text-graphite hover:bg-iron"
                      >
                        {row.money ? '$' : '#'}
                      </button>
                      <input
                        className="flex-1 min-w-[90px] bg-transparent outline-none focus:bg-brand-50 rounded px-1 py-0.5"
                        value={row.label}
                        onChange={(e) => on.row(row.id, { label: e.target.value })}
                        placeholder="—"
                      />
                      <button
                        type="button"
                        onClick={() => on.deleteRow(row.id)}
                        aria-label="Delete row"
                        className="w-6 h-6 shrink-0 rounded text-rose-500 hover:bg-rose-50 inline-flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    row.label
                  )}
                </td>

                <NumCell
                  editable={false}
                  raw={pEff}
                  display={fmtFull(pEff, row.money)}
                  title={editable ? t('report.prevYear.auto') : undefined}
                  strong
                  muted
                />
                <NumCell
                  editable={false}
                  raw={yEff}
                  display={fmtFull(yEff, row.money)}
                  title={editable ? t('report.year.auto') : undefined}
                  strong
                />
                {row.weeks.map((w, i) => (
                  <NumCell
                    key={i}
                    editable={editable}
                    raw={w}
                    display={fmtFull(w, row.money)}
                    onChange={(v) => {
                      const weeks = row.weeks.slice()
                      weeks[i] = v
                      on.row(row.id, { weeks })
                    }}
                  />
                ))}
                <td className="border border-shadow px-2 py-1.5 text-right font-bold text-blue-700 whitespace-nowrap tabular-nums">
                  {fmtFull(total, row.money)}
                </td>
              </tr>
            )
          })}
          {editable && rows.length === 0 && (
            <tr>
              <td colSpan={headers.weeks.length + 4} className="border border-shadow px-3 py-4 text-center text-graphite text-xs">
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function NumCell({ editable, raw, display, onChange, strong, muted, title }) {
  if (!editable) {
    return (
      <td
        title={title}
        className={`border border-shadow px-2 py-1.5 text-right whitespace-nowrap tabular-nums ${
          strong ? 'font-bold' : ''
        } ${muted ? 'text-graphite' : 'text-near-black'} ${title ? 'bg-iron/40 cursor-help' : ''}`}
      >
        {display}
      </td>
    )
  }
  return (
    <td className="border border-shadow p-0">
      <input
        type="number"
        step="any"
        value={raw ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full min-w-[84px] px-2 py-1.5 text-right tabular-nums bg-transparent outline-none focus:bg-brand-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </td>
  )
}

export default function Reports() {
  const { state, addReport, updateReport, removeReport, fetchReportLogs } = useStore()
  const { t } = useT()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [previewId, setPreviewId] = useState(null)
  const [chartReportId, setChartReportId] = useState(null)
  const [view, setView] = useState('usage') // 'usage' | 'team'
  const [error, setError] = useState('')
  // List filters. Defaults to every account for the current month, so the page
  // still opens on "now"; month 0 means the whole year, account '' means all.
  const [fAccount, setFAccount] = useState('')
  const [fYear, setFYear] = useState(() => new Date().getFullYear())
  const [fMonth, setFMonth] = useState(() => new Date().getMonth() + 1)

  const errText = (e) => (e?.status === 403 ? t('report.error.forbidden') : e?.message || t('report.error.generic'))

  const reports = useMemo(
    () =>
      [...(state.reports || [])].sort(
        (a, b) => b.year - a.year || b.month - a.month || a.account.localeCompare(b.account),
      ),
    [state.reports],
  )

  // Monthly reports, newest first. Every month ever created stays listed —
  // finished months are history, not clutter — and the period filter below is
  // how you narrow down to one. Imported annual-history reports are excluded
  // here (they live in the "All years" view) but still feed the year columns.
  const monthlyReports = useMemo(() => reports.filter((r) => !r.data?.imported), [reports])

  // Years offered by the filter: every year that has a report, plus the current
  // one so a fresh install can still pick "now".
  const filterYears = useMemo(() => {
    const set = new Set(monthlyReports.map((r) => r.year))
    set.add(new Date().getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [monthlyReports])

  const visibleReports = useMemo(
    () =>
      monthlyReports.filter(
        (r) =>
          (!fAccount || r.account === fAccount) &&
          r.year === Number(fYear) &&
          (!fMonth || r.month === Number(fMonth)),
      ),
    [monthlyReports, fAccount, fYear, fMonth],
  )

  const editing = editingId ? reports.find((r) => r.id === editingId) : null
  const previewing = previewId ? reports.find((r) => r.id === previewId) : null
  const charting = chartReportId ? reports.find((r) => r.id === chartReportId) : null

  // Auto-roll to the current calendar month. For every account with any prior
  // report, ensure a card exists for the current month with empty W1–W4 (row
  // labels / money flags carried from the latest report). Across a YEAR boundary
  // it also stores the finished prior year's total as the new prev-year value.
  // That column is calculated from last year's reports now, so the stored copy
  // is only a fallback for years with no reports left to add up. Accounts never
  // used are left alone.
  const autoRolled = useRef(new Set())
  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    for (const account of ACCOUNTS) {
      const mine = (state.reports || []).filter((r) => r.account === account && !r.data?.imported)
      if (!mine.length) continue // never used this account → nothing to roll from
      if (mine.some((r) => r.year === y && r.month === m)) continue // current month already there
      const key = `${account}-${y}-${m}`
      if (autoRolled.current.has(key)) continue
      autoRolled.current.add(key)

      const sameYear = mine.filter((r) => r.year === y)
      const crossingYear = sameYear.length === 0 // this is the first card of a new year
      const pool = crossingYear ? mine : sameYear
      const template = [...pool].sort((a, b) => b.year - a.year || b.month - a.month)[0]
      // Starting a new year: the prev-year column = the prior year's finished
      // total (all its months are complete now), per row.
      const priorYtd = crossingYear ? ytdByLabel(state.reports, account, template.year, 12, t) : null

      const rows = normalize(template, t).rows.map((row) => ({
        id: newId(),
        label: row.label,
        money: row.money,
        prevYear: crossingYear ? effectiveYear(row, priorYtd) : row.prevYear ?? null,
        // Within a year, carry the '26 opening baseline forward so the running
        // total stays continuous (completed months keep adding on top). A new
        // year starts its own '26 fresh (the prior total went to prevYear above).
        currentYear: crossingYear ? null : row.currentYear ?? null,
        weeks: Array(DEFAULT_WEEKS).fill(null),
      }))
      addReport({ account, year: y, month: m, data: { headers: defaultHeaders(y, m, t), rows } }).catch(() => {})
    }
  }, [state.reports, addReport, t])

  const onCreate = async ({ account, year, month, data }) => {
    // Only one report per account+year+month. Refuse to override an existing
    // one — the user must edit or delete it instead. Throws so CreateForm shows
    // the reason inline (for both the manual and the import paths).
    const existing = (state.reports || []).find(
      (r) => r.account === account && r.year === year && r.month === month && !r.data?.imported,
    )
    if (existing) {
      throw new Error(
        t('report.error.exists', {
          account: t(`report.account.${account}`),
          year,
          month: String(month).padStart(2, '0'),
        }),
      )
    }
    const finalData = data || buildInitialData(account, year, month, t)
    const created = await addReport({ account, year, month, data: finalData })
    // Move the filters onto what was just created, otherwise a report for an
    // older month or the other account would be saved straight out of view.
    // The account filter is only widened when it would hide the new report.
    if (fAccount && fAccount !== account) setFAccount('')
    setFYear(year)
    setFMonth(month)
    setCreateOpen(false)
    if (created?.id) setEditingId(created.id)
  }

  // Download the full form for ONE report: all year columns PLUS this report's
  // month/week breakdown. Both the year rows and the weekly rows are anchored to
  // the report the user clicked, so the file mirrors exactly what they created.
  const onExport = (report) => {
    const combined = buildCombined(reports, report.account, t)
    const norm = normalize(report, t)
    // Bake the calculated year columns into the exported rows — the stored
    // prev/current values are stale leftovers and must not reach the sheet.
    const yearMap = ytdByLabel(reports, report.account, report.year, report.month, t)
    const prevMap = yearTotalsByLabel(reports, report.account, report.year - 1, t)
    const monthly = { ...norm, rows: norm.rows.map((r) => ({ ...r, ...resolveYears(r, yearMap, prevMap) })) }
    const rows = alignRows(combined.rows, monthly.rows)
    exportFullExcel(report.account, { years: combined.years, rows }, monthly, `report-${ts()}`).catch((e) =>
      setError(e?.message || t('report.error.generic')),
    )
  }

  // Blank monthly template for the chosen account/year/month.
  const onTemplate = (account, year, month) => {
    const headers = defaultHeaders(year, month, t)
    downloadMonthlyTemplate(headers, defaultRowLabels(account, t), `report-template-${ts()}`).catch((e) =>
      setError(e?.message || t('report.error.generic')),
    )
  }

  // Seed multi-year history from an uploaded "all years" sheet: create (or
  // update) one year-end report per year, chaining prev/current-year values so
  // the All-years view reconstructs the full history (2024, 2025, 2026, …).
  // Rethrow so the editor can show the failure inline (the page-level banner is
  // hidden behind the open modal). On success we close the modal. Merge onto the
  // existing data so fields the editor doesn't manage (e.g. the `imported` flag)
  // are preserved rather than wiped.
  const onSave = async (data) => {
    await updateReport(editing.id, { data: { ...(editing.data || {}), ...data } })
    setEditingId(null)
  }

  const onDelete = async (r) => {
    if (!confirm(t('report.delete.confirm'))) return
    setError('')
    try {
      await removeReport(r.id)
      if (editingId === r.id) setEditingId(null)
    } catch (e) {
      setError(errText(e))
    }
  }

  return (
    <>
      <PageHeader
        subtitle={t('report.subtitle')}
        action={
          view === 'usage' ? (
            <button onClick={() => setCreateOpen(true)} className="btn-primary !px-3 !py-2">
              <Plus className="w-4 h-4" /> {t('report.new')}
            </button>
          ) : null
        }
      />

      {/* Tabs: WeBill365 usage reports vs. per-member task reports */}
      <div className="mb-5 flex gap-1 border-b border-shadow">
        {[
          ['usage', t('report.tab.usage')],
          ['team', t('report.tab.team')],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
              view === key ? 'border-near-black text-near-black' : 'border-transparent text-graphite hover:text-near-black'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'team' && <TeamTaskReport />}

      {view === 'usage' && error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 text-xs font-semibold">✕</button>
        </div>
      )}

      {/* Filters — account, then the year and one month or the whole year. */}
      {view === 'usage' && monthlyReports.length > 0 && (
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="report-filter-account">{t('report.account')}</label>
            <select
              id="report-filter-account"
              className="input !py-2"
              value={fAccount}
              onChange={(e) => setFAccount(e.target.value)}
            >
              <option value="">{t('report.filter.allAccounts')}</option>
              {ACCOUNTS.map((a) => (
                <option key={a} value={a}>{t(`report.account.${a}.short`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="report-filter-year">{t('report.year')}</label>
            <select
              id="report-filter-year"
              className="input !py-2"
              value={fYear}
              onChange={(e) => setFYear(Number(e.target.value))}
            >
              {filterYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="report-filter-month">{t('report.month')}</label>
            <select
              id="report-filter-month"
              className="input !py-2"
              value={fMonth}
              onChange={(e) => setFMonth(Number(e.target.value))}
            >
              <option value={0}>{t('report.filter.allMonths')}</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
          <p className="pb-2 text-xs text-graphite">
            {t('report.filter.count', { n: visibleReports.length })}
          </p>
        </div>
      )}

      {view === 'usage' && (monthlyReports.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title={t('report.title')}
          description={reports.length > 0 ? t('report.onlyHistory') : t('report.empty')}
          action={
            <button onClick={() => setCreateOpen(true)} className="btn-primary !px-3 !py-2">
              <Plus className="w-4 h-4" /> {t('report.new')}
            </button>
          }
        />
      ) : visibleReports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-shadow px-4 py-8 text-center text-sm text-graphite">
          {t('report.filter.none')}
        </p>
      ) : (
        <div className="space-y-6">
          {visibleReports.map((r) => {
            const { headers, rows } = normalize(r, t)
            const yearMap = ytdByLabel(reports, r.account, r.year, r.month, t)
            const prevMap = yearTotalsByLabel(reports, r.account, r.year - 1, t)
            return (
              <section key={r.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base md:text-lg font-bold">
                    {t(`report.account.${r.account}`)}{' '}
                    <span className="text-graphite font-semibold">
                      · {r.year}-{String(r.month).padStart(2, '0')}
                    </span>
                  </h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setChartReportId(r.id)}
                      className="p-2 rounded-full hover:bg-iron text-graphite"
                      aria-label={t('report.chart')}
                      title={t('report.chart')}
                    >
                      <TrendingUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPreviewId(r.id)}
                      className="p-2 rounded-full hover:bg-iron text-graphite"
                      aria-label={t('report.preview')}
                      title={t('report.preview')}
                    >
                      <Table2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onExport(r)}
                      className="p-2 rounded-full hover:bg-iron text-graphite"
                      aria-label={t('report.export')}
                      title={t('report.export')}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(r.id)}
                      className="p-2 rounded-full hover:bg-iron text-graphite"
                      aria-label={t('report.edit')}
                      title={t('report.edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(r)}
                      className="p-2 rounded-full hover:bg-rose-50 text-rose-500"
                      aria-label={t('common.delete')}
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <ReportGrid headers={headers} rows={rows} yearMap={yearMap} prevMap={prevMap} />
              </section>
            )
          })}
        </div>
      ))}

      {/* Activity history — hidden entirely until there is activity. */}
      {view === 'usage' && <ReportHistory fetchReportLogs={fetchReportLogs} />}

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setError('') }} title={t('report.new')}>
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}
        <CreateForm onSubmit={onCreate} onTemplate={onTemplate} />
      </Modal>

      {editing && (
        <Modal open onClose={() => setEditingId(null)} title={t(`report.account.${editing.account}`)} size="4xl">
          <ReportEditor key={editing.id} report={editing} reports={reports} onSave={onSave} onDelete={() => onDelete(editing)} />
        </Modal>
      )}

      {previewing && (
        <Modal
          open
          onClose={() => setPreviewId(null)}
          title={t('report.preview')}
          size="4xl"
        >
          <ReportPreview report={previewing} reports={reports} />
        </Modal>
      )}

      {charting && (
        <Modal
          open
          onClose={() => setChartReportId(null)}
          title={`${t(`report.account.${charting.account}`)} · ${t('report.chart')}`}
          size="3xl"
        >
          <ReportChart report={charting} reports={reports} />
        </Modal>
      )}
    </>
  )
}

// Full date + time for each history entry, e.g. "Jul 28, 2026, 14:30".
const formatLogTime = (ts) =>
  new Date(ts).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

// Month axis label: "07월" in Korean, "Jul" in English.
const monthLabel = (year, month, lang) =>
  lang === 'ko'
    ? `${String(month).padStart(2, '0')}월`
    : new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' })

// Catmull-Rom → cubic-bézier smoothing for a gentle curve through the points.
const buildSmoothPath = (p) => {
  if (!p.length) return ''
  if (p.length === 1) return `M${p[0].x},${p[0].y}`
  let d = `M${p[0].x},${p[0].y}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

// Last-6-months transaction-count trend for one report. Read-only: every month
// comes from that month's own report — its transaction-count row's weekly total.
// A month with no report is simply a gap in the line; there is nothing to enter.
const ymKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`

// The transaction-count row of a report: the one carrying `label` if it has it,
// otherwise the first count row (money === false). Matching on the label keeps
// the series on the same metric even when a month's rows were reordered.
const countRowOf = (rows, label) =>
  (label && rows.find((r) => r.label === label && !r.money)) || rows.find((r) => !r.money) || rows[0] || null

function ReportChart({ report, reports }) {
  const { t, lang } = useT()

  const norm = useMemo(() => normalize(report, t), [report, t])
  const countLabel = countRowOf(norm.rows)?.label || ''

  // Monthly totals for this account, keyed YYYY-MM. Imported annual history has
  // no weekly breakdown, so it contributes nothing here.
  const autoByKey = useMemo(() => {
    const out = {}
    for (const r of reports || []) {
      if (r.account !== report.account || r.data?.imported) continue
      const row = countRowOf(normalize(r, t).rows, countLabel)
      const tot = row ? weekTotal(row.weeks) : null
      if (tot != null) out[ymKey(r.year, r.month)] = tot
    }
    return out
  }, [reports, report.account, countLabel, t])

  // The six months ending at this report's month.
  const months = useMemo(() => {
    const out = []
    for (let k = 5; k >= 0; k--) {
      let m = report.month - k
      let y = report.year
      while (m <= 0) { m += 12; y -= 1 }
      out.push({ y, m, key: ymKey(y, m) })
    }
    return out
  }, [report.year, report.month])

  const points = months.map((mo) => ({
    label: monthLabel(mo.y, mo.m, lang),
    value: autoByKey[mo.key] ?? null,
  }))

  return <AreaChartSVG points={points} money={false} />
}

// Dependency-free single-series area chart (SVG). Direct value labels on every
// point, matching the WeBill365 report look; app-green single hue.
function AreaChartSVG({ points, money }) {
  const { t } = useT()
  const vals = points.map((p) => p.value).filter((v) => v !== null && v !== undefined && !Number.isNaN(v))
  if (!vals.length) return <p className="py-8 text-center text-sm text-graphite">{t('report.chart.empty')}</p>

  const W = 760, H = 380
  const padL = 20, padR = 20, padT = 54, padB = 40
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const dmin = Math.min(...vals)
  const dmax = Math.max(...vals)
  const span = dmax - dmin || Math.abs(dmax) || 1
  const yMin = dmin - span * 0.45
  const yMax = dmax + span * 0.55
  const n = points.length
  const xOf = (i) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW)
  const yOf = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH

  const pts = points.map((p, i) => ({ ...p, i, x: xOf(i), y: p.value == null ? null : yOf(p.value) }))
  const linePts = pts.filter((p) => p.y !== null)
  const baseline = padT + plotH
  const line = buildSmoothPath(linePts)
  const area = linePts.length
    ? `${line} L${linePts[linePts.length - 1].x},${baseline} L${linePts[0].x},${baseline} Z`
    : ''
  const fmt = (v) => (money ? '$' : '') + Number(v).toLocaleString('en-US')
  const gridY = [0.25, 0.5, 0.75].map((f) => padT + f * plotH)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={t('report.chart')}>
      <rect x={padL} y={padT} width={plotW} height={plotH} rx="10" className="fill-iron" />
      {gridY.map((gy, k) => (
        <line key={k} x1={padL} x2={padL + plotW} y1={gy} y2={gy} stroke="#0E0F0C14" strokeWidth="1" />
      ))}
      <defs>
        <linearGradient id="reportAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9FE870" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#9FE870" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill="url(#reportAreaFill)" />}
      {line && (
        <path d={line} fill="none" stroke="#5A8C40" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {linePts.map((p) => (
        <g key={p.i}>
          <circle cx={p.x} cy={p.y} r="5" fill="#5A8C40" stroke="#FFFFFF" strokeWidth="2" />
          <text
            x={p.x}
            y={p.y - 14}
            textAnchor={p.i === 0 ? 'start' : p.i === n - 1 ? 'end' : 'middle'}
            className="fill-near-black"
            fontSize="15"
            fontWeight="700"
          >
            {fmt(p.value)}
          </text>
        </g>
      ))}
      {pts.map((p) => (
        <text key={p.i} x={p.x} y={H - 12} textAnchor="middle" className="fill-graphite" fontSize="14" fontWeight="600">
          {p.label}
        </text>
      ))}
    </svg>
  )
}

// ── Per-member task report ──────────────────────────────────────────────────
// Pick a team member and see all of their tasks (Customer + Partner + Marketing),
// split into Last Week / This Week / Next Plan. Read-only.
const STATUS_KEYS = ['Todo', 'In Progress', 'Done', 'Blocked']

function TeamTaskReport() {
  const { state } = useStore()
  const { t } = useT()
  const allTasks = useMemo(() => collectTasks(state), [state])
  const team = useMemo(() => state.team || [], [state.team])

  const [statusFilter, setStatusFilter] = useState('all') // 'all' | one of STATUS_KEYS

  // Default to the first member who has tasks (else the first member); an
  // explicit pick overrides it. Derived during render, not via setState.
  const defaultMemberId = useMemo(() => {
    const withTasks = team.find((m) => allTasks.some((tk) => tk.assigneeId === m.id))
    return (withTasks || team[0])?.id || ''
  }, [team, allTasks])
  const [picked, setPicked] = useState('')
  const memberId = picked || defaultMemberId

  // The columns split by status, not by date, so every one of the member's
  // tasks lands in one of them — no due-date scoping, and the chip counts
  // above always match what the columns below render.
  const tasks = useMemo(
    () => allTasks.filter((tk) => tk.assigneeId && tk.assigneeId === memberId),
    [allTasks, memberId],
  )

  // Per-status counts for the chips + the filtered list.
  const statusCounts = useMemo(() => {
    const c = { all: tasks.length, Todo: 0, 'In Progress': 0, Done: 0, Blocked: 0 }
    for (const tk of tasks) if (tk.status in c) c[tk.status] += 1
    return c
  }, [tasks])
  const filteredTasks = useMemo(
    () => (statusFilter === 'all' ? tasks : tasks.filter((tk) => tk.status === statusFilter)),
    [tasks, statusFilter],
  )

  if (!team.length) {
    return <p className="text-sm text-graphite">{t('report.team.noMembers')}</p>
  }

  return (
    <div className="space-y-4">
      {/* Member selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-semibold">{t('report.team.member')}</label>
        <select className="input !w-auto min-w-[200px]" value={memberId} onChange={(e) => setPicked(e.target.value)}>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {memberName(m)}
            </option>
          ))}
        </select>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {['all', ...STATUS_KEYS].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              statusFilter === s ? 'border-near-black bg-iron text-near-black' : 'border-shadow text-graphite hover:bg-iron'
            }`}
          >
            {s === 'all' ? t('report.team.all') : s}
            <span className="ml-1 text-graphite">{statusCounts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <TaskOutline tasks={filteredTasks} />
    </div>
  )
}

// Local YYYY-MM-DD. Deliberately not toISOString().slice(0,10): that is UTC,
// which would roll a Sunday-evening completion into next week for anyone east
// or west of it. Week boundaries have to match the calendar the user reads.
const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Monday (YYYY-MM-DD) of the current week — the cutoff between the columns.
const thisMonday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoDate(d)
}

// Which column a task belongs to.
//   Todo / In Progress → This Week; still actionable.
//   Blocked            → Last Week; stuck, and it needs reporting.
//   Done               → This Week while it was completed during the current
//                        week, moving to Last Week from next Monday onward.
// A Done task whose doneAt is missing or unparseable can't be placed in time —
// legacy rows finished before the stamp existed — so it counts as older work.
const isLastWeekTask = (tk, monday) => {
  if (tk.status === 'Blocked') return true
  if (tk.status !== 'Done') return false
  if (!tk.doneAt) return true
  const d = new Date(tk.doneAt)
  if (Number.isNaN(d.getTime())) return true
  return isoDate(d) < monday
}

// "Overdue" is not a status — dueBucket derives it from the due date, and it
// never applies to a Done task. It replaces the status on a task's badge so
// late work is visible at a glance inside its company group.
//
// Only the This Week column flags it (`flagOverdue`). Last Week is Done and
// Blocked, and calling a blocked task late says nothing useful: it's already
// stuck, whether or not its date has passed.
const OVERDUE_KEY = 'Overdue'
const statusKeyFor = (tk, flagOverdue) =>
  flagOverdue && dueBucket(tk.due, tk.status) === 'overdue' ? OVERDUE_KEY : (tk.status || 'Todo')

// Overdue borrows the rose treatment the due-date text already uses. Blocked
// shares that palette but lives in the other column, so they never sit
// side by side.
const statusBadgeStyle = (key) => (key === OVERDUE_KEY ? 'bg-rose-100 text-rose-700' : statusStyle(key))

// The company a task belongs to. Falls back to the owner's own name, then to a
// placeholder, so a task always has a group to sit in rather than vanishing.
const UNNAMED_COMPANY = '—'
const companyOf = (tk) => tk.ownerCompany || tk.ownerName || UNNAMED_COMPANY

// A single task line: bold title + status badge, completion percentage
// right-aligned, description beneath. The company is not repeated here — it's
// the group heading above.
function TaskLine({ tk, flagOverdue = false, onOpen }) {
  const { t } = useT()
  const desc = (tk.description || '').trim()
  const bullet = desc ? `- ${desc.replace(/^[-•]\s*/, '')}` : ''
  const pct = clampProgress(tk.progress)
  const statusKey = statusKeyFor(tk, flagOverdue)
  return (
    <li className="pl-1">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">
          {/* Opens the detail popup rather than navigating: the report is read
              end to end, and leaving the page lost the reader's place in it. */}
          <button
            type="button"
            onClick={() => onOpen(tk)}
            className="text-left font-semibold text-near-black hover:text-wise-dark hover:underline"
          >
            {tk.name || t('common.untitled')}
          </button>
          <span className={`ml-1.5 rounded-full px-1.5 py-px text-[10px] font-semibold ${statusBadgeStyle(statusKey)}`}>
            {statusKey === OVERDUE_KEY ? t('report.team.overdue') : statusKey}
          </span>
        </span>
        <span
          className={`shrink-0 text-xs font-bold tabular-nums ${pct >= 100 ? 'text-emerald-700' : 'text-graphite'}`}
        >
          {pct}%
        </span>
      </div>
      {desc && <div className="mt-0.5 text-[13px] text-graphite whitespace-pre-wrap">{bullet}</div>}
    </li>
  )
}

// Company-grouped list, used by both week columns. Companies with the most work
// in this column lead; ties fall back to alphabetical so the order stays stable
// week to week instead of shuffling on every render, and the unnamed group
// sinks below real companies on a tie rather than winning on its dash. Each
// task keeps its status as a badge, since status is no longer the grouping axis.
function CompanyGroups({ tasks, flagOverdue = false, onOpen }) {
  const byCompany = new Map()
  for (const tk of tasks) {
    const name = companyOf(tk)
    if (!byCompany.has(name)) byCompany.set(name, [])
    byCompany.get(name).push(tk)
  }
  const groups = [...byCompany.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) =>
      b.items.length - a.items.length ||
      (a.name === UNNAMED_COMPANY) - (b.name === UNNAMED_COMPANY) ||
      a.name.localeCompare(b.name))

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.name}>
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide text-graphite">
              {g.name}
            </p>
            <span className="shrink-0 text-xs font-bold text-graphite tabular-nums">{g.items.length}</span>
          </div>
          <ul className="mt-1.5 ml-5 list-disc space-y-2 marker:text-graphite">
            {g.items.map((tk) => (
              <TaskLine key={tk.key} tk={tk} flagOverdue={flagOverdue} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// One week column (card): header with icon and title, then the company-grouped
// list. No roll-up figures — the per-task percentages carry the detail.
function WeekColumn({ title, icon: Icon, tasks, emptyText, flagOverdue = false, onOpen }) {
  return (
    <section className="rounded-2xl border border-shadow bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-shadow pb-2">
        <Icon className="h-4 w-4 text-graphite" />
        <h4 className="text-sm font-bold text-near-black">{title}</h4>
      </div>
      {tasks.length ? (
        <CompanyGroups tasks={tasks} flagOverdue={flagOverdue} onOpen={onOpen} />
      ) : (
        <p className="py-4 text-center text-sm text-graphite/60">{emptyText}</p>
      )}
    </section>
  )
}

// Text/outline view. This Week is the live picture — everything actionable plus
// whatever was finished during the current week, so completed work stays
// visible in the report it was completed for. Last Week is what carried over:
// blocked work, and anything completed before this Monday. Both columns group
// by company, and every task lands in exactly one of them.
function TaskOutline({ tasks }) {
  const { t } = useT()
  // The open task, with the column it was opened from — This Week flags overdue
  // work and Last Week doesn't, so the popup badge has to match the line clicked.
  const [detail, setDetail] = useState(null)
  const open = (flagOverdue) => (tk) => setDetail({ tk, flagOverdue })

  if (!tasks.length) return <p className="text-sm text-graphite">{t('report.team.noTasks')}</p>

  const monday = thisMonday()
  const lastWeek = tasks.filter((tk) => isLastWeekTask(tk, monday))
  const thisWeek = tasks.filter((tk) => !isLastWeekTask(tk, monday))

  return (
    <>
      <div className="grid grid-cols-1 gap-4 text-[15px] leading-relaxed md:grid-cols-2">
        <WeekColumn
          title={t('report.team.lastWeek')} icon={History} tasks={lastWeek}
          emptyText={t('report.team.emptyWeek')} onOpen={open(false)}
        />
        <WeekColumn
          title={t('report.team.thisWeek')} icon={Calendar} tasks={thisWeek}
          emptyText={t('report.team.emptyWeek')} flagOverdue onOpen={open(true)}
        />
      </div>

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={detail.tk.name || t('common.untitled')}>
          <TaskDetail tk={detail.tk} flagOverdue={detail.flagOverdue} />
        </Modal>
      )}
    </>
  )
}

// Read-only detail popup for one report line. Everything collectTasks knows
// about the task, in place — the point of the popup is to keep the reader on
// the report rather than sending them to the task's own page.
function TaskDetail({ tk, flagOverdue }) {
  const { t } = useT()
  const pct = clampProgress(tk.progress)
  const statusKey = statusKeyFor(tk, flagOverdue)
  const done = tk.doneAt ? new Date(tk.doneAt) : null
  const rows = [
    [t('report.team.company'), companyOf(tk)],
    [t('tasks.col.assignee'), tk.assignee],
    [t('tasks.field.due'), tk.due],
    [t('tasks.field.priority'), tk.priority],
    // Customer tasks call this a group, marketing posts a channel; the field is
    // the same slot in both, so one label would be wrong for one of them.
    [tk.source === 'marketing' ? t('tasks.field.channel') : t('customer.field.group'), tk.groupName],
    [t('tasks.col.createdBy'), tk.createdByName],
    [t('report.team.completedAt'), done && !Number.isNaN(done.getTime()) ? formatLogTime(tk.doneAt) : ''],
  ].filter(([, v]) => v)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`pill text-[10px] ${sourceStyle(tk.source)}`}>{tk.ownerLabel}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeStyle(statusKey)}`}>
          {statusKey === OVERDUE_KEY ? t('report.team.overdue') : statusKey}
        </span>
        <span className={`ml-auto text-sm font-bold tabular-nums ${pct >= 100 ? 'text-emerald-700' : 'text-graphite'}`}>
          {pct}%
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-iron">
        <div className={`h-full rounded-full ${progressBarStyle(pct)}`} style={{ width: `${pct}%` }} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-graphite">{label}</dt>
            <dd className="font-medium text-near-black">{value}</dd>
          </Fragment>
        ))}
      </dl>

      {tk.description && (
        <div>
          <p className="label">{t('tasks.field.description')}</p>
          <p className="whitespace-pre-wrap text-sm text-near-black">{tk.description}</p>
        </div>
      )}
    </div>
  )
}

// Activity log: who created / edited / deleted which report and when.
const HISTORY_PAGE_SIZE = 10

function ReportHistory({ fetchReportLogs }) {
  const { t } = useT()
  const [logs, setLogs] = useState(null)
  const [err, setErr] = useState('')
  const [count, setCount] = useState(HISTORY_PAGE_SIZE)

  useEffect(() => {
    let alive = true
    fetchReportLogs()
      .then((items) => alive && setLogs(items))
      .catch((e) => alive && setErr(e?.message || t('report.error.generic')))
    return () => {
      alive = false
    }
  }, [fetchReportLogs, t])

  // Hide the whole section while loading, on error, or when there is no
  // activity — the heading only appears once there is something to show.
  if (err || logs === null || !logs.length) return null

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-graphite" />
        <h2 className="display text-2xl md:text-3xl text-near-black">{t('report.history')}</h2>
      </div>
      <ul className="space-y-2">
        {logs.slice(0, count).map((l) => (
          <li key={l.id}>
            <div className="card !p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">
                  {t('report.action.' + l.action)} · {t(`report.account.${l.account}`)}{' '}
                  {l.year}-{String(l.month).padStart(2, '0')}
                </p>
                <p className="text-[11px] text-graphite mt-0.5">
                  {t('report.history.by')} {l.actorName || t('report.history.someone')}
                </p>
              </div>
              <span className="text-[10px] text-graphite shrink-0">{formatLogTime(l.ts)}</span>
            </div>
          </li>
        ))}
      </ul>
      {logs.length > count && (
        <button
          onClick={() => setCount((n) => n + HISTORY_PAGE_SIZE)}
          className="mt-3 w-full text-sm font-semibold text-wise-dark hover:underline text-center"
        >
          {t('tasks.activity.viewMore')}
        </button>
      )}
    </section>
  )
}

// Read-only full-year table for ONE report. Year columns are assembled from
// every report of this account (so past years are kept), but the ROW SET is
// anchored to the report the user opened — it mirrors exactly the rows they
// created, never stale rows carried by other reports.
function ReportPreview({ report, reports }) {
  const { t } = useT()
  const combined = buildCombined(reports, report.account, t)
  const rows = alignRows(combined.rows, normalize(report, t).rows)
  return <CombinedTable years={combined.years} rows={rows} />
}

// Reorder/filter combined year-rows to match a reference report's rows, so the
// output tracks exactly what that report contains (labels + order + money flag).
const alignRows = (combinedRows, refRows) => {
  const byLabel = Object.fromEntries(combinedRows.map((r) => [r.label, r]))
  return refRows.map(
    (rr) => byLabel[rr.label] || { label: rr.label, money: rr.money, byYear: {} },
  )
}

function CreateForm({ onSubmit, onTemplate }) {
  const { t } = useT()
  const now = new Date()
  const [account, setAccount] = useState('LM')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [busy, setBusy] = useState(false)
  const [importErr, setImportErr] = useState('')
  const fileRef = useRef(null)

  // Import a filled monthly template → create one report for this account/month.
  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setImportErr('')
    setBusy(true)
    try {
      const parsed = await parseReportFile(f)
      const Y = Number(year)
      // Map the sheet's year columns onto the report: the selected year → current,
      // the year before → previous, and any older years → `extra` (kept for the
      // combined view, e.g. a 2024 column on a 2025→2026 report).
      const rows = parsed.rows.map((r) => {
        const by = r.byYear || {}
        const extra = {}
        for (const [y, v] of Object.entries(by)) {
          const yn = Number(y)
          if (yn !== Y && yn !== Y - 1 && v !== null && v !== undefined) extra[yn] = v
        }
        return {
          id: newId(),
          label: r.label || '',
          money: !!r.money,
          prevYear: by[Y - 1] ?? null,
          currentYear: by[Y] ?? null,
          weeks: normWeeks(r.weeks, DEFAULT_WEEKS),
          ...(Object.keys(extra).length ? { extra } : {}),
        }
      })
      const data = { headers: defaultHeaders(Y, Number(month), t), rows }
      await onSubmit({ account, year: Y, month: Number(month), data })
    } catch (err) {
      setImportErr(err?.message || t('report.error.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setImportErr('')
        setBusy(true)
        try {
          await onSubmit({ account, year: Number(year), month: Number(month) })
        } catch (err) {
          setImportErr(err?.message || t('report.error.generic'))
        } finally {
          setBusy(false)
        }
      }}
      className="space-y-3"
    >
      <div>
        <label className="label">{t('report.account')}</label>
        <select className="input" value={account} onChange={(e) => setAccount(e.target.value)} disabled={busy}>
          {ACCOUNTS.map((a) => (
            <option key={a} value={a}>
              {t(`report.account.${a}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('report.year')}</label>
          <input className="input" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('report.month')}</label>
          <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      </div>

      {importErr && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{importErr}</span>
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        <Plus className="w-4 h-4" /> {t('report.new')}
      </button>

      {/* Or fill the monthly template and import it as this report */}
      <div className="rounded-xl border border-dashed border-shadow p-3 space-y-2">
        <p className="text-sm font-semibold">{t('report.import')}</p>
        <p className="text-[11px] text-graphite">{t('report.importMonthlyHint')}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => onTemplate(account, Number(year), Number(month))}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-shadow py-2 text-sm font-semibold text-graphite hover:bg-iron disabled:opacity-40"
          >
            <FileDown className="w-4 h-4" /> {t('report.template')}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-shadow py-2 text-sm font-semibold text-graphite hover:bg-iron disabled:opacity-40"
          >
            <Upload className="w-4 h-4" /> {busy ? t('common.saving') : t('report.import')}
          </button>
        </div>
      </div>
    </form>
  )
}

function ReportEditor({ report, reports, onSave, onDelete }) {
  const { t } = useT()
  const [form, setForm] = useState(() => normalize(report, t))
  const [busy, setBusy] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  // Live '26 year-to-date: sibling months (this report excluded) plus the
  // weekly totals being edited right now, so the auto value updates as you type.
  const base = useMemo(
    () => ytdByLabel(reports, report.account, report.year, report.month, t, report.id),
    [reports, report.account, report.year, report.month, report.id, t],
  )
  const yearMap = useMemo(() => {
    const m = { ...base }
    for (const row of form.rows) {
      const tot = weekTotal(row.weeks)
      if (tot == null) continue
      const label = row.label || '—'
      m[label] = (m[label] ?? 0) + tot
    }
    return m
  }, [base, form.rows])

  // Previous-year column: last year's calculated total. Nothing here depends on
  // the row being edited, so it is stable for the life of the modal.
  const prevMap = useMemo(
    () => yearTotalsByLabel(reports, report.account, report.year - 1, t),
    [reports, report.account, report.year, t],
  )

  const save = async () => {
    setSaveErr('')
    setBusy(true)
    try {
      await onSave(form)
    } catch (e) {
      setSaveErr(e?.status === 403 ? t('report.error.forbidden') : e?.message || t('report.error.generic'))
    } finally {
      setBusy(false)
    }
  }

  const on = {
    header: (field, value) => setForm((s) => ({ ...s, headers: { ...s.headers, [field]: value } })),
    weekHeader: (i, value) =>
      setForm((s) => {
        const weeks = s.headers.weeks.slice()
        weeks[i] = value
        return { ...s, headers: { ...s.headers, weeks } }
      }),
    row: (id, patch) =>
      setForm((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
    deleteRow: (id) => setForm((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== id) })),
  }

  const addRow = () =>
    setForm((s) => ({
      ...s,
      rows: [
        ...s.rows,
        { id: newId(), label: '', money: false, prevYear: null, currentYear: null, weeks: Array(s.headers.weeks.length).fill(null) },
      ],
    }))

  return (
    <div className="space-y-3">
      <ReportGrid headers={form.headers} rows={form.rows} editable on={on} yearMap={yearMap} prevMap={prevMap} />

      <p className="text-[11px] text-graphite">{t('report.editor.hint')}</p>

      <button
        type="button"
        onClick={addRow}
        disabled={busy}
        className="w-full rounded-xl border border-dashed border-shadow py-2 text-sm font-semibold text-graphite hover:bg-iron inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
      >
        <Plus className="w-4 h-4" /> {t('report.addRow')}
      </button>

      {saveErr && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{saveErr}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
          <Save className="w-4 h-4" /> {busy ? t('common.saving') : t('report.save')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="rounded-xl px-4 text-rose-600 hover:bg-rose-50 text-sm font-semibold border border-rose-100 inline-flex items-center gap-1.5 disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" /> {t('common.delete')}
        </button>
      </div>
    </div>
  )
}
