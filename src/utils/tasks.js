// Shared task helpers used by the global Tasks board and the Home dashboard.
// Tasks live inside each customer / partner as opaque JSON, so all aggregation
// happens client-side from the store state.

export const TASK_STATUSES = ['Todo', 'In Progress', 'Done', 'Blocked']
export const TASK_PRIORITIES = ['High', 'Medium', 'Low']

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
  source === 'partner' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'

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

// Flatten every customer + partner task into one comparable shape.
export function collectTasks(state) {
  const out = []
  for (const c of state.customers || []) {
    const groups = c.taskGroups || []
    for (const t of c.tasks || []) {
      out.push({
        key: `c:${c.id}:${t.id}`,
        source: 'customer',
        ownerId: c.id,
        ownerName: c.name,
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
      })
    }
  }
  return out
}
