import { useState } from 'react'
import {
  Plus, Trash2, Calendar, FolderPlus, ChevronDown, User, Paperclip, Pencil, Download,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from '../components/Modal.jsx'

const STATUS_OPTIONS = ['Todo', 'In Progress', 'Done', 'Blocked']
const FILE_LIMIT_BYTES = 1024 * 1024

const statusStyle = (s) =>
  s === 'Done' ? 'bg-emerald-100 text-emerald-700'
  : s === 'In Progress' ? 'bg-brand-100 text-brand-700'
  : s === 'Blocked' ? 'bg-rose-100 text-rose-700'
  : 'bg-iron text-graphite'

export default function CustomerDetailTask({ customer }) {
  const {
    addCustomerTask,
    updateCustomerTask,
    removeCustomerTask,
    addCustomerTaskGroup,
    renameCustomerTaskGroup,
    removeCustomerTaskGroup,
  } = useStore()
  const [openModal, setOpenModal] = useState(null) // 'task' | 'group'
  const [editingTask, setEditingTask] = useState(null)
  const [editingGroup, setEditingGroup] = useState(null)
  const [collapsedGroups, setCollapsedGroups] = useState({})

  const toggleCollapse = (gid) =>
    setCollapsedGroups((s) => ({ ...s, [gid]: !s[gid] }))

  const grouped = [
    ...customer.taskGroups.map((g) => ({
      group: g,
      items: customer.tasks.filter((t) => t.groupId === g.id),
    })),
    {
      group: { id: '__ungrouped', name: 'Ungrouped' },
      items: customer.tasks.filter(
        (t) => !t.groupId || !customer.taskGroups.some((g) => g.id === t.groupId),
      ),
    },
  ].filter((s) => s.items.length > 0 || s.group.id !== '__ungrouped')

  const closeAll = () => {
    setOpenModal(null)
    setEditingTask(null)
    setEditingGroup(null)
  }

  return (
    <>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setEditingTask(null); setOpenModal('task') }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> Add task
          </button>
          <button
            onClick={() => { setEditingGroup(null); setOpenModal('group') }}
            className="btn-ghost border border-shadow bg-charcoal"
          >
            <FolderPlus className="w-4 h-4" /> Add group
          </button>
        </div>

        {customer.tasks.length === 0 && customer.taskGroups.length === 0 ? (
          <p className="text-center text-sm text-graphite py-6">No tasks yet.</p>
        ) : (
          grouped.map(({ group, items }) => {
            const collapsed = collapsedGroups[group.id]
            const isReal = group.id !== '__ungrouped'
            return (
              <section key={group.id} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <button
                    onClick={() => toggleCollapse(group.id)}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-graphite"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition ${collapsed ? '-rotate-90' : ''}`}
                    />
                    {group.name}
                    <span className="text-graphite font-medium normal-case tracking-normal">
                      ({items.length})
                    </span>
                  </button>
                  {isReal && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => { setEditingGroup(group); setOpenModal('group') }}
                        className="p-1 rounded hover:bg-iron text-graphite"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete group "${group.name}"? Tasks will move to Ungrouped.`)) {
                            removeCustomerTaskGroup(customer.id, group.id)
                          }
                        }}
                        className="p-1 rounded hover:bg-rose-50 text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {!collapsed && (
                  items.length === 0 ? (
                    <p className="text-xs text-graphite px-1">No tasks in this group.</p>
                  ) : (
                    <ul className="card divide-y divide-shadow p-0">
                      {items.map((t) => (
                        <li key={t.id} className="p-3.5">
                          <button
                            onClick={() => { setEditingTask(t); setOpenModal('task') }}
                            className="w-full text-left flex items-start gap-3"
                          >
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-start gap-2">
                                <p
                                  className={`text-sm font-semibold flex-1 min-w-0 ${
                                    t.status === 'Done' ? 'line-through text-graphite' : ''
                                  }`}
                                >
                                  {t.name}
                                </p>
                                <span className={`pill shrink-0 ${statusStyle(t.status)}`}>
                                  {t.status}
                                </span>
                              </div>
                              {t.description && (
                                <p className="text-xs text-graphite line-clamp-2">{t.description}</p>
                              )}
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-graphite pt-0.5">
                                {t.due && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {t.due}
                                  </span>
                                )}
                                {t.assignee && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" /> {t.assignee}
                                  </span>
                                )}
                                {t.file && (
                                  <span className="flex items-center gap-1">
                                    <Paperclip className="w-3 h-3" /> {t.file.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          <div className="flex gap-1 mt-2 pl-0">
                            {STATUS_OPTIONS.map((s) => (
                              <button
                                key={s}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateCustomerTask(customer.id, t.id, { status: s })
                                }}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition ${
                                  t.status === s
                                    ? `${statusStyle(s)} border-transparent`
                                    : 'border-shadow text-graphite hover:bg-iron'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </section>
            )
          })
        )}
      </div>

      <Modal
        open={openModal === 'task'}
        onClose={closeAll}
        title={editingTask ? 'Edit task' : 'New task'}
      >
        <TaskForm
          key={editingTask?.id || 'new'}
          initial={editingTask}
          groups={customer.taskGroups}
          onDelete={
            editingTask
              ? () => {
                  if (confirm('Delete this task?')) {
                    removeCustomerTask(customer.id, editingTask.id)
                    closeAll()
                  }
                }
              : null
          }
          onSubmit={(data) => {
            if (editingTask) updateCustomerTask(customer.id, editingTask.id, data)
            else addCustomerTask(customer.id, data)
            closeAll()
          }}
        />
      </Modal>

      <Modal
        open={openModal === 'group'}
        onClose={closeAll}
        title={editingGroup ? 'Rename group' : 'New task group'}
      >
        <GroupForm
          key={editingGroup?.id || 'new-group'}
          initial={editingGroup}
          onSubmit={(name) => {
            if (editingGroup) renameCustomerTaskGroup(customer.id, editingGroup.id, name)
            else addCustomerTaskGroup(customer.id, name)
            closeAll()
          }}
        />
      </Modal>
    </>
  )
}

function TaskForm({ initial, groups, onSubmit, onDelete }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState(
    initial || {
      name: '',
      registerDate: today,
      description: '',
      status: 'Todo',
      file: null,
      due: '',
      assignee: '',
      groupId: groups[0]?.id || null,
    },
  )
  const [fileError, setFileError] = useState('')

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > FILE_LIMIT_BYTES) {
      setFileError(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB — max 1 MB stored locally.`)
      return
    }
    setFileError('')
    const reader = new FileReader()
    reader.onload = () => {
      setForm((s) => ({
        ...s,
        file: { name: f.name, type: f.type, size: f.size, dataUrl: reader.result },
      }))
    }
    reader.readAsDataURL(f)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!form.name.trim()) return
        onSubmit(form)
      }}
      className="space-y-3"
    >
      <div>
        <label className="label">Task name *</label>
        <input
          className="input"
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Send proposal v3"
        />
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          className="input min-h-[80px]"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Context, links, success criteria..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Group</label>
          <select
            className="input"
            value={form.groupId || ''}
            onChange={(e) => setForm({ ...form, groupId: e.target.value || null })}
          >
            <option value="">Ungrouped</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Register date</label>
          <input
            className="input"
            type="date"
            value={form.registerDate}
            onChange={(e) => setForm({ ...form, registerDate: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Due date</label>
          <input
            className="input"
            type="date"
            value={form.due}
            onChange={(e) => setForm({ ...form, due: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="label">Person in charge</label>
        <input
          className="input"
          value={form.assignee}
          onChange={(e) => setForm({ ...form, assignee: e.target.value })}
          placeholder="Sara Lim"
        />
      </div>

      <div>
        <label className="label">File attachment</label>
        {form.file ? (
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-shadow bg-iron">
            <Paperclip className="w-4 h-4 text-graphite" />
            <span className="text-sm flex-1 min-w-0 truncate">{form.file.name}</span>
            {form.file.dataUrl && (
              <a
                href={form.file.dataUrl}
                download={form.file.name}
                className="p-1.5 text-graphite hover:bg-iron rounded"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setForm({ ...form, file: null })}
              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-graphite text-sm text-graphite cursor-pointer hover:bg-iron">
            <Paperclip className="w-4 h-4" />
            Attach file (max 1 MB)
            <input type="file" className="hidden" onChange={onFile} />
          </label>
        )}
        {fileError && <p className="text-xs text-rose-600 mt-1">{fileError}</p>}
      </div>

      <div className="flex gap-2 pt-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 text-sm font-semibold"
          >
            Delete
          </button>
        )}
        <button type="submit" className="btn-primary flex-1">
          {initial ? 'Save changes' : 'Save task'}
        </button>
      </div>
    </form>
  )
}

function GroupForm({ initial, onSubmit }) {
  const [name, setName] = useState(initial?.name || '')
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()) }}
      className="space-y-3"
    >
      <div>
        <label className="label">Group name *</label>
        <input
          className="input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Q2 Campaign"
        />
      </div>
      <button className="btn-primary w-full">{initial ? 'Rename' : 'Create group'}</button>
    </form>
  )
}
