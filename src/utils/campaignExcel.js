// Lazy-loaded Excel/CSV import + template export for campaign post lists.
// SheetJS is dynamically imported so the ~280 KB chunk only ships when needed.

const HEADER_MAP = {
  postdate: 'postDate',
  date: 'postDate',
  postconcept: 'concept',
  concept: 'concept',
  posttype: 'type',
  type: 'type',
  channel: 'channel',
  postchannel: 'channel',
  platform: 'channel',
  keyfeature: 'keyFeature',
  feature: 'keyFeature',
  caption: 'caption',
  status: 'postStatus',
  poststatus: 'postStatus',
  state: 'postStatus',
}

const STATUS_NORMALIZE = {
  draft: 'draft',
  scheduled: 'scheduled',
  ready: 'scheduled',
  published: 'published',
  posted: 'published',
  done: 'published',
  complete: 'published',
  completed: 'published',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  skipped: 'cancelled',
}

const STATUS_LABEL = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  cancelled: 'Cancelled',
}

const TEMPLATE_HEADERS = [
  'Post Date',
  'Post Concept',
  'Post Type',
  'Channel',
  'Status',
  'Key Feature',
  'Caption',
]

const TEMPLATE_ROWS = [
  {
    'Post Date': '2026-05-01',
    'Post Concept': 'Founder story — why we built X',
    'Post Type': 'Reel',
    'Channel': 'Instagram',
    'Status': 'Draft',
    'Key Feature': 'Authenticity',
    'Caption': 'Hook + benefit + call-to-action goes here.',
  },
  {
    'Post Date': '2026-05-08',
    'Post Concept': 'Product demo',
    'Post Type': 'Video',
    'Channel': 'TikTok',
    'Status': 'Scheduled',
    'Key Feature': 'Speed of flow',
    'Caption': 'Watch us do it in 30 seconds.',
  },
]

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '')

const isoDate = (v) => {
  if (!v && v !== 0) return ''
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return isNaN(d) ? '' : d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  if (!s) return ''
  const d = new Date(s)
  if (!isNaN(d)) return d.toISOString().slice(0, 10)
  return s
}

function rowToTodo(row) {
  const out = {
    postDate: '',
    concept: '',
    type: 'Image',
    channel: '',
    keyFeature: '',
    caption: '',
    artwork: null,
    postStatus: 'draft',
  }
  for (const [k, v] of Object.entries(row || {})) {
    const target = HEADER_MAP[normalize(k)]
    if (!target) continue
    if (target === 'postDate') out.postDate = isoDate(v)
    else if (target === 'postStatus') {
      const norm = normalize(v)
      out.postStatus = STATUS_NORMALIZE[norm] || 'draft'
    }
    else out[target] = String(v == null ? '' : v).trim()
  }
  return out
}

export async function parsePostsFile(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  if (!wb.SheetNames.length) throw new Error('Empty workbook')
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', blankrows: false })
  const todos = rows
    .map(rowToTodo)
    .filter((t) => t.postDate || t.concept || t.caption) // skip empty rows
  return todos
}

const COL_WIDTHS = [
  { wch: 12 }, // Post Date
  { wch: 40 }, // Post Concept
  { wch: 12 }, // Post Type
  { wch: 14 }, // Channel
  { wch: 12 }, // Status
  { wch: 24 }, // Key Feature
  { wch: 60 }, // Caption
]

export async function downloadTemplate(filename = 'campaign-posts-template.xlsx') {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, { header: TEMPLATE_HEADERS })
  ws['!cols'] = COL_WIDTHS
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Posts')
  XLSX.writeFile(wb, filename)
}

export async function exportPostsExcel(campaign) {
  const XLSX = await import('xlsx')
  const rows = (campaign.todos || []).map((t) => ({
    'Post Date': t.postDate || '',
    'Post Concept': t.concept || '',
    'Post Type': t.type || '',
    'Channel': t.channel || '',
    'Status': STATUS_LABEL[t.postStatus] || 'Draft',
    'Key Feature': t.keyFeature || '',
    'Caption': t.caption || '',
  }))
  const ws = XLSX.utils.json_to_sheet(
    rows.length ? rows : [Object.fromEntries(TEMPLATE_HEADERS.map((h) => [h, '']))],
    { header: TEMPLATE_HEADERS },
  )
  ws['!cols'] = COL_WIDTHS
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Posts')
  const safeName = (campaign.name || 'campaign').replace(/[^A-Za-z0-9-_]+/g, '_')
  XLSX.writeFile(wb, `${safeName}-posts.xlsx`)
}
