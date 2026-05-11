import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import {
  Mail, Phone, Plus, Trash2, CheckCircle2, Circle, Calendar,
  Paperclip, Download, DollarSign, Briefcase, Building2,
  Image as ImageIcon, Maximize2,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from '../components/Modal.jsx'
import { useT } from '../i18n/LanguageContext.jsx'

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
  const { t } = useT()
  const partner = state.partners.find((p) => p.id === id)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false)

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
      <div className="space-y-4">
        <section className="card">
          <div className="flex flex-col gap-1.5 text-sm text-graphite">
            <div className="flex items-center justify-between gap-2">
              {partner.role ? (
                <p className="flex items-center gap-2 min-w-0">
                  <Briefcase className="w-4 h-4 text-graphite shrink-0" />
                  <span className="truncate text-near-black font-semibold">{partner.role}</span>
                </p>
              ) : (
                <p className="flex items-center gap-2 text-graphite min-w-0">
                  <Briefcase className="w-4 h-4 shrink-0" /> {t('partner.addPosition')}
                </p>
              )}
              <div className="shrink-0 -my-1.5 -mr-1">
                <button
                  onClick={() => {
                    if (confirm(t('partner.confirmDelete', { name: partner.name }))) {
                      removePartner(partner.id)
                      history.back()
                    }
                  }}
                  className="p-2 rounded-full hover:bg-rose-50 text-rose-500 transition-transform hover:scale-105 active:scale-95"
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {partner.company && (
              <p className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-graphite shrink-0" />
                <span className="truncate">{partner.company}</span>
              </p>
            )}
            {partner.email && (
              <a href={`mailto:${partner.email}`} className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-graphite shrink-0" />
                <span className="truncate">{partner.email}</span>
              </a>
            )}
            {partner.phone && (
              <a href={`tel:${partner.phone}`} className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-graphite shrink-0" />
                <span className="truncate">{partner.phone}</span>
              </a>
            )}
          </div>
        </section>

        {partner.cardImage?.dataUrl && (
          <section className="card !p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-shadow">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="w-4 h-4 text-graphite shrink-0" />
                <p className="text-sm font-semibold text-near-black truncate">
                  {t('partner.nameCard.title')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCardPreviewOpen(true)}
                className="p-2 rounded-full hover:bg-iron text-graphite transition-transform hover:scale-105 active:scale-95"
                aria-label={t('partner.nameCard.preview')}
                title={t('partner.nameCard.preview')}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCardPreviewOpen(true)}
              className="block w-full bg-iron"
            >
              <img
                src={partner.cardImage.dataUrl}
                alt={`${partner.name} name card`}
                className="w-full max-h-64 object-contain"
              />
            </button>
          </section>
        )}

        <div className="space-y-3">
          <button
            onClick={() => { setEditingTask(null); setTaskModalOpen(true) }}
            className="btn-primary w-full"
          >
            <Plus className="w-4 h-4" /> {t('partner.task.add')}
          </button>

            {partner.tasks.length > 0 && (
              <div className="card !p-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-graphite">
                  {t('partner.task.totalExpense')}
                </span>
                <span className="text-base font-bold text-rose-700">
                  ${totalExpense.toLocaleString()}
                </span>
              </div>
            )}

            {partner.tasks.length === 0 ? (
              <p className="text-center text-sm text-graphite py-6">{t('partner.task.empty')}</p>
            ) : (
              <ul className="card divide-y divide-shadow p-0">
                {partner.tasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-3 p-3">
                    <button
                      onClick={() => togglePartnerTask(partner.id, task.id)}
                      className="pt-0.5 shrink-0"
                      aria-label={t('partner.task.toggleDone')}
                    >
                      {task.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-graphite" />
                      )}
                    </button>
                    <button
                      onClick={() => { setEditingTask(task); setTaskModalOpen(true) }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p
                        className={`text-sm font-semibold ${
                          task.done ? 'line-through text-graphite' : ''
                        }`}
                      >
                        {task.name}
                      </p>
                      {task.description && (
                        <p className="text-xs text-graphite line-clamp-2 mt-0.5">
                          {task.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-graphite">
                        {task.setDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {t('partner.task.fields.setOn', { date: task.setDate })}
                          </span>
                        )}
                        {task.due && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {t('partner.task.fields.dueOn', { date: task.due })}
                          </span>
                        )}
                        {Number(task.expense) > 0 && (
                          <span className="flex items-center gap-1 text-rose-700 font-medium">
                            <DollarSign className="w-3 h-3" />
                            {Number(task.expense).toLocaleString()}
                          </span>
                        )}
                        {task.file && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="w-3 h-3" /> {task.file.name}
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
        title={editingTask ? t('partner.task.modal.edit') : t('partner.task.modal.new')}
      >
        <TaskForm
          key={editingTask?.id || 'new'}
          initial={editingTask}
          onDelete={
            editingTask
              ? () => {
                  if (confirm(t('partner.task.delete'))) {
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

      <Modal
        open={cardPreviewOpen}
        onClose={() => setCardPreviewOpen(false)}
        title={t('partner.nameCard.preview')}
      >
        <div className="overflow-hidden rounded-xl border border-shadow bg-iron">
          <img
            src={partner.cardImage?.dataUrl}
            alt={`${partner.name} name card`}
            className="w-full max-h-[70vh] object-contain"
          />
        </div>
      </Modal>
    </>
  )
}

function TaskForm({ initial, onSubmit, onDelete }) {
  const { t } = useT()
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
      setFileError(t('partner.task.fileTooBig', { mb: (f.size / 1024 / 1024).toFixed(1) }))
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
        <label className="label">{t('partner.task.fields.name')} *</label>
        <input
          className="input"
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Confirm video shoot date"
        />
      </div>

      <div>
        <label className="label">{t('field.description')}</label>
        <textarea
          className="input min-h-[80px]"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Context, links, success criteria..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('partner.task.fields.setDate')}</label>
          <input
            className="input"
            type="date"
            value={form.setDate}
            onChange={(e) => setForm({ ...form, setDate: e.target.value })}
          />
        </div>
        <div>
          <label className="label">{t('field.dueDate')}</label>
          <input
            className="input"
            type="date"
            value={form.due}
            onChange={(e) => setForm({ ...form, due: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="label">{t('partner.task.fields.expense')}</label>
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
        <label className="label">{t('partner.task.fields.attach')}</label>
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
            {t('partner.task.fields.attachLabel')}
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
            {t('common.delete')}
          </button>
        )}
        <button type="submit" className="btn-primary flex-1">
          {initial ? t('common.saveChanges') : t('partner.task.save')}
        </button>
      </div>
    </form>
  )
}
