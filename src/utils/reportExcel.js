// Lazy-loaded Excel export/import for WeBill365 usage reports. SheetJS is
// dynamically imported so its chunk only ships when a report is exported.
//
// Sheet layout (matches the on-screen table):
//   Row 1: [category | prevYear | currentYear | month .......... (merged) ]
//   Row 2: [   ↑     |    ↑      |     ↑       | week1 | … | weekN | total ]
//   Row 3+: data rows [label, prevYear, currentYear, ...weeks, total]

const isNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v))

const weekTotal = (weeks) => {
  const vals = (weeks || []).filter(isNum).map(Number)
  return vals.length ? vals.reduce((s, n) => s + n, 0) : null
}

// Parse a possibly-formatted cell ("$1,182,191", "308K") into a number or null.
const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null
  if (typeof v === 'number') return v
  let s = String(v).trim().replace(/[$,\s]/g, '')
  let mult = 1
  if (/[kK]$/.test(s)) { mult = 1e3; s = s.slice(0, -1) }
  else if (/[mM]$/.test(s)) { mult = 1e6; s = s.slice(0, -1) }
  const n = Number(s)
  return Number.isNaN(n) ? null : n * mult
}

export async function exportReportExcel(report, { headers, rows }, filenameBase = 'report') {
  const XLSX = await import('xlsx')
  const W = headers.weeks.length

  const aoa = []
  // Header row 1: category / prevYear / currentYear / month (+ blanks under the
  // merged month group spanning the week columns and the total).
  aoa.push([headers.category, headers.prevYear, headers.currentYear, headers.month, ...Array(W).fill('')])
  // Header row 2: week labels + total (first three cells covered by row-merges).
  aoa.push(['', '', '', ...headers.weeks, headers.total])
  // Data rows
  for (const row of rows) {
    const total = weekTotal(row.weeks)
    aoa.push([
      row.label || '',
      isNum(row.prevYear) ? Number(row.prevYear) : null,
      isNum(row.currentYear) ? Number(row.currentYear) : null,
      ...row.weeks.map((w) => (isNum(w) ? Number(w) : null)),
      isNum(total) ? total : null,
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // category
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // prevYear
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // currentYear
    { s: { r: 0, c: 3 }, e: { r: 0, c: 3 + W } }, // month spans weeks + total
  ]
  ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 14 }, ...Array(W).fill({ wch: 12 }), { wch: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, `${filenameBase}.xlsx`)
}

// Download a blank MONTHLY template matching a single report's layout:
//   [category | prevYear | currentYear | month .......... (merged) ]
//   [   ↑     |    ↑      |     ↑       | W1 | … | Wn | Total ]
// Row labels pre-filled, value cells empty. Re-importable via parseReportFile.
export async function downloadMonthlyTemplate(headers, rowLabels, filenameBase = 'report-template') {
  const XLSX = await import('xlsx')
  const W = headers.weeks.length
  const aoa = []
  aoa.push([headers.category, headers.prevYear, headers.currentYear, headers.month, ...Array(W).fill('')])
  aoa.push(['', '', '', ...headers.weeks, headers.total])
  for (const label of rowLabels) aoa.push([label, '', '', ...Array(W).fill(''), ''])
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
    { s: { r: 0, c: 3 }, e: { r: 0, c: 3 + W } },
  ]
  ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }, ...Array(W).fill({ wch: 12 }), { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, `${filenameBase}.xlsx`)
}

// Export the combined "all years" table for one account: a column per year.
export async function exportCombinedExcel(account, { years, rows }, categoryLabel = '구분', filenameBase = 'report-all-years') {
  const XLSX = await import('xlsx')
  const aoa = [[categoryLabel, ...years.map(String)]]
  for (const row of rows) {
    aoa.push([row.label || '', ...years.map((y) => (isNum(row.byYear[y]) ? Number(row.byYear[y]) : null))])
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 18 }, ...years.map(() => ({ wch: 14 }))]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, account)
  XLSX.writeFile(wb, `${filenameBase}.xlsx`)
}

// Export the FULL form: one column per year (all history) PLUS the latest
// month's weekly breakdown + total — mirroring the on-screen report layout.
//   combined = { years, rows:[{label, byYear}] }
//   monthly  = normalized latest report { headers:{category,month,weeks,total}, rows:[{label,weeks}] }
export async function exportFullExcel(account, combined, monthly, filenameBase = 'report-full') {
  const XLSX = await import('xlsx')
  const years = combined.years
  const N = years.length
  const weekLabels = monthly?.headers?.weeks || []
  const W = weekLabels.length
  const catLabel = monthly?.headers?.category || 'Category'
  const monthLabel = monthly?.headers?.month || ''
  const totalLabel = monthly?.headers?.total || 'Total'
  const weeksByLabel = Object.fromEntries((monthly?.rows || []).map((r) => [r.label, r.weeks || []]))

  const aoa = []
  // Header row 1: category + year columns + month group (spans weeks + total).
  aoa.push([catLabel, ...years.map(String), ...(W ? [monthLabel, ...Array(W).fill('')] : [])])
  // Header row 2: week labels + total (category/years covered by row-merges).
  aoa.push(['', ...years.map(() => ''), ...(W ? [...weekLabels, totalLabel] : [])])
  // Data rows
  for (const row of combined.rows) {
    const weeks = weeksByLabel[row.label] || []
    const wk = W ? Array.from({ length: W }, (_, i) => (isNum(weeks[i]) ? Number(weeks[i]) : null)) : []
    const total = W ? weekTotal(weeks) : null
    aoa.push([
      row.label,
      ...years.map((y) => (isNum(row.byYear[y]) ? Number(row.byYear[y]) : null)),
      ...(W ? [...wk, isNum(total) ? total : null] : []),
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }]
  for (let j = 1; j <= N; j++) merges.push({ s: { r: 0, c: j }, e: { r: 1, c: j } })
  if (W) merges.push({ s: { r: 0, c: 1 + N }, e: { r: 0, c: 1 + N + W } }) // month spans weeks + total
  ws['!merges'] = merges
  ws['!cols'] = [{ wch: 20 }, ...years.map(() => ({ wch: 12 })), ...(W ? [...Array(W).fill({ wch: 10 }), { wch: 12 }] : [])]

  // Number formats: amount rows as currency ($1,234), count rows with a
  // thousands separator. One data row per combined row, starting at sheet row 2.
  const lastNumCol = N + (W ? W + 1 : 0)
  combined.rows.forEach((row, i) => {
    const z = row.money ? '$#,##0' : '#,##0'
    for (let c = 1; c <= lastNumCol; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 2 + i, c })]
      if (cell && cell.t === 'n') cell.z = z
    }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, account)
  XLSX.writeFile(wb, `${filenameBase}.xlsx`)
}

// Extract a full year from a header cell: "24" → 2024, "'25 actual" → 2025,
// "'26" → 2026, "2024" → 2024. Returns null when the header has no number.
const yearFromHeader = (h) => {
  const m = String(h ?? '').match(/\d{2,4}/)
  if (!m) return null
  let y = Number(m[0])
  if (y < 100) y += 2000
  return y
}

// Parse a report .xlsx into { years, month, rows:[{label, money, byYear, weeks}] }.
// The layout is DYNAMIC: any number of year columns (e.g. 24 | '25 actual | '26)
// between the category and an optional "Month N" group (week columns + Total).
// It reads both the merged 2-row header our template emits (year labels in row 1)
// and the flattened form (year labels in row 2) users often produce by hand.
export async function parseReportFile(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  if (!wb.SheetNames.length) throw new Error('Empty workbook')
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })
  if (aoa.length < 3) throw new Error('Sheet has no recognizable report table')

  const r0 = (aoa[0] || []).map((c) => String(c ?? '').trim())
  const r1 = (aoa[1] || []).map((c) => String(c ?? '').trim())
  const width = Math.max(r0.length, r1.length)
  const top = (c) => r0[c] || ''
  const sub = (c) => r1[c] || ''
  const hdr = (c) => top(c) || sub(c) // flatten a merged 2-row header

  // The month super-header sits in row 1 above its week sub-headers in row 2:
  // the first column past the category where BOTH rows carry text.
  let monthCol = -1
  for (let c = 1; c < width; c++) {
    if (top(c) && sub(c)) { monthCol = c; break }
  }

  // Year columns: everything between the category and the month group.
  const yearEnd = monthCol >= 0 ? monthCol : width
  const yearCols = [] // [colIndex, year]
  for (let c = 1; c < yearEnd; c++) {
    const y = yearFromHeader(hdr(c))
    if (y !== null) yearCols.push([c, y])
  }

  // Week columns + Total (only present when there is a month group).
  const weekCols = []
  const weekLabels = []
  let month = ''
  let total = 'Total'
  if (monthCol >= 0) {
    month = top(monthCol)
    let totalCol = monthCol
    for (let c = monthCol; c < width; c++) if (sub(c)) totalCol = c // rightmost = Total
    total = sub(totalCol) || 'Total'
    for (let c = monthCol; c < totalCol; c++) {
      weekCols.push(c)
      weekLabels.push(sub(c) || String(weekCols.length))
    }
  }

  if (!yearCols.length && !weekCols.length) {
    throw new Error('No year or month columns found in the sheet')
  }

  const rows = []
  for (let i = 2; i < aoa.length; i++) {
    const r = aoa[i] || []
    const label = String(r[0] ?? '').trim()
    const dataCells = [...yearCols.map(([c]) => r[c]), ...weekCols.map((c) => r[c])]
    if (!label && dataCells.every((c) => c === '' || c === null || c === undefined)) continue
    const money = /\$/.test((r || []).map((c) => String(c ?? '')).join(''))
    const byYear = {}
    for (const [c, y] of yearCols) byYear[y] = numOrNull(r[c])
    const weeks = weekCols.map((c) => numOrNull(r[c]))
    rows.push({ label, money, byYear, weeks })
  }

  if (!rows.length) throw new Error('No data rows found in the sheet')
  const years = yearCols.map(([, y]) => y).sort((a, b) => a - b)
  return { years, month, total, weekLabels, rows }
}

// Parse an "all years" sheet — one column per 4-digit year (e.g. 구분 | 2024 |
// 2025 | 2026) — into { years, rows:[{ label, money, byYear:{year:val} }] }.
// Used to seed multi-year history from a single upload.
export async function parseCombinedFile(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  if (!wb.SheetNames.length) throw new Error('Empty workbook')
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })

  // Find the header row = the one with the most 4-digit year cells.
  const yearRe = /^(19|20)\d{2}$/
  let hdrIdx = -1
  let yearCols = []
  for (let i = 0; i < Math.min(aoa.length, 6); i++) {
    const cols = []
    ;(aoa[i] || []).forEach((c, ci) => {
      const s = String(c ?? '').trim()
      if (yearRe.test(s)) cols.push([ci, Number(s)])
    })
    if (cols.length > yearCols.length) {
      yearCols = cols
      hdrIdx = i
    }
  }
  if (hdrIdx < 0 || !yearCols.length) {
    throw new Error('No year columns (e.g. 2024, 2025, 2026) found in the sheet')
  }

  const rows = []
  for (let i = hdrIdx + 1; i < aoa.length; i++) {
    const r = aoa[i] || []
    const label = String(r[0] ?? '').trim()
    if (!label) continue
    const byYear = {}
    let money = false
    for (const [ci, y] of yearCols) {
      byYear[y] = numOrNull(r[ci])
      if (/\$/.test(String(r[ci] ?? ''))) money = true
    }
    rows.push({ label, money, byYear })
  }
  if (!rows.length) throw new Error('No data rows found in the sheet')

  const years = yearCols.map(([, y]) => y).sort((a, b) => a - b)
  return { years, rows }
}
