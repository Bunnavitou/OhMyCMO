import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import {
  Mail, Phone, Plus, Trash2, Calendar, User, UserPlus,
  Paperclip, Download, DollarSign, Briefcase, Building2,
  Image as ImageIcon, Maximize2, Pencil, Send, Camera, Copy, Check,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import Modal from '../components/Modal.jsx'
import AssigneeField from '../components/AssigneeField.jsx'
import ProgressField from '../components/ProgressField.jsx'
import { TelegramQrPicker } from './Partners.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import AuthImage from '../components/AuthImage.jsx'
import { uploadImageRef, hasImage } from '../utils/imageRef.js'
import { TASK_STATUSES, statusStyle, memberName, clampProgress, progressForStatus, doneStamp } from '../utils/tasks.js'

const CARD_LIMIT_BYTES = 2 * 1024 * 1024

const FILE_LIMIT_BYTES = 1024 * 1024 // 1 MB

export default function PartnerDetail() {
  const { id } = useParams()
  const {
    state,
    addPartnerTask,
    updatePartnerTask,
    removePartnerTask,
    removePartner,
    updatePartner,
  } = useStore()
  const { user } = useAuth()
  const canDelete = hasPermission(user, 'partners.delete')
  const isOwner = !!user && !user.ownerId
  // Mirrors the backend guard in assertOwnTaskChangesOnly (OhMyCMO_API/src/utils/tenant.js):
  // sub-users may only change tasks assigned to them.
  const canEditTask = (task) => isOwner || !task.assigneeId || task.assigneeId === user?.id
  const canDeleteTask = (task) => canEditTask(task) && hasPermission(user, 'tasks.delete')
  const { t } = useT()
  const partner = state.partners.find((p) => p.id === id)
  const team = state.team || []
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false)
  const [editPartnerOpen, setEditPartnerOpen] = useState(false)
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)

  const copyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email)
    } catch {
      // Fallback for non-secure contexts where the Clipboard API is blocked.
      const ta = document.createElement('textarea')
      ta.value = email
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setEmailCopied(true)
    setTimeout(() => setEmailCopied(false), 1500)
  }

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
              <div className="shrink-0 -my-1.5 -mr-1 flex items-center">
                <button
                  onClick={() => setEditPartnerOpen(true)}
                  className="p-2 rounded-full hover:bg-iron text-graphite transition-transform hover:scale-105 active:scale-95"
                  aria-label={t('common.edit')}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {canDelete && (
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
                )}
              </div>
            </div>
            {partner.company && (
              <p className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-graphite shrink-0" />
                <span className="truncate">{partner.company}</span>
              </p>
            )}
            {partner.email && (
              <div className="flex items-center gap-1.5 min-w-0">
                <a href={`mailto:${partner.email}`} className="flex items-center gap-2 min-w-0">
                  <Mail className="w-4 h-4 text-graphite shrink-0" />
                  <span className="truncate">{partner.email}</span>
                </a>
                <button
                  type="button"
                  onClick={() => copyEmail(partner.email)}
                  className="p-1 rounded-md text-graphite hover:bg-mint-bg hover:text-wise-dark shrink-0 transition-colors"
                  aria-label={emailCopied ? t('common.copied') : t('partner.copyEmail')}
                  title={emailCopied ? t('common.copied') : t('partner.copyEmail')}
                >
                  {emailCopied
                    ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                    : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
            {partner.phone && (
              <a href={`tel:${partner.phone}`} className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-graphite shrink-0" />
                <span className="truncate">{partner.phone}</span>
              </a>
            )}
            {partner.telegram && (
              <p className="flex items-center gap-2">
                <Send className="w-4 h-4 text-graphite shrink-0" />
                <span className="truncate">{partner.telegram}</span>
              </p>
            )}
            {hasImage(partner.telegramQr) && (
              <button
                type="button"
                onClick={() => setQrPreviewOpen(true)}
                className="mt-1 inline-flex items-center gap-2 self-start rounded-xl border border-shadow p-1 hover:bg-iron"
              >
                <AuthImage
                  value={partner.telegramQr}
                  alt="Telegram QR"
                  className="w-12 h-12 object-cover rounded-md"
                />
                <span className="text-xs text-graphite pr-2">Telegram QR</span>
              </button>
            )}
          </div>
        </section>

        {hasImage(partner.cardImage) && (
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
              <AuthImage
                value={partner.cardImage}
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
                  <li key={task.id} className="p-3.5">
                    <button
                      onClick={() => { setEditingTask(task); setTaskModalOpen(true) }}
                      className="w-full text-left flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start gap-2">
                          <p
                            className={`text-sm font-semibold flex-1 min-w-0 ${
                              task.status === 'Done' ? 'line-through text-graphite' : ''
                            }`}
                          >
                            {task.name}
                          </p>
                          <span className={`pill shrink-0 ${statusStyle(task.status)}`}>{task.status}</span>
                        </div>
                        {task.description && (
                          <p className="text-xs text-graphite line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex flex-col gap-1 text-[11px] text-graphite pt-0.5">
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
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> In charge: {task.assignee || 'N/A'}
                          </span>
                          {task.createdByName && (
                            <span className="flex items-center gap-1 text-ash">
                              <UserPlus className="w-3 h-3" /> Created by {task.createdByName}
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
          team={team}
          currentUser={user}
          onDelete={
            editingTask && canDeleteTask(editingTask)
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
            else addPartnerTask(partner.id, {
              ...data,
              createdById: user?.id || '',
              createdByName: memberName(user),
            })
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
          <AuthImage
            value={partner.cardImage}
            alt={`${partner.name} name card`}
            className="w-full max-h-[70vh] object-contain"
          />
        </div>
      </Modal>

      <Modal
        open={qrPreviewOpen}
        onClose={() => setQrPreviewOpen(false)}
        title="Telegram QR"
      >
        <div className="overflow-hidden rounded-xl border border-shadow bg-iron">
          <AuthImage
            value={partner.telegramQr}
            alt={`${partner.name} telegram QR`}
            className="w-full max-h-[70vh] object-contain"
          />
        </div>
      </Modal>

      <Modal
        open={editPartnerOpen}
        onClose={() => setEditPartnerOpen(false)}
        title={t('common.edit')}
      >
        <EditPartnerForm
          partner={partner}
          onSubmit={async (patch) => {
            await updatePartner(partner.id, patch)
            setEditPartnerOpen(false)
          }}
        />
      </Modal>
    </>
  )
}

function EditPartnerForm({ partner, onSubmit }) {
  const { t } = useT()
  const [form, setForm] = useState({
    name: partner.name || '',
    company: partner.company || '',
    role: partner.role || '',
    email: partner.email || '',
    phone: partner.phone || '',
    telegram: partner.telegram || '',
    cardImage: partner.cardImage || null,
    telegramQr: partner.telegramQr || null,
  })
  const [cardError, setCardError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const onCardFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > CARD_LIMIT_BYTES) {
      setCardError(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB — max 2 MB.`)
      return
    }
    setCardError('')
    try {
      const cardImage = await uploadImageRef(f, {
        maxDim: 1600, quality: 0.82, entityType: 'partner', entityId: partner.id,
      })
      setForm((s) => ({ ...s, cardImage }))
    } catch {
      setCardError('Could not read that image — try a different file.')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required.')
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: form.name.trim(),
        company: form.company.trim() || null,
        role: form.role.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        telegram: form.telegram.trim() || null,
        cardImage: form.cardImage,
        telegramQr: form.telegramQr,
      })
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">{t('partner.fullName')} *</label>
        <input
          className="input"
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('partner.field.company')}</label>
          <input
            className="input"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
        </div>
        <div>
          <label className="label">{t('partner.field.role')}</label>
          <input
            className="input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('field.email')}</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="label">{t('field.phone')}</label>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="label">Telegram user ID</label>
        <input
          className="input"
          value={form.telegram}
          onChange={(e) => setForm({ ...form, telegram: e.target.value })}
          placeholder="@username"
        />
      </div>

      <TelegramQrPicker
        value={form.telegramQr}
        onChange={(qr) => setForm({ ...form, telegramQr: qr })}
      />

      <div>
        <label className="label">{t('partner.nameCard.title')}</label>
        {hasImage(form.cardImage) ? (
          <div className="space-y-2">
            <div className="rounded-xl overflow-hidden border border-shadow bg-iron">
              <AuthImage
                value={form.cardImage}
                alt="Name card"
                className="w-full max-h-48 object-contain"
              />
            </div>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-shadow text-sm text-graphite cursor-pointer hover:bg-iron">
                <Camera className="w-4 h-4" /> Replace
                <input type="file" accept="image/*" className="hidden" onChange={onCardFile} />
              </label>
              <button
                type="button"
                onClick={() => setForm({ ...form, cardImage: null })}
                className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-graphite text-sm text-graphite cursor-pointer hover:bg-iron">
            <Camera className="w-4 h-4" /> Upload name card
            <input type="file" accept="image/*" className="hidden" onChange={onCardFile} />
          </label>
        )}
        {cardError && <p className="text-xs text-rose-600 mt-1">{cardError}</p>}
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full mt-2 disabled:opacity-60">
        {submitting ? t('common.saving') : t('common.saveChanges')}
      </button>
    </form>
  )
}

function TaskForm({ initial, team = [], currentUser, onSubmit, onDelete }) {
  const { t } = useT()
  const today = new Date().toISOString().slice(0, 10)
  // Default person in charge to the creator — they're usually the one
  // responsible. Prefer the roster entry so the dropdown shows them selected;
  // fall back to a free-text name if they're not in the roster. Still editable.
  const me = currentUser ? team.find((m) => m.id === currentUser.id) : null
  const defaultAssignee = me
    ? { assigneeId: me.id, assignee: memberName(me) }
    : currentUser
      ? { assigneeId: '', assignee: memberName(currentUser) }
      : { assigneeId: '', assignee: '' }
  // When editing a task whose assignee was stored as a free-text name (no
  // linked account), match it back to a roster member so the dropdown shows
  // them selected instead of falling into the "Other (type a name)" box.
  const normalizedInitial = (() => {
    if (!initial) return null
    if (initial.assigneeId || !initial.assignee) return initial
    const match = team.find((m) => memberName(m) === initial.assignee)
    return match ? { ...initial, assigneeId: match.id } : initial
  })()
  const [form, setForm] = useState(
    normalizedInitial
      // Older tasks only stored a `done` boolean — normalize to `status` so
      // the select below always has a valid value. Same for `progress`, which
      // tasks created before the field existed won't carry at all.
      ? {
          ...normalizedInitial,
          status: normalizedInitial.status || (normalizedInitial.done ? 'Done' : 'Todo'),
          progress: clampProgress(normalizedInitial.progress),
        }
      : {
          name: '',
          setDate: today,
          description: '',
          expense: '',
          file: null,
          due: '',
          status: 'Todo',
          progress: 0,
          ...defaultAssignee,
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

  // Moving the status to Done means finished, so pull progress up to 100.
  // Leaving Done keeps whatever number is there.
  const setStatus = (status) =>
    setForm((s) => ({ ...s, status, progress: progressForStatus(status, s.progress) }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit({
      ...form,
      expense: Number(form.expense) || 0,
      progress: progressForStatus(form.status, form.progress),
      // Keep the completion timestamp in sync with the status — the team
      // report needs it to place finished work in the right week.
      doneAt: doneStamp(form.status, initial?.doneAt),
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
          <label className="label">{t('field.status')}</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
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

      <ProgressField
        value={form.progress}
        onChange={(progress) => setForm((s) => ({ ...s, progress }))}
      />

      <div>
        <label className="label">{t('partner.task.fields.setDate')}</label>
        <input
          className="input"
          type="date"
          value={form.setDate}
          onChange={(e) => setForm({ ...form, setDate: e.target.value })}
        />
      </div>

      <AssigneeField
        team={team}
        assigneeId={form.assigneeId}
        assignee={form.assignee}
        onChange={(patch) => setForm((s) => ({ ...s, ...patch }))}
      />

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
