// Shared task helpers used by the global Tasks board and the Home dashboard.
// Tasks live inside each customer / partner as opaque JSON, so all aggregation
// happens client-side from the store state.

export const TASK_STATUSES = ['Todo', 'In Progress', 'Done', 'Blocked']
export const TASK_PRIORITIES = ['High', 'Medium', 'Low']

// Marketing campaign posts (campaign.todos) use their own status vocabulary.
// We map them onto the 4 board columns so they sit alongside customer/partner
// tasks, and map back when the status is changed from the Tasks board.
export const POST_STATUS_TO_TASK = {
  draft: 'Todo',
  scheduled: 'In Progress',
  published: 'Done',
  cancelled: 'Blocked',
}
export const TASK_TO_POST_STATUS = {
  Todo: 'draft',
  'In Progress': 'scheduled',
  Done: 'published',
  Blocked: 'cancelled',
}
export const MARKETING_POST_TYPES = ['Image', 'Video', 'Carousel', 'Reel', 'Story', 'Article', 'Other']
export const MARKETING_POST_CHANNELS = [
  'Facebook', 'Instagram', 'TikTok', 'YouTube',
  'LinkedIn', 'X (Twitter)', 'Threads', 'Telegram', 'Other',
]

// Completion percentage. Stored as a plain 0-100 number on the task/post JSON
// (`progress`), edited with a slider that moves in TASK_PROGRESS_STEP jumps.
export const TASK_PROGRESS_STEP = 5

// Coerce anything stored on an older task (undefined, '', a string, out-of-range)
// into a valid 0-100 multiple of the step.
export function clampProgress(v) {
  const n = Math.round(Number(v) / TASK_PROGRESS_STEP) * TASK_PROGRESS_STEP
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

// Progress follows the status in one direction only: landing on Done (or a
// published post) means finished, so it snaps to 100. Every other status
// leaves the number alone, and moving the slider never rewrites the status.
export const progressForStatus = (status, progress) =>
  status === 'Done' ? 100 : clampProgress(progress)

// Completion-timestamp bookkeeping. Stamp when a task enters Done, preserve an
// existing stamp so a later edit doesn't reset the clock, and clear it when the
// task leaves Done. The team report uses this to tell work finished during the
// current week from work finished earlier, so EVERY screen that can complete a
// task has to set it — a missing stamp reads as "finished some time ago".
export const doneStamp = (status, previous) =>
  status === 'Done' ? (previous || new Date().toISOString()) : null

export const progressBarStyle = (pct) =>
  pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-wise-dark' : 'bg-shadow'

export const statusStyle = (s) =>
  s === 'Done' ? 'bg-emerald-100 text-emerald-700'
  : s === 'In Progress' ? 'bg-brand-100 text-brand-700'
  : s === 'Blocked' ? 'bg-rose-100 text-rose-700'
  : 'bg-iron text-graphite'

export const priorityStyle = (p) =>
  p === 'High' ? 'bg-rose-100 text-rose-700'
  : p === 'Medium' ? 'bg-amber-100 text-amber-700'
  : p === 'Low' ? 'bg-sky-100 text-sky-700'
  : 'bg-iron text-graphite'

// Distinguishes customer vs. partner tasks when both mix in one list (the
// global Tasks board, Home's upcoming-tasks widget).
export const sourceStyle = (source) =>
  source === 'partner' ? 'bg-violet-100 text-violet-700'
  : source === 'marketing' ? 'bg-amber-100 text-amber-700'
  : source === 'pmo' ? 'bg-emerald-100 text-emerald-700'
  : 'bg-sky-100 text-sky-700'

export const todayStr = () => new Date().toISOString().slice(0, 10)

// Classify a task's due date relative to today: 'overdue' | 'today' | 'soon'
// (within 7 days) | 'later' | 'none'. Done tasks are never flagged urgent.
export function dueBucket(due, status) {
  if (!due) return 'none'
  if (status === 'Done') return 'later'
  const today = todayStr()
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  const in7 = new Date()
  in7.setDate(in7.getDate() + 7)
  const soonEnd = in7.toISOString().slice(0, 10)
  if (due <= soonEnd) return 'soon'
  return 'later'
}

export const dueTextStyle = (bucket) =>
  bucket === 'overdue' ? 'text-rose-600 font-semibold'
  : bucket === 'today' ? 'text-amber-600 font-semibold'
  : 'text-graphite'

// Display label for a team member (falls back to username, then a short id).
export const memberName = (m) =>
  m ? (m.name || m.username || m.email || `User ${String(m.id).slice(0, 4)}`) : ''

// The organisation a task belongs to, for reports that show the account
// alongside the work. It is NOT the same as `ownerName` for every source:
// a Customer record *is* the company, but a Partner record is a person who
// has a company, so their optional `company` wins and the contact's name is
// only the fallback. Campaigns have no company — their name is all there is.
export const ownerCompanyName = (source, entity) =>
  source === 'partner' ? (entity.company || entity.name || '') : (entity.name || '')

const pctLabel = (v) => `${Math.round(Number(v) || 0)}%`

// Activity-feed summary for one changed field. Status and progress spell out
// their before → after values; a bare field name like "(progress)" tells the
// team something moved but not what it moved to.
const fieldSummary = (before, after, field, statusKey) => {
  if (field === statusKey) return `${before[statusKey] || '—'} → ${after[statusKey] || '—'}`
  if (field === 'progress') return `progress ${pctLabel(before.progress)} → ${pctLabel(after.progress)}`
  return field
}

// Log type + message for a task/post edit. `noun` is the capitalised label used
// in single-change headlines (`Task "X": …`); `meaningful` is the changed keys
// worth surfacing.
export const editLogEntry = (before, after, meaningful, { noun, name, statusKey = 'status' }) => {
  if (meaningful.length === 0) {
    return { type: 'task.update', message: `Updated ${noun.toLowerCase()} "${name}"` }
  }
  if (meaningful.length === 1 && (meaningful[0] === statusKey || meaningful[0] === 'progress')) {
    return {
      type: meaningful[0] === 'progress' ? 'task.progress' : 'task.status',
      message: `${noun} "${name}": ${fieldSummary(before, after, meaningful[0], statusKey)}`,
    }
  }
  const parts = meaningful.map((k) => fieldSummary(before, after, k, statusKey))
  return {
    type: 'task.update',
    message: `Updated ${noun.toLowerCase()} "${name}" (${parts.join(', ')})`,
  }
}

// One audit-log entry for a PMO task change — same shape as the
// Customer/Partner/Campaign task logs so the Tasks "Team activity" feed
// renders them all uniformly. PMO logs are a plain JSON column (like
// Campaign.logs), built client-side rather than via a dedicated log table.
export function pmoLogEntry(type, message, meta, user) {
  return {
    id: `ulog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    type,
    message,
    meta: { ...meta, by: user?.id, byName: memberName(user) },
  }
}

// Flatten every customer + partner + marketing + PMO task into one comparable
// shape. PMO tasks live on sub-user accounts (fetched separately via
// useSubUsers, not part of `state`), so they're passed in as `pmos`.
export function collectTasks(state, pmos) {
  const out = []
  for (const c of state.customers || []) {
    const groups = c.taskGroups || []
    for (const t of c.tasks || []) {
      out.push({
        key: `c:${c.id}:${t.id}`,
        source: 'customer',
        ownerId: c.id,
        ownerName: c.name,
        ownerCompany: ownerCompanyName('customer', c),
        ownerLabel: 'Customer',
        link: `/customers/${c.id}`,
        taskId: t.id,
        name: t.name || 'Untitled',
        description: t.description || '',
        status: t.status || 'Todo',
        due: t.due || '',
        assignee: t.assignee || '',
        assigneeId: t.assigneeId || '',
        createdByName: t.createdByName || '',
        priority: t.priority || '',
        groupName: groups.find((g) => g.id === t.groupId)?.name || '',
        doneAt: t.doneAt || '',
        progress: progressForStatus(t.status || 'Todo', t.progress),
      })
    }
  }
  for (const p of state.partners || []) {
    for (const t of p.tasks || []) {
      out.push({
        key: `p:${p.id}:${t.id}`,
        source: 'partner',
        ownerId: p.id,
        ownerName: p.name,
        ownerCompany: ownerCompanyName('partner', p),
        ownerLabel: 'Partner',
        link: `/partners/${p.id}`,
        taskId: t.id,
        name: t.name || t.title || 'Untitled',
        description: t.description || '',
        // Older partner tasks only stored a `done` boolean; newer ones carry
        // the same 4-value `status` as customer tasks.
        status: t.status || (t.done ? 'Done' : 'Todo'),
        due: t.due || '',
        assignee: t.assignee || '',
        assigneeId: t.assigneeId || '',
        createdByName: t.createdByName || '',
        priority: t.priority || '',
        groupName: '',
        doneAt: t.doneAt || '',
        progress: progressForStatus(t.status || (t.done ? 'Done' : 'Todo'), t.progress),
      })
    }
  }
  // Marketing campaign posts, treated as tasks. Their native post-status is
  // mapped onto the board columns; the channel shows in place of a group.
  for (const cam of state.campaigns || []) {
    for (const t of cam.todos || []) {
      out.push({
        key: `m:${cam.id}:${t.id}`,
        source: 'marketing',
        ownerId: cam.id,
        ownerName: cam.name,
        ownerCompany: ownerCompanyName('marketing', cam),
        ownerLabel: 'Marketing',
        link: `/marketing/${cam.id}`,
        taskId: t.id,
        name: t.concept || t.caption || 'Untitled post',
        description: t.caption || '',
        status: POST_STATUS_TO_TASK[t.postStatus] || 'Todo',
        due: t.postDate || '',
        assignee: t.assignee || '',
        assigneeId: t.assigneeId || '',
        createdByName: '',
        priority: '',
        groupName: t.channel || '',
        doneAt: t.doneAt || '',
        progress: progressForStatus(POST_STATUS_TO_TASK[t.postStatus] || 'Todo', t.progress),
      })
    }
  }
  for (const u of pmos || []) {
    for (const t of u.tasks || []) {
      out.push({
        key: `u:${u.id}:${t.id}`,
        source: 'pmo',
        ownerId: u.id,
        ownerName: u.name || u.username,
        ownerCompany: u.name || u.username,
        ownerLabel: 'PMO',
        link: `/pmo/${u.id}`,
        taskId: t.id,
        name: t.name || 'Untitled',
        description: t.description || '',
        status: t.status || 'Todo',
        due: t.due || '',
        assignee: t.assignee || '',
        assigneeId: t.assigneeId || '',
        createdByName: t.createdByName || '',
        priority: t.priority || '',
        groupName: '',
        doneAt: t.doneAt || '',
        progress: progressForStatus(t.status || 'Todo', t.progress),
      })
    }
  }
  return out
}
