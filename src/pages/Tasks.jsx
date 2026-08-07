import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  LayoutGrid, List, Search, Calendar, User, UserPlus, AlertTriangle, Clock,
  Loader2, Ban, ArrowUpRight, Activity as ActivityIcon, Pencil, Trash2,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import { useT } from '../i18n/LanguageContext.jsx'
import Modal from '../components/Modal.jsx'
import AssigneeField from '../components/AssigneeField.jsx'
import ProgressField from '../components/ProgressField.jsx'
import {
  TASK_STATUSES, TASK_PRIORITIES, statusStyle, priorityStyle, sourceStyle, dueBucket, dueTextStyle, collectTasks, memberName,
  POST_STATUS_TO_TASK, TASK_TO_POST_STATUS, MARKETING_POST_TYPES, MARKETING_POST_CHANNELS,
  clampProgress, progressForStatus, progressBarStyle, doneStamp,
} from '../utils/tasks.js'

const DUE_FILTERS = ['all', 'overdue', 'today', 'soon', 'open', 'none']
const ACTIVITY_PAGE_SIZE = 10

const formatLogTime = (ts) => {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Tasks() {
  const {
    state, updateCustomerTask, updatePartnerTask,
    removeCustomerTask, removePartnerTask,
    updateCampaignTodo, removeCampaignTodo,
  } = useStore()
  const { user } = useAuth()
  const { t } = useT()

  const isOwner = !!user && !user.ownerId // owners/admins see the whole team by default
  const canViewTeam = isOwner || hasPermission(user, 'tasks.team')

  // Deep-linked from the Home dashboard's stat tiles, e.g. /tasks?due=overdue
  // or /tasks?status=Blocked — narrows the board to just that slice.
  const [searchParams] = useSearchParams()
  const initialDue = searchParams.get('due')
  const initialStatus = searchParams.get('status')

  const [view, setView] = useState('board') // 'board' | 'table'
  const [scope, setScope] = useState(isOwner ? 'team' : 'mine') // 'mine' | 'team'
  const [q, setQ] = useState('')
  const [assignee, setAssignee] = useState('all')
  const [due, setDue] = useState(DUE_FILTERS.includes(initialDue) ? initialDue : 'all')
  const [statusFilter, setStatusFilter] = useState(TASK_STATUSES.includes(initialStatus) ? initialStatus : 'all')
  const [source, setSource] = useState('all') // 'all' | 'customer' | 'partner'
  const [draggingKey, setDraggingKey] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  // Done/Blocked are "reference" states — collapse them to a slim strip by
  // default so the board stays focused on Todo → In Progress. Remembered
  // per-browser so a user's preference survives reloads.
  const [collapsedCols, setCollapsedCols] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('omcmo.tasks.collapsedCols') || 'null')
      if (saved && typeof saved === 'object') return saved
    } catch { /* ignore */ }
    return { Done: true, Blocked: true }
  })
  const toggleCol = (status) => {
    setCollapsedCols((prev) => {
      const next = { ...prev, [status]: !prev[status] }
      try { localStorage.setItem('omcmo.tasks.collapsedCols', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // The Done column only shows tasks completed in the last 10 days by default;
  // older ones stay one click away (and always in Table view / search). A task
  // "completed" is its doneAt, falling back to its due date for legacy tasks
  // stamped before doneAt existed.
  const DONE_WINDOW_DAYS = 10
  const [showOlderDone, setShowOlderDone] = useState(false)
  const doneWindowStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - DONE_WINDOW_DAYS)
    return d.toISOString().slice(0, 10)
  }, [])
  const isOlderDone = (task) => {
    if (task.status !== 'Done') return false
    const when = (task.doneAt ? task.doneAt.slice(0, 10) : task.due) || ''
    return !when || when < doneWindowStart
  }
  const [activityCount, setActivityCount] = useState(ACTIVITY_PAGE_SIZE)
  const [editingKey, setEditingKey] = useState(null)

  const allTasks = useMemo(() => collectTasks(state), [state])

  // Scope first: a member's board defaults to tasks assigned to their account.
  // Without the 'tasks.team' ability, the team view is unavailable entirely.
  const scopedTasks = useMemo(
    () => ((scope === 'mine' || !canViewTeam) && user?.id ? allTasks.filter((t) => t.assigneeId === user.id) : allTasks),
    [allTasks, scope, canViewTeam, user],
  )

  const assignees = useMemo(() => {
    const set = new Set()
    allTasks.forEach((t) => t.assignee && set.add(t.assignee))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [allTasks])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return scopedTasks.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false
      if (source !== 'all' && task.source !== source) return false
      if (assignee === '__none' ? task.assignee : assignee !== 'all' && task.assignee !== assignee) return false
      if (needle) {
        const hay = `${task.name} ${task.description} ${task.ownerName} ${task.assignee}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (due !== 'all') {
        const b = dueBucket(task.due, task.status)
        if (due === 'open') {
          if (task.status === 'Done') return false
        } else if (due === 'overdue' && b !== 'overdue') return false
        else if (due === 'today' && b !== 'today') return false
        else if (due === 'soon' && !(b === 'today' || b === 'soon')) return false
        else if (due === 'none' && b !== 'none') return false
      }
      return true
    })
  }, [scopedTasks, q, assignee, due, source, statusFilter])

  const stats = useMemo(() => {
    const s = { overdue: 0, today: 0, inProgress: 0, blocked: 0, open: 0, done: 0 }
    for (const task of scopedTasks) {
      if (task.status === 'Done') { s.done++; continue }
      s.open++
      const b = dueBucket(task.due, task.status)
      if (b === 'overdue') s.overdue++
      if (b === 'today') s.today++
      if (task.status === 'In Progress') s.inProgress++
      if (task.status === 'Blocked') s.blocked++
    }
    return s
  }, [scopedTasks])

  const activity = useMemo(() => {
    // Who performed the action: newer logs carry meta.byName directly; older
    // ones (or server-side auto-logs) only carry meta.by (a user id) that we
    // resolve against the team roster.
    const actorName = (l) =>
      l.meta?.byName || memberName((state.team || []).find((m) => m.id === l.meta?.by)) || null

    const logs = []
    for (const c of state.customers || []) {
      for (const l of c.logs || []) logs.push({ ...l, ownerName: c.name, link: `/customers/${c.id}`, actorName: actorName(l) })
    }
    for (const p of state.partners || []) {
      for (const l of p.logs || []) logs.push({ ...l, ownerName: p.name, link: `/partners/${p.id}`, actorName: actorName(l) })
    }
    for (const cam of state.campaigns || []) {
      for (const l of cam.logs || []) logs.push({ ...l, ownerName: cam.name, link: `/marketing/${cam.id}`, actorName: actorName(l) })
    }
    return logs.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
  }, [state.customers, state.partners, state.campaigns, state.team])

  const visibleActivity = activity.slice(0, activityCount)

  // Sub-users may only change the status of tasks assigned to them; the
  // account owner can change any task. Mirrors the backend guard in
  // assertOwnTaskChangesOnly (OhMyCMO_API/src/utils/tenant.js).
  const canEditTask = (task) => isOwner || !task.assigneeId || task.assigneeId === user?.id
  const canDeleteTask = (task) => canEditTask(task) && hasPermission(user, 'tasks.delete')

  const setStatus = (task, status) => {
    if (task.status === status) return
    if (!canEditTask(task)) return
    // Stamp a completion time when a task enters Done (so the board can age
    // old Done cards out of view); clear it when it leaves Done. Dropping a
    // card into Done also completes it, matching the edit modal's behaviour —
    // any other column leaves the existing percentage untouched.
    const stamp = { doneAt: doneStamp(status, task.doneAt) }
    if (status === 'Done') stamp.progress = 100
    if (task.source === 'customer') updateCustomerTask(task.ownerId, task.taskId, { status, ...stamp })
    else if (task.source === 'partner') updatePartnerTask(task.ownerId, task.taskId, { status, ...stamp })
    else updateCampaignTodo(task.ownerId, task.taskId, { postStatus: TASK_TO_POST_STATUS[status] || 'draft', ...stamp })
  }

  const onDrop = (status) => {
    const task = allTasks.find((x) => x.key === draggingKey)
    if (task) setStatus(task, status)
    setDraggingKey(null)
    setDragOverCol(null)
  }

  // Resolve the currently-edited task down to its raw stored object + parent so
  // the modal can edit every field (collectTasks only exposes a summary shape).
  const editing = useMemo(() => {
    if (!editingKey) return null
    const flat = allTasks.find((x) => x.key === editingKey)
    if (!flat) return null
    const list = flat.source === 'customer' ? state.customers
      : flat.source === 'partner' ? state.partners
      : state.campaigns
    const parent = (list || []).find((e) => e.id === flat.ownerId)
    const items = flat.source === 'marketing' ? parent?.todos : parent?.tasks
    const raw = (items || []).find((tk) => tk.id === flat.taskId)
    if (!raw) return null
    return { flat, parent, raw }
  }, [editingKey, allTasks, state.customers, state.partners, state.campaigns])

  const saveTask = (patch) => {
    if (!editing) return
    const { source, ownerId, taskId } = editing.flat
    if (source === 'customer') updateCustomerTask(ownerId, taskId, patch)
    else if (source === 'partner') updatePartnerTask(ownerId, taskId, patch)
    else updateCampaignTodo(ownerId, taskId, patch)
  }

  const deleteTask = () => {
    if (!editing) return
    const { source, ownerId, taskId } = editing.flat
    if (source === 'customer') removeCustomerTask(ownerId, taskId)
    else if (source === 'partner') removePartnerTask(ownerId, taskId)
    else removeCampaignTodo(ownerId, taskId)
    setEditingKey(null)
  }


  const statTiles = [
    { key: 'overdue',    icon: AlertTriangle, value: stats.overdue,    label: t('tasks.stat.overdue'),    bg: '#FFE4E6', fg: '#9F1239' },
    { key: 'today',      icon: Clock,         value: stats.today,      label: t('tasks.stat.today'),      bg: '#FEF3C7', fg: '#92400E' },
    { key: 'inProgress', icon: Loader2,       value: stats.inProgress, label: t('tasks.stat.inProgress'), bg: '#E2F6D5', fg: '#166534' },
    { key: 'blocked',    icon: Ban,           value: stats.blocked,    label: t('tasks.stat.blocked'),    bg: '#F1F5F9', fg: '#334155' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-graphite">{t('tasks.kicker')}</p>
        <h1 className="display text-3xl md:text-5xl text-near-black mt-1">{t('tasks.title')}</h1>
        <p className="text-sm text-graphite mt-2 max-w-2xl">{t('tasks.subtitle')}</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statTiles.map((s) => (
          <div key={s.key} className="p-4 rounded-3xl" style={{ backgroundColor: s.bg, color: s.fg }}>
            <div className="flex items-center justify-between">
              <s.icon className="w-5 h-5" strokeWidth={2.2} />
              <span className="display text-3xl md:text-4xl">{s.value}</span>
            </div>
            <p className="text-xs font-bold mt-2" style={{ opacity: 0.85 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search / filters / view switch — its own row, directly below the
          stat tiles (not part of the card below). */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-graphite absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input pl-9"
            placeholder={t('tasks.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {canViewTeam && scope === 'team' && (
          <select className="input w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="all">{t('tasks.filter.allAssignees')}</option>
            <option value="__none">{t('tasks.filter.unassigned')}</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <select className="input w-auto" value={due} onChange={(e) => setDue(e.target.value)}>
          {DUE_FILTERS.map((f) => <option key={f} value={f}>{t(`tasks.filter.due.${f}`)}</option>)}
        </select>
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{t('tasks.filter.allStatuses')}</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-auto" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">{t('tasks.filter.allSources')}</option>
          <option value="customer">{t('tasks.filter.customers')}</option>
          <option value="partner">{t('tasks.filter.partners')}</option>
          <option value="marketing">{t('tasks.filter.marketing')}</option>
        </select>
        <div className="flex rounded-xl border border-shadow overflow-hidden">
          <button
            onClick={() => setView('board')}
            className={`px-3 py-2 flex items-center gap-1.5 text-sm font-semibold ${view === 'board' ? 'bg-wise-dark text-white' : 'text-graphite hover:bg-iron'}`}
          >
            <LayoutGrid className="w-4 h-4" /> {t('tasks.view.board')}
          </button>
          <button
            onClick={() => setView('table')}
            className={`px-3 py-2 flex items-center gap-1.5 text-sm font-semibold ${view === 'table' ? 'bg-wise-dark text-white' : 'text-graphite hover:bg-iron'}`}
          >
            <List className="w-4 h-4" /> {t('tasks.view.table')}
          </button>
        </div>
      </div>

      {/* Task status board — scope toggle at the top, columns below. */}
      <div className="space-y-4">
        {canViewTeam && (
          <div className="flex rounded-xl border border-shadow overflow-hidden w-fit">
            <button
              onClick={() => { setScope('mine'); setAssignee('all') }}
              className={`px-4 py-2 text-sm font-semibold ${scope === 'mine' ? 'bg-wise-dark text-white' : 'text-graphite hover:bg-iron'}`}
            >
              {t('tasks.scope.mine')}
            </button>
            <button
              onClick={() => setScope('team')}
              className={`px-4 py-2 text-sm font-semibold ${scope === 'team' ? 'bg-wise-dark text-white' : 'text-graphite hover:bg-iron'}`}
            >
              {t('tasks.scope.team')}
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-graphite text-center py-12">{t('tasks.empty')}</p>
        ) : view === 'board' ? (
          <div className={`grid grid-cols-1 gap-3 ${statusFilter === 'all' ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-1'}`}>
            {TASK_STATUSES.filter((status) => statusFilter === 'all' || status === statusFilter).map((status) => {
              const items = filtered.filter((task) => task.status === status)
              // Collapse hides the card list (a vertical/accordion collapse) so
              // every column keeps the same width whether open or closed.
              const collapsed = statusFilter === 'all' && collapsedCols[status]
              const isOver = dragOverCol === status

              // Done column: hide tasks completed >14 days ago behind a toggle.
              const isDoneCol = status === 'Done' && statusFilter === 'all'
              const olderCount = isDoneCol ? items.filter(isOlderDone).length : 0
              const visibleItems = isDoneCol && !showOlderDone
                ? items.filter((task) => !isOlderDone(task))
                : items

              return (
                <div
                  key={status}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(status) }}
                  onDragLeave={() => setDragOverCol((c) => (c === status ? null : c))}
                  onDrop={() => onDrop(status)}
                  className={`self-start rounded-3xl p-3 transition ${isOver ? 'bg-brand-50 ring-2 ring-brand-300' : 'bg-iron'}`}
                >
                  <div className="flex items-center justify-between px-1">
                    <span className={`pill ${statusStyle(status)}`}>{status}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-graphite">{items.length}</span>
                      {statusFilter === 'all' && (
                        <button
                          type="button"
                          onClick={() => toggleCol(status)}
                          title={collapsed ? t('tasks.col.expand', { status }) : t('tasks.col.collapse', { status })}
                          className="p-0.5 -m-0.5 text-graphite hover:text-wise-dark"
                        >
                          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                  {!collapsed && (
                    <>
                      <div className="space-y-2 min-h-[40px] mt-2">
                        {visibleItems.map((task) => (
                          <TaskCard
                            key={task.key}
                            task={task}
                            canEdit={canEditTask(task)}
                            onEdit={() => setEditingKey(task.key)}
                            onDragStart={() => setDraggingKey(task.key)}
                            onDragEnd={() => { setDraggingKey(null); setDragOverCol(null) }}
                          />
                        ))}
                      </div>
                      {isDoneCol && olderCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowOlderDone((v) => !v)}
                          className="mt-2 w-full text-xs font-semibold text-graphite hover:text-wise-dark py-1.5 rounded-xl hover:bg-shadow/20 transition"
                        >
                          {showOlderDone
                            ? t('tasks.done.hideOlder')
                            : t('tasks.done.showOlder', { n: olderCount })}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <TaskTable tasks={filtered} canEditTask={canEditTask} onSetStatus={setStatus} onEdit={(task) => setEditingKey(task.key)} />
        )}
      </div>

      {/* Team activity */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ActivityIcon className="w-4 h-4 text-graphite" />
          <h2 className="display text-2xl md:text-3xl text-near-black">{t('tasks.activity')}</h2>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-graphite px-1">{t('tasks.activity.empty')}</p>
        ) : (
          <>
            <ul className="space-y-2">
              {visibleActivity.map((l) => (
                <li key={l.id}>
                  <Link to={l.link} className="card !p-3 flex items-start gap-3 hover:scale-[1.01] transition-transform">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{l.message}</p>
                      {l.type === 'activity' && l.meta?.note && (
                        <p className="text-xs text-graphite mt-0.5 whitespace-pre-wrap">{l.meta.note}</p>
                      )}
                      <p className="text-[11px] text-graphite mt-0.5">
                        {l.ownerName}
                        {l.actorName && <> · by {l.actorName}</>}
                      </p>
                    </div>
                    <span className="text-[10px] text-graphite shrink-0">{formatLogTime(l.ts)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {activity.length > activityCount && (
              <button
                onClick={() => setActivityCount((n) => n + ACTIVITY_PAGE_SIZE)}
                className="mt-3 w-full text-sm font-semibold text-wise-dark hover:underline text-center"
              >
                {t('tasks.activity.viewMore')}
              </button>
            )}
          </>
        )}
      </section>

      {editing && (
        <TaskEditModal
          key={editingKey}
          editing={editing}
          team={state.team || []}
          canEdit={canEditTask(editing.flat)}
          canDelete={canDeleteTask(editing.flat)}
          onClose={() => setEditingKey(null)}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}
    </div>
  )
}

function TaskCard({ task, canEdit, onEdit, onDragStart, onDragEnd }) {
  const bucket = dueBucket(task.due, task.status)
  return (
    <div
      draggable={canEdit}
      onDragStart={canEdit ? onDragStart : undefined}
      onDragEnd={canEdit ? onDragEnd : undefined}
      className={`card !p-4 space-y-1.5 ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onEdit}
          className={`text-sm font-semibold flex-1 min-w-0 text-left hover:text-wise-dark ${task.status === 'Done' ? 'line-through text-graphite' : ''}`}
        >
          {task.name}
        </button>
        {task.priority && <span className={`pill shrink-0 ${priorityStyle(task.priority)}`}>{task.priority}</span>}
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit task"
          className="shrink-0 p-1 -m-1 text-graphite hover:text-wise-dark"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`pill shrink-0 text-[10px] ${sourceStyle(task.source)}`}>{task.ownerLabel}</span>
        <Link to={task.link} className="text-[11px] text-graphite hover:text-wise-dark inline-flex items-center gap-1 min-w-0 truncate">
          {task.ownerName} <ArrowUpRight className="w-3 h-3 shrink-0" />
        </Link>
      </div>
      <div className="flex flex-col gap-1 text-[11px]">
        {task.due && (
          <span className={`flex items-center gap-1 ${dueTextStyle(bucket)}`}>
            <Calendar className="w-3 h-3" /> {task.due}
          </span>
        )}
        <span className="flex items-center gap-1 text-graphite">
          <User className="w-3 h-3" /> In charge: {task.assignee || 'N/A'}
        </span>
        {task.createdByName && (
          <span className="flex items-center gap-1 text-ash">
            <UserPlus className="w-3 h-3" /> Created by {task.createdByName}
          </span>
        )}
      </div>
      <ProgressBar pct={task.progress} />
    </div>
  )
}

// Read-only completion readout — the percentage set by ProgressField.
function ProgressBar({ pct = 0 }) {
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <div className="h-1.5 flex-1 rounded-full bg-iron overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${progressBarStyle(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold text-graphite tabular-nums shrink-0">{pct}%</span>
    </div>
  )
}

function TaskTable({ tasks, canEditTask, onSetStatus, onEdit }) {
  const { t } = useT()
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => {
      const ao = a.status === 'Done' ? 1 : 0
      const bo = b.status === 'Done' ? 1 : 0
      if (ao !== bo) return ao - bo
      return (a.due || '9999').localeCompare(b.due || '9999')
    }),
    [tasks],
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-graphite border-b border-shadow">
            <th className="p-3 font-bold">{t('tasks.col.task')}</th>
            <th className="p-3 font-bold">{t('tasks.col.owner')}</th>
            <th className="p-3 font-bold">{t('tasks.col.assignee')}</th>
            <th className="p-3 font-bold">{t('tasks.col.createdBy')}</th>
            <th className="p-3 font-bold">{t('tasks.col.due')}</th>
            <th className="p-3 font-bold">{t('tasks.col.priority')}</th>
            <th className="p-3 font-bold">{t('tasks.col.status')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const bucket = dueBucket(task.due, task.status)
            const canEdit = canEditTask(task)
            return (
              <tr key={task.key} className="border-b border-shadow last:border-0 hover:bg-iron/60">
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => onEdit(task)}
                    className={`font-semibold text-left hover:text-wise-dark inline-flex items-center gap-1.5 ${task.status === 'Done' ? 'line-through text-graphite' : ''}`}
                  >
                    {task.name}
                    <Pencil className="w-3 h-3 text-graphite shrink-0" />
                  </button>
                  {task.groupName && <p className="text-[11px] text-graphite">{task.groupName}</p>}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`pill shrink-0 text-[10px] ${sourceStyle(task.source)}`}>{task.ownerLabel}</span>
                    <Link to={task.link} className="text-graphite hover:text-wise-dark inline-flex items-center gap-1 min-w-0 truncate">
                      {task.ownerName} <ArrowUpRight className="w-3 h-3 shrink-0" />
                    </Link>
                  </div>
                </td>
                <td className="p-3 text-graphite">{task.assignee || '—'}</td>
                <td className="p-3 text-graphite">{task.createdByName || '—'}</td>
                <td className={`p-3 ${dueTextStyle(bucket)}`}>{task.due || '—'}</td>
                <td className="p-3">
                  {task.priority ? <span className={`pill ${priorityStyle(task.priority)}`}>{task.priority}</span> : <span className="text-graphite">—</span>}
                </td>
                <td className="p-3">
                  <select
                    className="input !py-1 !px-2 w-auto text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    value={task.status}
                    disabled={!canEdit}
                    title={canEdit ? undefined : 'Only the person in charge can update this task'}
                    onChange={(e) => onSetStatus(task, e.target.value)}
                  >
                    {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Edit a task (customer or partner) directly from the Tasks board. Fields
// branch on the task's source since customer and partner tasks have slightly
// different shapes. (Posting activity lives on the board, not here.)
function TaskEditModal({ editing, team, canEdit, canDelete, onClose, onSave, onDelete }) {
  const { t } = useT()
  const { flat, parent, raw } = editing
  const isCustomer = flat.source === 'customer'
  const isMarketing = flat.source === 'marketing'
  const groups = isCustomer ? (parent?.taskGroups || []) : []

  const [form, setForm] = useState({
    name: (isMarketing ? raw.concept : raw.name) || '',
    description: (isMarketing ? raw.caption : raw.description) || '',
    status: isMarketing ? (POST_STATUS_TO_TASK[raw.postStatus] || 'Todo') : (raw.status || 'Todo'),
    due: (isMarketing ? raw.postDate : raw.due) || '',
    assignee: raw.assignee || '',
    assigneeId: raw.assigneeId || '',
    priority: raw.priority || '',
    groupId: raw.groupId || null,
    expense: raw.expense ?? 0,
    channel: raw.channel || '',
    type: raw.type || 'Image',
    progress: clampProgress(raw.progress),
  })

  const update = (patch) => setForm((s) => ({ ...s, ...patch }))

  // Moving the status to Done means finished, so pull progress up to 100.
  // Leaving Done keeps whatever number is there — the user decides what's left.
  const updateStatus = (status) =>
    setForm((s) => ({ ...s, status, progress: progressForStatus(status, s.progress) }))

  const submit = (e) => {
    e.preventDefault()
    if (!canEdit || !form.name.trim()) return
    // Keep doneAt in sync with the status: stamp on entering Done (preserving
    // any existing timestamp so a later edit doesn't reset the clock), clear
    // on leaving Done. Marketing "published" maps to the board's Done column.
    const doneAt = doneStamp(form.status, raw.doneAt)
    const progress = progressForStatus(form.status, form.progress)
    const patch = isCustomer
      ? {
          name: form.name.trim(), description: form.description, status: form.status,
          due: form.due, assignee: form.assignee, assigneeId: form.assigneeId,
          priority: form.priority, groupId: form.groupId || null, doneAt, progress,
        }
      : isMarketing
      ? {
          concept: form.name.trim(), caption: form.description,
          postStatus: TASK_TO_POST_STATUS[form.status] || 'draft',
          postDate: form.due, channel: form.channel, type: form.type,
          assignee: form.assignee, assigneeId: form.assigneeId, doneAt, progress,
        }
      : {
          name: form.name.trim(), description: form.description, status: form.status,
          due: form.due, assignee: form.assignee, assigneeId: form.assigneeId,
          expense: Number(form.expense) || 0, doneAt, progress,
        }
    onSave(patch)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={t('tasks.edit.title')} size="lg">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center gap-1.5">
          <span className={`pill text-[10px] ${sourceStyle(flat.source)}`}>{flat.ownerLabel}</span>
          <Link to={flat.link} onClick={onClose} className="text-xs text-graphite hover:text-wise-dark inline-flex items-center gap-1">
            {flat.ownerName} <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {!canEdit && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t('tasks.edit.readonly')}</p>
        )}

        <div>
          <label className="label">{t(isMarketing ? 'tasks.field.concept' : 'tasks.field.name')} *</label>
          <input
            className="input" autoFocus disabled={!canEdit}
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>

        <div>
          <label className="label">{t(isMarketing ? 'tasks.field.caption' : 'tasks.field.description')}</label>
          <textarea
            className="input min-h-[80px]" disabled={!canEdit}
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('tasks.field.status')}</label>
            <select className="input" disabled={!canEdit} value={form.status} onChange={(e) => updateStatus(e.target.value)}>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('tasks.field.due')}</label>
            <input className="input" type="date" disabled={!canEdit} value={form.due} onChange={(e) => update({ due: e.target.value })} />
          </div>
        </div>

        <ProgressField
          value={form.progress}
          disabled={!canEdit}
          onChange={(progress) => update({ progress })}
        />

        {isCustomer ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('tasks.field.priority')}</label>
              <select className="input" disabled={!canEdit} value={form.priority || ''} onChange={(e) => update({ priority: e.target.value })}>
                <option value="">{t('tasks.field.priority.none')}</option>
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {groups.length > 0 && (
              <div>
                <label className="label">Group</label>
                <select className="input" disabled={!canEdit} value={form.groupId || ''} onChange={(e) => update({ groupId: e.target.value || null })}>
                  <option value="">Ungrouped</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
          </div>
        ) : isMarketing ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('tasks.field.channel')}</label>
              <select className="input" disabled={!canEdit} value={form.channel || ''} onChange={(e) => update({ channel: e.target.value })}>
                <option value="">—</option>
                {MARKETING_POST_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('tasks.field.type')}</label>
              <select className="input" disabled={!canEdit} value={form.type || 'Image'} onChange={(e) => update({ type: e.target.value })}>
                {MARKETING_POST_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className="label">{t('tasks.field.expense')}</label>
            <input className="input" type="number" min="0" step="0.01" disabled={!canEdit} value={form.expense} onChange={(e) => update({ expense: e.target.value })} />
          </div>
        )}

        <fieldset disabled={!canEdit} className="disabled:opacity-60">
          <AssigneeField
            team={team}
            assigneeId={form.assigneeId}
            assignee={form.assignee}
            onChange={(v) => update(v)}
          />
        </fieldset>

        {isMarketing && (
          <p className="text-[11px] text-graphite">{t('tasks.field.marketingNote')}</p>
        )}

        {canEdit && (
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={!form.name.trim()}>
              {t('common.save')}
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-xl px-4 text-rose-600 hover:bg-rose-50 text-sm font-semibold border border-rose-100 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> {t('tasks.edit.delete')}
              </button>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
