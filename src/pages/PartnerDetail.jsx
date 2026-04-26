import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import {
  Mail, Phone, Plus, Trash2, CheckCircle2, Circle, Calendar,
  Paperclip, Download, DollarSign,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'

const FILE_LIMIT_BYTES = 1024 * 1024 // 1 MB

export default function PartnerDetail() {
  const { id } = useParams()
  const {
    state,
    togglePartnerTask,
    addPartnerTask,
    updatePartnerTask,
    removePartnerTask,
    removePartner,
  } = useStore()
  const partner = state.partners.find((p) => p.id === id)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)

  if (!partner) return <Navigate to="/partners" replace />

  const totalExpense = partner.tasks.reduce(
    (s, t) => s + Number(t.expense || 0),
    0,
  )

  const closeTaskModal = () => {
    setTaskModalOpen(false)
    setEditingTask(null)
  }

  return (
    <>
      <PageHeader
        title={partner.name}
        subtitle={`${partner.role || '—'} · ${partner.company || '—'}`}
        back
        action={
          <button
            onClick={() => {
              if (confirm(`Delete ${partner.name}?`)) {
                removePartner(partner.id)
                history.back()
              }
            }}
            className="p-2 rounded-full hover:bg-rose-50 text-rose-500"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        }
      />

      <div className="space-y-4">
        <section className="card space-y-1.5 text-sm text-graphite">
          {partner.email && (
            <a href={`mailto:${partner.email}`} className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-graphite" /> {partner.email}
            </a>
          )}
          {partner.phone && (
            <a href={`tel:${partner.phone}`} className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-graphite" /> {partner.phone}
            </a>
          )}
        </section>

        <div className="space-y-3">
          <button
            onClick={() => { setEditingTask(null); setTaskModalOpen(true) }}
            className="btn-primary w-full"
          >
            <Plus className="w-4 h-4" /> Add task
          </button>

            {partner.tasks.length > 0 && (
              <div className="card !p-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-graphite">
                  Total expense
                </span>
                <span className="text-base font-bold text-rose-700">
                  ${totalExpense.toLocaleString()}
                </span>
              </div>
            )}

            {partner.tasks.length === 0 ? (
              <p className="text-center text-sm text-graphite py-6">No tasks yet.</p>
            ) : (
              <ul className="card divide-y divide-shadow p-0">
                {partner.tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 p-3">
                    <button
                      onClick={() => togglePartnerTask(partner.id, t.id)}
                      className="pt-0.5 shrink-0"
                      aria-label="Toggle done"
                    >
                      {t.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-graphite" />
                      )}
                    </button>
                    <button
                      onClick={() => { setEditingTask(t); setTaskModalOpen(true) }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p
                        className={`text-sm font-semibold ${
                          t.done ? 'line-through text-graphite' : ''
                        }`}
                      >
                        {t.name}
                      </p>
                      {t.description && (
                        <p className="text-xs text-graphite line-clamp-2 mt-0.5">
                          {t.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-graphite">
                        {t.setDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Set {t.setDate}
                          </span>
                        )}
                        {t.due && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Due {t.due}
                          </span>
                        )}
                        {Number(t.expense) > 0 && (
                          <span className="flex items-center gap-1 text-rose-700 font-medium">
                            <DollarSign className="w-3 h-3" />
                            {Number(t.expense).toLocaleString()}
                          </span>
                        )}
                        {t.file && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="w-3 h-3" /> {t.file.name}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>

      <Modal
        open={taskModalOpen}
        onClose={closeTaskModal}
        title={editingTask ? 'Edit task' : 'New task'}
      >
        <TaskForm
          key={editingTask?.id || 'new'}
          initial={editingTask}
          onDelete={
            editingTask
              ? () => {
                  if (confirm('Delete this task?')) {
                    removePartnerTask(partner.id, editingTask.id)
                    closeTaskModal()
                  }
                }
              : null
          }
          onSubmit={(data) => {
            if (editingTask) updatePartnerTask(partner.id, editingTask.id, data)
            else addPartnerTask(partner.id, data)
            closeTaskModal()
          }}
        />
      </Modal>
    </>
  )
}

function TaskForm({ initial, onSubmit, onDelete }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState(
    initial || {
      name: '',
      setDate: today,
      description: '',
      expense: '',
      file: null,
      due: '',
      done: false,
    },
  )
  const [fileError, setFileError] = useState('')

  const onFile = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
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

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit({
      ...form,
      expense: Number(form.expense) || 0,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Task name *</label>
        <input
          className="input"
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Confirm video shoot date"
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
          <label className="label">Task set date</label>
          <input
            className="input"
            type="date"
            value={form.setDate}
            onChange={(e) => setForm({ ...form, setDate: e.target.value })}
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
        <label className="label">Expense amount (USD)</label>
        <div className="relative">
          <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
          <input
            className="input pl-9"
            type="number"
            min="0"
            step="0.01"
            value={form.expense}
            onChange={(e) => setForm({ ...form, expense: e.target.value })}
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="label">File attachment</label>
        {form.file ? (
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-shadow bg-iron">
            <Paperclip className="w-4 h-4 text-graphite shrink-0" />
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

