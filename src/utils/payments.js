import { todayKey, addDays } from './sales.js'

// Renewal & payment reminders (care proposal, feature 3). Same rules as the
// API's utils/health.js.

// Payment terms: a new invoice is due this many days after its date.
export const PAYMENT_TERMS_DAYS = 30
// An agreement ending within this many days needs attention.
export const RENEWAL_WARN_DAYS = 60

const daysFrom = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

export const defaultDueDate = (invoiceDate) => addDays(invoiceDate || todayKey(), PAYMENT_TERMS_DAYS)

// An invoice's payment: null when not tracked (invoices from before this
// feature carry no `payment`), else { state: 'paid' | 'unpaid' | 'overdue' }.
export function paymentState(e, today = todayKey()) {
  if (e?.payment === 'paid') return { state: 'paid', paidAt: e.paidAt || null }
  if (e?.payment !== 'unpaid') return null
  if (e.dueDate && e.dueDate < today) return { state: 'overdue', dueDate: e.dueDate, days: daysFrom(e.dueDate, today) }
  return { state: 'unpaid', dueDate: e.dueDate || null }
}

// An agreement's end (renewal) date: null when unset, else
// { state: 'later' | 'soon' | 'ended', days } — days until, or since, it ends.
export function renewalState(endDate, today = todayKey()) {
  if (!endDate) return null
  const days = daysFrom(today, endDate)
  if (days < 0) return { state: 'ended', days: -days }
  return { state: days <= RENEWAL_WARN_DAYS ? 'soon' : 'later', days }
}
