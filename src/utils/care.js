import { todayKey } from './sales.js'

// Regular check-ins (care feature 4) — shared by Customer detail and the
// Weekly Plan.

// "in 5 days" / "due today" / "3 days overdue" for a check-in.
export function checkinWhen(checkIn, t) {
  const days = Math.round((Date.parse(checkIn.nextDue) - Date.parse(todayKey())) / 864e5)
  if (checkIn.status === 'overdue') return t('care.overdueBy', { count: -days })
  if (checkIn.status === 'due') return t('care.dueToday')
  return t('care.dueIn', { count: days })
}
