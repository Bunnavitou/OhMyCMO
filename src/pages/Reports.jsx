import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, FileBarChart, Pencil, Trash2, Save, AlertCircle, X, Download, Upload, Table2, FileDown, History, TrendingUp, Calendar, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { exportFullExcel, parseReportFile, downloadMonthlyTemplate } from '../utils/reportExcel.js'
import { collectTasks, memberName, statusStyle } from '../utils/tasks.js'

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
    for (const row of rows) {
      const label = row.label || '—'
      if (!(label in money)) {
        money[label] = row.money
        order.push(label)
      }
      put(label, r.year, row.currentYear, 2)
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
function ReportGrid({ headers, rows, editable = false, on = {} }) {
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
                  editable={editable}
                  raw={row.prevYear}
                  display={fmtFull(row.prevYear, row.money)}
                  onChange={(v) => on.row(row.id, { prevYear: v })}
                  strong
                  muted
                />
                <NumCell
                  editable={editable}
                  raw={row.currentYear}
                  display={fmtFull(row.currentYear, row.money)}
                  onChange={(v) => on.row(row.id, { currentYear: v })}
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

function NumCell({ editable, raw, display, onChange, strong, muted }) {
  if (!editable) {
    return (
      <td
        className={`border border-shadow px-2 py-1.5 text-right whitespace-nowrap tabular-nums ${
          strong ? 'font-bold' : ''
        } ${muted ? 'text-graphite' : 'text-near-black'}`}
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

  const errText = (e) => (e?.status === 403 ? t('report.error.forbidden') : e?.message || t('report.error.generic'))

  const reports = useMemo(
    () =>
      [...(state.reports || [])].sort(
        (a, b) => b.year - a.year || b.month - a.month || a.account.localeCompare(b.account),
      ),
    [state.reports],
  )

  // The monthly list hides imported annual-history reports (they live in the
  // "All years" view instead). `reports` (all) still feeds All-years.
  const visibleReports = useMemo(() => reports.filter((r) => !r.data?.imported), [reports])

  const editing = editingId ? reports.find((r) => r.id === editingId) : null
  const previewing = previewId ? reports.find((r) => r.id === previewId) : null
  const charting = chartReportId ? reports.find((r) => r.id === chartReportId) : null

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
    setCreateOpen(false)
    if (created?.id) setEditingId(created.id)
  }

  // Download the full form for ONE report: all year columns PLUS this report's
  // month/week breakdown. Both the year rows and the weekly rows are anchored to
  // the report the user clicked, so the file mirrors exactly what they created.
  const onExport = (report) => {
    const combined = buildCombined(reports, report.account, t)
    const monthly = normalize(report, t)
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
  // existing data so fields the editor doesn't manage (e.g. the chart's `trend`)
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

      {view === 'usage' && (visibleReports.length === 0 ? (
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
      ) : (
        <div className="space-y-6">
          {visibleReports.map((r) => {
            const { headers, rows } = normalize(r, t)
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
                <ReportGrid headers={headers} rows={rows} />
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
          <ReportEditor key={editing.id} report={editing} onSave={onSave} onDelete={() => onDelete(editing)} />
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
          <ReportChart
            report={charting}
            onSaveTrend={(trend) =>
              updateReport(charting.id, { data: { ...(charting.data || {}), trend } })
            }
          />
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

// Last-6-months transaction-count trend for one report. The latest month is
// auto (this report's monthly total for its transaction-count row); the five
// prior months are entered by the user and saved onto the report (data.trend).
const ymKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`

function ReportChart({ report, onSaveTrend }) {
  const { t, lang } = useT()

  // Transaction count = the report's first count row (money === false).
  const norm = useMemo(() => normalize(report, t), [report, t])
  const countRow = norm.rows.find((r) => !r.money) || norm.rows[0]
  const autoValue = countRow ? weekTotal(countRow.weeks) : null

  // The six months ending at this report's month; last one is auto.
  const months = useMemo(() => {
    const out = []
    for (let k = 5; k >= 0; k--) {
      let m = report.month - k
      let y = report.year
      while (m <= 0) { m += 12; y -= 1 }
      out.push({ y, m, key: ymKey(y, m), auto: k === 0 })
    }
    return out
  }, [report.year, report.month])

  const trend = report.data?.trend || {}
  const [inputs, setInputs] = useState(() =>
    Object.fromEntries(months.filter((mo) => !mo.auto).map((mo) => [mo.key, trend[mo.key] ?? ''])),
  )
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  const points = months.map((mo) => ({
    label: monthLabel(mo.y, mo.m, lang),
    value: mo.auto
      ? autoValue
      : inputs[mo.key] === '' || inputs[mo.key] == null
        ? null
        : Number(inputs[mo.key]),
  }))

  const setVal = (key, v) => {
    setInputs((s) => ({ ...s, [key]: v }))
    setSaved(false)
  }

  const save = async () => {
    setErr('')
    setBusy(true)
    try {
      const clean = {}
      for (const [k, v] of Object.entries(inputs)) {
        if (v !== '' && v != null && !Number.isNaN(Number(v))) clean[k] = Number(v)
      }
      await onSaveTrend(clean)
      setSaved(true)
    } catch (e) {
      setErr(e?.status === 403 ? t('report.error.forbidden') : e?.message || t('report.error.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <AreaChartSVG points={points} money={false} />

      <div>
        <p className="text-sm font-semibold mb-2">{t('report.chart.inputs')}</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {months.map((mo) => (
            <div
              key={mo.key}
              className={`rounded-xl border px-2.5 py-2 ${mo.auto ? 'border-wise-dark bg-mint-bg' : 'border-shadow'}`}
            >
              <label className="block text-[11px] font-semibold text-graphite mb-1">
                {monthLabel(mo.y, mo.m, lang)}
                {mo.auto && <span className="text-wise-dark"> · {t('report.chart.auto')}</span>}
              </label>
              {mo.auto ? (
                <p className="text-sm font-bold tabular-nums">
                  {autoValue == null ? '—' : Number(autoValue).toLocaleString('en-US')}
                </p>
              ) : (
                <input
                  type="number"
                  value={inputs[mo.key] ?? ''}
                  onChange={(e) => setVal(mo.key, e.target.value)}
                  placeholder="0"
                  className="w-full text-sm font-bold tabular-nums bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-graphite mt-1.5">{t('report.chart.hint')}</p>
      </div>

      {err && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{err}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">
          <Save className="w-4 h-4" /> {busy ? t('common.saving') : t('common.save')}
        </button>
        {saved && <span className="text-xs text-wise-dark font-semibold">{t('report.saved')}</span>}
      </div>
    </div>
  )
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

const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Monday & Sunday (YYYY-MM-DD) of the current week — the week boundaries.
const thisWeekBounds = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // back up to Monday
  const mon = isoDate(d)
  d.setDate(d.getDate() + 6) // Sunday
  return { mon, sun: isoDate(d) }
}

// A single task line: bold title + status badge, with the description beneath.
function TaskLine({ tk }) {
  const { t } = useT()
  const desc = (tk.description || '').trim()
  const bullet = desc ? `- ${desc.replace(/^[-•]\s*/, '')}` : ''
  return (
    <li className="pl-1">
      <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
        <Link to={tk.link} className="font-semibold text-near-black hover:text-wise-dark">
          {tk.name || t('common.untitled')}
        </Link>
        <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${statusStyle(tk.status)}`}>
          {tk.status}
        </span>
      </span>
      {desc && <div className="mt-0.5 text-[13px] text-graphite whitespace-pre-wrap">{bullet}</div>}
    </li>
  )
}

// Owner-grouped list for one week column.
function OutlineGroups({ tasks }) {
  const groups = []
  const byOwner = {}
  for (const tk of tasks) {
    const name = tk.ownerName || '—'
    if (!byOwner[name]) {
      byOwner[name] = { name, items: [] }
      groups.push(byOwner[name])
    }
    byOwner[name].items.push(tk)
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.name}>
          <p className="text-xs font-bold uppercase tracking-wide text-graphite">{g.name}</p>
          <ul className="mt-1.5 ml-5 list-disc space-y-2 marker:text-graphite">
            {g.items.map((tk) => (
              <TaskLine key={tk.key} tk={tk} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// One week column (card): header with icon + count, then the grouped list.
function WeekColumn({ title, icon: Icon, tasks, emptyText }) {
  return (
    <section className="rounded-2xl border border-shadow bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-shadow pb-2">
        <Icon className="h-4 w-4 text-graphite" />
        <h4 className="text-sm font-bold text-near-black">{title}</h4>
        <span className="ml-auto rounded-full bg-iron px-2 py-0.5 text-xs font-semibold text-graphite">
          {tasks.length}
        </span>
      </div>
      {tasks.length ? (
        <OutlineGroups tasks={tasks} />
      ) : (
        <p className="py-4 text-center text-sm text-graphite/60">{emptyText}</p>
      )}
    </section>
  )
}

// Text/outline view split by due date: Last Week (due before this Monday, incl.
// overdue) and This Week (due this week or no due date) side by side, with a
// Next Plan schedule list below (tasks due after this week).
function TaskOutline({ tasks }) {
  const { t } = useT()
  if (!tasks.length) return <p className="text-sm text-graphite">{t('report.team.noTasks')}</p>

  const { mon, sun } = thisWeekBounds()
  const lastWeek = tasks.filter((tk) => tk.due && tk.due < mon)
  const nextPlan = tasks.filter((tk) => tk.due && tk.due > sun)
  const thisWeek = tasks.filter((tk) => !(tk.due && (tk.due < mon || tk.due > sun)))

  return (
    <div className="space-y-4 text-[15px] leading-relaxed">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <WeekColumn title={t('report.team.lastWeek')} icon={History} tasks={lastWeek} emptyText={t('report.team.emptyWeek')} />
        <WeekColumn title={t('report.team.thisWeek')} icon={Calendar} tasks={thisWeek} emptyText={t('report.team.emptyWeek')} />
      </div>

      <section className="rounded-2xl border border-shadow bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-shadow pb-2">
          <ClipboardList className="h-4 w-4 text-graphite" />
          <h4 className="text-sm font-bold text-near-black">{t('report.team.nextPlan')}</h4>
          <span className="ml-auto rounded-full bg-iron px-2 py-0.5 text-xs font-semibold text-graphite">
            {nextPlan.length}
          </span>
        </div>
        {nextPlan.length ? (
          <ul className="ml-5 list-disc space-y-2 marker:text-graphite">
            {nextPlan.map((tk) => (
              <TaskLine key={tk.key} tk={tk} />
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-graphite/60">{t('report.team.emptyWeek')}</p>
        )}
      </section>
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

function ReportEditor({ report, onSave, onDelete }) {
  const { t } = useT()
  const [form, setForm] = useState(() => normalize(report, t))
  const [busy, setBusy] = useState(false)
  const [saveErr, setSaveErr] = useState('')

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
      <ReportGrid headers={form.headers} rows={form.rows} editable on={on} />

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
