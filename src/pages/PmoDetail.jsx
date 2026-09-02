import { useState } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Calendar, User, UserCog, Search, List, LayoutGrid, Package,
} from 'lucide-react'
import Modal from '../components/Modal.jsx'
import AssigneeField from '../components/AssigneeField.jsx'
import ProgressField from '../components/ProgressField.jsx'
import DateFilterButton from '../components/DateFilterButton.jsx'
import { usePmos } from '../api/pmo.js'
import { useStore } from '../store/StoreContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import AuthImage from '../components/AuthImage.jsx'
import { hasImage } from '../utils/imageRef.js'
import {
  TASK_STATUSES, TASK_PRIORITIES, progressForStatus, doneStamp,
  statusStyle, priorityStyle, editLogEntry, pmoLogEntry, memberName,
} from '../utils/tasks.js'

const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const TASKS_PAGE_SIZE = 10

// Local (not UTC) YYYY-MM-DD, comparable against task.due strings the same
// way dueBucket compares against todayStr().
const toDateStr = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function PmoDetail() {
  const { id } = useParams()
  const { items: pmos, loading, error, update, refresh } = usePmos()
  const { state, updateProduct } = useStore()
  const { user } = useAuth()
  const isOwner = !!user && !user.ownerId
  const canManage = isOwner || hasPermission(user, 'pmo.manage')
  const isSelfPmo = !!user && user.id === id
  const team = state.team || []
  // A "supporter" — one of this PMO's reports (their inChargeId points at
  // this PMO) — gets the same task rights as the PMO themselves, "cloned"
  // onto this PMO's page. Mirrors assertCanWritePmoTasks server-side.
  const isSupporter = !isSelfPmo && team.some((m) => m.id === user?.id && m.inChargeId === id)
  const isPmoTeamMember = isSelfPmo || isSupporter
  // Only the owner, a 'pmo.manage' holder, this PMO themselves, or one of
  // their reports may create a task or (re)assign one. Setting the report
  // list itself (`reportIds`) stays narrower — owner/pmo.manage/self only,
  // matching the backend.
  const canManageThisPmo = canManage || isPmoTeamMember
  const canAssignReports = canManage || isSelfPmo
  // The owner/pmo.manage can assign to anyone; this PMO or one of their
  // reports may only assign within this PMO's own team — the PMO themselves
  // or a fellow report.
  const assignableTeam = canManage
    ? team
    : isPmoTeamMember
      ? team.filter((m) => m.id === id || m.inChargeId === id)
      : []
  const [openModal, setOpenModal] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [taskView, setTaskView] = useState('table') // 'table' | 'card'
  const [taskQuery, setTaskQuery] = useState('')
  const [taskDueRange, setTaskDueRange] = useState(null) // { start: Date, end: Date } | null
  const [taskStatusFilter, setTaskStatusFilter] = useState('all') // 'all' | 'Todo' | 'In Progress' | 'Done' | 'Blocked'
  const [taskPage, setTaskPage] = useState(1)

  // Every task filter resets pagination back to page 1 — otherwise a
  // narrower result set can leave the view stranded past the last page.
  const changeTaskQuery = (v) => { setTaskQuery(v); setTaskPage(1) }
  const changeTaskDueRange = (v) => { setTaskDueRange(v); setTaskPage(1) }
  const changeTaskStatusFilter = (v) => { setTaskStatusFilter(v); setTaskPage(1) }

  const pmo = pmos.find((u) => u.id === id)

  if (loading) {
    return <p className="text-center text-sm text-graphite py-10">Loading PM…</p>
  }
  if (error) {
    return <p className="text-center text-sm text-rose-600 py-10">Couldn't load PM.</p>
  }
  if (!pmo || !pmo.isPmo) return <Navigate to="/pmo" replace />

  const products = pmo.products || []
  const reports = pmo.reports || []
  const tasks = pmo.tasks || []

  const taskCounts = tasks.reduce((c, t) => {
    const status = t.status || 'Todo'
    if (status === 'Todo') c.todo++
    else if (status === 'In Progress') c.inProgress++
    else if (status === 'Done') c.done++
    return c
  }, { todo: 0, inProgress: 0, done: 0 })

  const filteredTasks = tasks.filter((task) => {
    if (taskStatusFilter !== 'all' && (task.status || 'Todo') !== taskStatusFilter) return false
    const needle = taskQuery.trim().toLowerCase()
    if (needle) {
      const hay = `${task.name || ''} ${task.description || ''} ${task.assignee || ''}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    if (taskDueRange) {
      if (!task.due) return false
      if (task.due < toDateStr(taskDueRange.start) || task.due > toDateStr(taskDueRange.end)) return false
    }
    return true
  })

  const taskTotalPages = Math.max(1, Math.ceil(filteredTasks.length / TASKS_PAGE_SIZE))
  const taskCurrentPage = Math.min(taskPage, taskTotalPages)
  const pagedTasks = filteredTasks.slice(
    (taskCurrentPage - 1) * TASKS_PAGE_SIZE,
    taskCurrentPage * TASKS_PAGE_SIZE,
  )
  // A plain unrelated sub-user may open/edit their own (or an unassigned)
  // task, same self-service rule as customer/partner tasks. This PMO
  // themselves and their reports (isPmoTeamMember) get full control over
  // every task here, same as the owner — matches the backend's field-level
  // check in updatePmo/assertOwnTaskChangesOnly.
  const canTouchTask = (task) =>
    canManage || isPmoTeamMember || !task.assigneeId || task.assigneeId === user?.id

  const saveProducts = async (nextProductIds) => {
    const before = new Set(products.map((p) => p.id))
    const after = new Set(nextProductIds)
    const toAssign = [...after].filter((idx) => !before.has(idx))
    const toUnassign = [...before].filter((idx) => !after.has(idx))
    await Promise.all([
      ...toAssign.map((pid) => updateProduct(pid, { pmoOwnerId: pmo.id })),
      ...toUnassign.map((pid) => updateProduct(pid, { pmoOwnerId: null })),
    ])
    // The PMO's `products` summary is served by /pmo (open to everyone),
    // independent of `state.products` (gated by the 'products' permission) —
    // refetch it so this panel reflects the new assignment immediately.
    await refresh()
    setOpenModal(null)
  }

  const handleTaskSubmit = async (data) => {
    if (editingTask) {
      const before = editingTask
      const after = { ...before, ...data, id: editingTask.id }
      const changed = Object.keys(data).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      if (changed.length === 0) {
        setOpenModal(null)
        setEditingTask(null)
        return
      }
      const meaningful = changed.filter((k) => k !== 'doneAt')
      const { type, message } = editLogEntry(before, after, meaningful, { noun: 'Task', name: after.name })
      const log = pmoLogEntry(type, message, { taskId: editingTask.id, changed }, user)
      await update(pmo.id, {
        tasks: tasks.map((t) => (t.id === editingTask.id ? after : t)),
        logs: [log, ...(pmo.logs || [])],
      })
    } else {
      const newTask = { id: uid('t'), ...data }
      const log = pmoLogEntry(
        'task.create',
        `Created task "${newTask.name}"`,
        { taskId: newTask.id, status: newTask.status },
        user,
      )
      await update(pmo.id, { tasks: [newTask, ...tasks], logs: [log, ...(pmo.logs || [])] })
    }
    setOpenModal(null)
    setEditingTask(null)
  }

  const handleStatusChange = async (task, status) => {
    if (task.status === status || !canTouchTask(task)) return
    const stamp = { doneAt: doneStamp(status, task.doneAt) }
    if (status === 'Done') stamp.progress = 100
    const after = { ...task, status, ...stamp }
    const { type, message } = editLogEntry(task, after, ['status'], { noun: 'Task', name: after.name })
    const log = pmoLogEntry(type, message, { taskId: task.id, changed: ['status'] }, user)
    await update(pmo.id, {
      tasks: tasks.map((t) => (t.id === task.id ? after : t)),
      logs: [log, ...(pmo.logs || [])],
    })
  }

  const handleTaskDelete = async (taskId) => {
    if (!confirm('Delete this task?')) return
    const removed = tasks.find((t) => t.id === taskId)
    const log = pmoLogEntry('task.delete', `Deleted task "${removed?.name || 'Untitled'}"`, { taskId }, user)
    await update(pmo.id, {
      tasks: tasks.filter((t) => t.id !== taskId),
      logs: [log, ...(pmo.logs || [])],
    })
    setOpenModal(null)
    setEditingTask(null)
  }

  const saveReports = async (reportIds) => {
    await update(pmo.id, { reportIds })
    setOpenModal(null)
  }

  return (
    <>
      <Link to="/pmo" className="inline-flex items-center gap-1 text-sm text-graphite hover:text-near-black mb-3">
        <ChevronLeft className="w-4 h-4" /> Back to PMs
      </Link>

      <div className="space-y-4">
        <section className="card !p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:divide-x md:divide-shadow">
            <div className="md:pr-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-graphite mb-3">Profile</h3>
              <div className="flex items-center gap-3">
                {hasImage(pmo.avatar) ? (
                  <AuthImage
                    value={pmo.avatar}
                    alt={pmo.name || pmo.username}
                    className="w-14 h-14 rounded-full object-cover border border-shadow bg-iron shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-mint-bg text-wise-dark flex items-center justify-center font-bold text-lg shrink-0">
                    {(pmo.name || pmo.username || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold truncate text-near-black">{pmo.name || pmo.username}</p>
                  <p className="text-xs text-graphite mt-0.5">PM</p>
                </div>
              </div>
            </div>

            <div className="md:px-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-graphite">Support Team</h3>
                {canAssignReports && (
                  <button
                    type="button"
                    onClick={() => setOpenModal('reports')}
                    className="p-1.5 -m-1.5 rounded-full hover:bg-iron text-graphite"
                    aria-label="Edit support team"
                  >
                    <UserCog className="w-4 h-4" />
                  </button>
                )}
              </div>
              {reports.length === 0 ? (
                <p className="text-sm text-graphite">No support staff assigned yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {reports.map((r) => (
                    <li key={r.id} className="pill bg-sky-50 text-sky-800 text-[11px] !pl-1 gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-sky-200 text-sky-800 flex items-center justify-center shrink-0">
                        <User className="w-2.5 h-2.5" />
                      </span>
                      {memberName(r)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="md:pl-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-graphite">Products &amp; Services</h3>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setOpenModal('products')}
                    className="p-1.5 -m-1.5 rounded-full hover:bg-iron text-graphite"
                    aria-label="Edit PM's products"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
              {products.length === 0 ? (
                <p className="text-sm text-graphite">No products or services yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {products.map((p) => (
                    <li key={p.id} className="pill bg-emerald-50 text-emerald-800 text-[11px] !pl-1 gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                        <Package className="w-2.5 h-2.5" />
                      </span>
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-graphite">Tasks</h3>
              {tasks.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => changeTaskStatusFilter('all')}
                    className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 border transition-colors ${taskStatusFilter === 'all' ? 'bg-wise-dark text-white border-wise-dark' : 'text-graphite border-shadow hover:bg-iron'}`}
                  >
                    {tasks.length} Total
                  </button>
                  <button
                    type="button"
                    onClick={() => changeTaskStatusFilter(taskStatusFilter === 'Todo' ? 'all' : 'Todo')}
                    className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 border transition-colors ${taskStatusFilter === 'Todo' ? 'bg-wise-dark text-white border-wise-dark' : 'text-graphite border-shadow hover:bg-iron'}`}
                  >
                    {taskCounts.todo} Todo
                  </button>
                  <button
                    type="button"
                    onClick={() => changeTaskStatusFilter(taskStatusFilter === 'In Progress' ? 'all' : 'In Progress')}
                    className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 border transition-colors ${taskStatusFilter === 'In Progress' ? 'bg-wise-dark text-white border-wise-dark' : 'text-graphite border-shadow hover:bg-iron'}`}
                  >
                    {taskCounts.inProgress} In Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => changeTaskStatusFilter(taskStatusFilter === 'Done' ? 'all' : 'Done')}
                    className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 border transition-colors ${taskStatusFilter === 'Done' ? 'bg-wise-dark text-white border-wise-dark' : 'text-graphite border-shadow hover:bg-iron'}`}
                  >
                    {taskCounts.done} Done
                  </button>
                </div>
              )}
            </div>
            {canManageThisPmo && (
              <button
                type="button"
                onClick={() => { setEditingTask(null); setOpenModal('task') }}
                className="btn-primary !px-4 !py-1.5 !text-xs !gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add Task
              </button>
            )}
          </div>

          {tasks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-4 h-4 text-graphite absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="input pl-9"
                  placeholder="Search tasks..."
                  value={taskQuery}
                  onChange={(e) => changeTaskQuery(e.target.value)}
                />
              </div>
              <DateFilterButton
                value={taskDueRange}
                onChange={changeTaskDueRange}
                label="Filter by date"
              />
              <div className="flex rounded-xl border border-shadow overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setTaskView('table')}
                  className={`px-3 py-2 flex items-center gap-1.5 text-xs font-semibold ${taskView === 'table' ? 'bg-wise-dark text-white' : 'text-graphite hover:bg-iron'}`}
                >
                  <List className="w-3.5 h-3.5" /> Table
                </button>
                <button
                  type="button"
                  onClick={() => setTaskView('card')}
                  className={`px-3 py-2 flex items-center gap-1.5 text-xs font-semibold ${taskView === 'card' ? 'bg-wise-dark text-white' : 'text-graphite hover:bg-iron'}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Card list
                </button>
              </div>
            </div>
          )}

          {tasks.length === 0 ? (
            <p className="text-center text-sm text-graphite py-6">No tasks yet.</p>
          ) : filteredTasks.length === 0 ? (
            <p className="text-center text-sm text-graphite py-6">No tasks match your search.</p>
          ) : taskView === 'table' ? (
            <div className="card !p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-graphite border-b border-shadow">
                    <th className="p-3 font-bold">Task</th>
                    <th className="p-3 font-bold">Description</th>
                    <th className="p-3 font-bold">Due Date</th>
                    <th className="p-3 font-bold">Assignee</th>
                    <th className="p-3 font-bold">Status</th>
                    <th className="p-3 font-bold w-8" />
                  </tr>
                </thead>
                <tbody>
                  {pagedTasks.map((task) => {
                    const editable = canTouchTask(task)
                    const deletable = editable && hasPermission(user, 'tasks.delete')
                    return (
                      <tr
                        key={task.id}
                        onClick={editable ? () => { setEditingTask(task); setOpenModal('task') } : undefined}
                        className={`border-b border-shadow last:border-0 hover:bg-iron/60 group ${editable ? 'cursor-pointer' : ''}`}
                      >
                        <td
                          className={`p-3 font-semibold max-w-[220px] truncate ${task.status === 'Done' ? 'line-through text-graphite' : ''}`}
                        >
                          {task.name || 'Untitled'}
                        </td>
                        <td className="p-3 text-graphite max-w-[280px] truncate">{task.description || '—'}</td>
                        <td className="p-3 text-graphite whitespace-nowrap">{task.due || '—'}</td>
                        <td className="p-3 text-graphite whitespace-nowrap">{task.assignee || 'N/A'}</td>
                        <td className="p-3">
                          <select
                            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border-0 disabled:opacity-70 disabled:cursor-not-allowed ${statusStyle(task.status || 'Todo')}`}
                            value={task.status || 'Todo'}
                            disabled={!editable}
                            title={editable ? 'Change status' : 'Only the person in charge can update this task'}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                          >
                            {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="p-3">
                          {deletable && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleTaskDelete(task.id) }}
                              className="p-1 rounded-full text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="card divide-y divide-shadow p-0">
              {pagedTasks.map((task) => {
                const editable = canTouchTask(task)
                const deletable = editable && hasPermission(user, 'tasks.delete')
                return (
                  <li key={task.id} className="group">
                    <div
                      onClick={editable ? () => { setEditingTask(task); setOpenModal('task') } : undefined}
                      className={`w-full text-left p-4 flex flex-col gap-1.5 ${editable ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold flex-1 min-w-0 truncate ${task.status === 'Done' ? 'line-through text-graphite' : ''}`}>
                          {task.name || 'Untitled'}
                        </p>
                        {task.priority && (
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 ${priorityStyle(task.priority)}`}>
                            {task.priority}
                          </span>
                        )}
                        <select
                          className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 border-0 disabled:opacity-70 disabled:cursor-not-allowed ${statusStyle(task.status || 'Todo')}`}
                          value={task.status || 'Todo'}
                          disabled={!editable}
                          title={editable ? 'Change status' : 'Only the person in charge can update this task'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStatusChange(task, e.target.value)}
                        >
                          {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {/* Fixed-size slot, deletable or not — keeps the status pill's
                            position consistent across every row. */}
                        <span className="w-6 h-6 shrink-0 flex items-center justify-center">
                          {deletable && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleTaskDelete(task.id) }}
                              className="p-1 rounded-full text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-graphite line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-graphite">
                        {task.due && (
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {task.due}</span>
                        )}
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {task.assignee || 'N/A'}</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {filteredTasks.length > TASKS_PAGE_SIZE && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-graphite">
                Showing {(taskCurrentPage - 1) * TASKS_PAGE_SIZE + 1}
                –{Math.min(taskCurrentPage * TASKS_PAGE_SIZE, filteredTasks.length)} of {filteredTasks.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskPage((p) => Math.max(1, p - 1))}
                  disabled={taskCurrentPage === 1}
                  className="p-1.5 rounded-full border border-shadow text-graphite disabled:opacity-40 disabled:cursor-not-allowed hover:bg-iron"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-graphite tabular-nums">
                  Page {taskCurrentPage} of {taskTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setTaskPage((p) => Math.min(taskTotalPages, p + 1))}
                  disabled={taskCurrentPage === taskTotalPages}
                  className="p-1.5 rounded-full border border-shadow text-graphite disabled:opacity-40 disabled:cursor-not-allowed hover:bg-iron"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={openModal === 'task'}
        onClose={() => { setOpenModal(null); setEditingTask(null) }}
        title={editingTask ? 'Edit task' : 'Add task'}
      >
        <TaskForm
          task={editingTask}
          team={assignableTeam}
          canAssign={canManageThisPmo}
          onSubmit={handleTaskSubmit}
          onDelete={() => handleTaskDelete(editingTask.id)}
        />
      </Modal>

      <Modal
        open={openModal === 'products'}
        onClose={() => setOpenModal(null)}
        title={`${pmo.name || pmo.username}'s products`}
        size="lg"
      >
        <PmoProductsForm pmo={pmo} products={state.products} onSave={saveProducts} />
      </Modal>

      <Modal
        open={openModal === 'reports'}
        onClose={() => setOpenModal(null)}
        title={`Support team for ${pmo.name || pmo.username}`}
        size="lg"
      >
        <PmoReportsForm pmo={pmo} team={team} onSave={saveReports} />
      </Modal>
    </>
  )
}

function PmoProductsForm({ pmo, products, onSave }) {
  const initial = products.filter((p) => p.pmoOwnerId === pmo.id).map((p) => p.id)
  const [selected, setSelected] = useState(() => new Set(initial))
  const toggle = (id) => setSelected((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <div className="space-y-3">
      {products.length === 0 ? (
        <p className="text-center text-sm text-graphite py-4">No products or services yet.</p>
      ) : (
        <ul className="divide-y divide-shadow max-h-96 overflow-y-auto -mx-1">
          {products.map((p) => {
            const ownedByOther = p.pmoOwnerId && p.pmoOwnerId !== pmo.id
            return (
              <li key={p.id}>
                <label className="w-full flex items-center gap-3 p-3 cursor-pointer hover:bg-iron rounded-xl">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    {ownedByOther && (
                      <p className="text-[11px] text-amber-600">
                        Currently supported by: {p.pmoOwner?.name || p.pmoOwner?.username || 'another PM'} (PM)
                      </p>
                    )}
                  </div>
                </label>
              </li>
            )
          })}
        </ul>
      )}
      <button type="button" onClick={() => onSave([...selected])} className="btn-primary w-full">
        Save
      </button>
    </div>
  )
}

// Picks who supports/reports to this PMO (their inChargeId points here) —
// mirrors PmoProductsForm's shape, but over team members instead of products.
function PmoReportsForm({ pmo, team, onSave }) {
  const candidates = team.filter((m) => m.id !== pmo.id && m.role !== 'ADMIN')
  const initial = (pmo.reports || []).map((r) => r.id)
  const [selected, setSelected] = useState(() => new Set(initial))
  const toggle = (id) => setSelected((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-graphite -mt-1">
        Select who supports {pmo.name || pmo.username}. Selected members get the same rights to
        add and assign tasks, replacing their current PM support.
      </p>
      {candidates.length === 0 ? (
        <p className="text-center text-sm text-graphite py-4">No other sub users yet.</p>
      ) : (
        <ul className="divide-y divide-shadow max-h-96 overflow-y-auto -mx-1">
          {candidates.map((m) => {
            const supportsOther = m.inChargeId && m.inChargeId !== pmo.id
            const otherPmoName = supportsOther
              ? memberName(team.find((t) => t.id === m.inChargeId))
              : null
            return (
              <li key={m.id}>
                <label className="w-full flex items-center gap-3 p-3 cursor-pointer hover:bg-iron rounded-xl">
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{memberName(m)}</p>
                    {supportsOther && (
                      <p className="text-[11px] text-amber-600">Currently supports {otherPmoName || 'another PM'} (PM)</p>
                    )}
                  </div>
                </label>
              </li>
            )
          })}
        </ul>
      )}
      <button type="button" onClick={() => onSave([...selected])} className="btn-primary w-full">
        Save
      </button>
    </div>
  )
}

function TaskForm({ task, team, canAssign, onSubmit, onDelete }) {
  const [form, setForm] = useState({
    name: task?.name || '',
    description: task?.description || '',
    status: task?.status || 'Todo',
    priority: task?.priority || '',
    due: task?.due || '',
    assignee: task?.assignee || '',
    assigneeId: task?.assigneeId || '',
    progress: task?.progress || 0,
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit({
      ...form,
      name: form.name.trim(),
      progress: progressForStatus(form.status, form.progress),
      doneAt: doneStamp(form.status, task?.doneAt),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Name *</label>
        <input className="input" autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          className="input"
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            <option value="">None</option>
            {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <ProgressField value={form.progress} onChange={(v) => set('progress', v)} disabled={form.status === 'Done'} />
      <div>
        <label className="label">Due date</label>
        <input type="date" className="input" value={form.due} onChange={(e) => set('due', e.target.value)} />
      </div>
      {canAssign ? (
        <AssigneeField
          team={team}
          assigneeId={form.assigneeId}
          assignee={form.assignee}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
      ) : (
        <div>
          <label className="label">Person in charge</label>
          <p className="text-sm text-near-black">{form.assignee || 'Unassigned'}</p>
        </div>
      )}
      <div className="flex gap-2">
        {task && (
          <button
            type="button"
            onClick={onDelete}
            className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button type="submit" className="btn-primary flex-1">Save task</button>
      </div>
    </form>
  )
}
