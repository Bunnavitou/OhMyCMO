// Sales planner lists and date helpers shared by the Sales page and forms.
// Must match the API (OhMyCMO_API/src/utils/activities.js).

// Activity types offered by "+ Add activity"; 'Other' lets the rep type
// their own (its title says what it was).
export const ACTIVITY_TYPES = [
  'New Lead', 'Call', 'Follow-up (Telegram/Email)', 'Meeting', 'Demo',
  'Proposal Sent', 'Negotiation', 'Deal Won', 'Deal Lost', 'Customer Care',
]
export const OTHER = 'Other'
export const STATUSES = ['New', 'Follow-up', 'Completed', 'Cancelled'] // sale
export const ACTIVITY_STATUSES = ['New', 'In progress', 'Done']        // activity
export const CHANNELS = ['Field visit', 'Office visit', 'Phone', 'Telegram', 'Email', 'Online meeting']

export const statusStyle = (s) =>
  s === 'Completed' ? 'bg-success-100 text-success-700'
  : s === 'Follow-up' ? 'bg-warning-100 text-warning-800'
  : s === 'Cancelled' ? 'bg-iron text-graphite line-through'
  : 'bg-brand-100 text-brand-700'

export const activityStyle = (s) =>
  s === 'Done' ? 'bg-success-100 text-success-700'
  : s === 'In progress' ? 'bg-info-100 text-info-700'
  : 'bg-iron text-near-black'

// Earliest due date among unfinished activities — the sale's due date when
// it is Follow-up without one of its own.
export const nextActivityDue = (activities) =>
  activities.filter((a) => a.status !== 'Done' && a.dueDate).map((a) => a.dueDate).sort()[0] || null

// "Meeting", or the typed name for an Other activity.
export const activityLabel = (a, t) =>
  a.type === OTHER ? a.title || t('activity.type.Other') : t(`activity.type.${a.type}`)

// What the user typed for the activity, else its type ("Demo").
export const activityName = (a, t) => a.title?.trim() || activityLabel(a, t)

export const followupStyle = (s) =>
  s === 'Overdue' ? 'text-danger-700 font-semibold'
  : s === 'Today' ? 'text-warning-700 font-semibold'
  : 'text-graphite'

// The team works in Phnom Penh (UTC+7, no daylight saving). Dates are plain
// 'YYYY-MM-DD' keys on its calendar, so a phone set to another time zone
// can't move a sale to another day.
const TZ = 'Asia/Phnom_Penh'
export const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
export const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : '')

// Instant → { date: 'YYYY-MM-DD', time: 'HH:mm' } in Phnom Penh.
export const splitAt = (iso) => {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-CA', { timeZone: TZ }),
    time: d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }),
  }
}
// Date + time typed in the form → ISO timestamp with the Phnom Penh offset.
export const joinAt = (date, time) => `${date}T${time || '09:00'}:00+07:00`

export const addDays = (key, n) => {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Monday of the week that contains `key` (weeks run Mon–Sun).
export const weekStart = (key) => {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay()
  return addDays(key, -((day + 6) % 7))
}
export const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i))

// 'Mon', 'Oct 14' etc. in the UI language, for a 'YYYY-MM-DD' key.
export const fmtDay = (key, lang, opts) =>
  key ? new Date(`${key}T00:00:00Z`).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-GB', { timeZone: 'UTC', ...opts }) : ''

// '09-Sep-2026' — the table's date style.
export const fmtDate = (key) => {
  if (!key) return ''
  const [y, , d] = key.split('-')
  const mon = new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short' })
  return `${d}-${mon}-${y}`
}

// Turns an API validation error into one readable line.
export const saleErrorText = (err, t) => {
  const d = err?.details?.[0]
  if (d?.path === 'body.dueDate') return t('sales.error.dueDate')
  if (d?.path?.startsWith('body.activities') && d.path.endsWith('title')) return t('sales.error.otherName')
  return d ? `${d.path.replace('body.', '')}: ${d.message}` : err?.message || t('sales.error.generic')
}

// Who a sale is with: the customer, or — before a Deal Won — a prospect
// (a Partner business card), shown by company with the person as fallback.
export const isProspect = (s) => !s.customerId && !!s.partnerId

// The deal's result: 'won' / 'lost' once a Deal Won / Deal Lost activity is
// Done, else null (still open). Same rule as the API's `outcome` filter.
export const saleOutcome = (s) => {
  const done = (type) => (s.activities || []).some((a) => a.type === type && a.status === 'Done')
  return done('Deal Won') ? 'won' : done('Deal Lost') ? 'lost' : null
}
export const partyName = (s) =>
  s.customer?.name || (s.partner ? s.partner.company || s.partner.name : '')
export const partyPhone = (s) => s.customer?.phone || s.partner?.phone || ''
export const partyLink = (s) => (s.customerId ? `/customers/${s.customerId}` : `/partners/${s.partnerId}`)

// Customer names that are probably the same company — "BNKC", "BNKC Bank
// Plc", "bnkc bank" — so winning a prospect can reuse one instead of making
// a near-duplicate. Ignores case, spaces, punctuation and company suffixes.
const SUFFIXES = new Set(['co', 'company', 'ltd', 'limited', 'plc', 'inc', 'corp', 'corporation', 'group', 'the'])
const normName = (s) =>
  (s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter((w) => w && !SUFFIXES.has(w)).join('')
// Same company once case, spaces, punctuation and suffixes are ignored.
export const sameCustomerName = (a, b) => normName(a) !== '' && normName(a) === normName(b)
export const similarCustomers = (customers, name) => {
  const n = normName(name)
  if (n.length < 2) return []
  return customers
    .map((c) => ({ c, m: normName(c.name) }))
    .filter(({ m }) => m && (m === n || (Math.min(m.length, n.length) >= 3 && (m.includes(n) || n.includes(m)))))
    .sort((a, b) => (a.m === n ? -1 : 0) - (b.m === n ? -1 : 0))
    .map(({ c }) => c)
    .slice(0, 5)
}
