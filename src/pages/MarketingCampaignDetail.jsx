import { useState, useRef, useEffect } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Calendar, Package, Image as ImageIcon, Video,
  Layers, Paperclip, Download, Upload, FileSpreadsheet, Loader2, Radio,
  X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import { CAMPAIGN_STATUS, statusStyle, formatDateRange } from './Marketing.jsx'
import { parsePostsFile, downloadTemplate, exportPostsExcel } from '../utils/campaignExcel.js'
import AuthImage from '../components/AuthImage.jsx'
import { persistImageRef, fileContentPath } from '../utils/imageRef.js'
import { getBlob } from '../api/client.js'

const POST_TYPES = ['Image', 'Video', 'Carousel', 'Reel', 'Story', 'Article', 'Other']
const POST_CHANNELS = [
  'Facebook', 'Instagram', 'TikTok', 'YouTube',
  'LinkedIn', 'X (Twitter)', 'Threads', 'Telegram', 'Other',
]
const POST_STATUSES = [
  { value: 'draft',     label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
]
const cyclePostStatus = (s) => {
  const idx = POST_STATUSES.findIndex((x) => x.value === s)
  return POST_STATUSES[(idx + 1) % POST_STATUSES.length].value
}
const postStatusPill = (s) =>
  s === 'published' ? 'bg-wise-green text-wise-dark'
  : s === 'scheduled' ? 'bg-brand-100 text-brand-800'
  : s === 'cancelled' ? 'bg-rose-100 text-rose-700'
  : 'bg-iron text-graphite'
const postStatusLabel = (s) =>
  POST_STATUSES.find((x) => x.value === s)?.label || 'Draft'
const FILE_LIMIT_BYTES = 1024 * 1024 // 1 MB

const normalizeArtworks = (todo) => {
  if (Array.isArray(todo?.artworks) && todo.artworks.length) return todo.artworks
  if (todo?.artwork) return [todo.artwork]
  return []
}

// Trigger a download for an artwork (legacy dataUrl or a stored file ref).
// File-backed artwork needs an authenticated fetch (a plain <a download>
// can't send the Bearer token), so we pull the bytes and save a blob URL.
async function downloadArtwork(item) {
  const name = item?.name || 'artwork'
  let href = item?.dataUrl
  let revoke
  if (!href && item?.fileId) {
    const blob = await getBlob(fileContentPath(item.fileId))
    href = URL.createObjectURL(blob)
    revoke = href
  }
  if (!href) return
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 1000)
}

const channelStyle = (c) =>
    c === 'Facebook'    ? 'bg-blue-100 text-blue-700'
  : c === 'Instagram'   ? 'bg-pink-100 text-pink-700'
  : c === 'TikTok'      ? 'bg-near-black text-white'
  : c === 'YouTube'     ? 'bg-red-100 text-red-700'
  : c === 'LinkedIn'    ? 'bg-sky-100 text-sky-700'
  : c === 'X (Twitter)' ? 'bg-near-black text-white'
  : c === 'Threads'     ? 'bg-violet-100 text-violet-700'
  : c === 'Telegram'    ? 'bg-cyan-100 text-cyan-700'
  : 'bg-iron text-graphite'

const postTypeIcon = (type) => {
  if (type === 'Video' || type === 'Reel') return Video
  if (type === 'Carousel') return Layers
  return ImageIcon
}

const postTypePill = (type) =>
  type === 'Reel'      ? 'bg-rose-100 text-rose-700'
  : type === 'Video'     ? 'bg-violet-100 text-violet-700'
  : type === 'Carousel'  ? 'bg-amber-100 text-amber-700'
  : type === 'Story'     ? 'bg-sky-100 text-sky-700'
  : type === 'Article'   ? 'bg-iron text-near-black'
  : 'bg-emerald-100 text-emerald-700'

export default function MarketingCampaignDetail() {
  const { id } = useParams()
  const {
    state,
    updateCampaign,
    removeCampaign,
    addCampaignTodo,
    updateCampaignTodo,
    removeCampaignTodo,
    replaceCampaignTodos,
  } = useStore()

  const campaign = (state.campaigns || []).find((c) => c.id === id)
  const [editingCampaign, setEditingCampaign] = useState(false)
  const [todoModalOpen, setTodoModalOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef(null)

  if (!campaign) return <Navigate to="/marketing" replace />

  const product = state.products.find((p) => p.id === campaign.productId)

  const closeTodoModal = () => {
    setTodoModalOpen(false)
    setEditingTodo(null)
  }

  const onImportClick = () => {
    setImportError('')
    fileInputRef.current?.click()
  }

  const onFilePicked = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setImporting(true)
    setImportError('')
    try {
      const todos = await parsePostsFile(f)
      if (todos.length === 0) {
        setImportError('No rows detected. Make sure the sheet has Post Date / Post Title columns.')
        return
      }
      const ok = window.confirm(
        `Import ${todos.length} post${todos.length !== 1 ? 's' : ''} and REPLACE the current list?\n\nClick Cancel to abort.`,
      )
      if (!ok) return
      replaceCampaignTodos(campaign.id, todos)
    } catch (err) {
      console.error(err)
      setImportError('Could not read this file. Use the template format (.xlsx or .csv).')
    } finally {
      setImporting(false)
    }
  }

  const onTemplateClick = async () => {
    try {
      await downloadTemplate(`${(campaign.name || 'campaign').replace(/[^A-Za-z0-9-_]+/g, '_')}-template.xlsx`)
    } catch (err) {
      console.error(err)
      setImportError('Could not generate template.')
    }
  }

  const onExportClick = async () => {
    try {
      await exportPostsExcel(campaign)
    } catch (err) {
      console.error(err)
      setImportError('Could not export current posts.')
    }
  }

  const sortedTodos = [...(campaign.todos || [])].sort(
    (a, b) => (a.postDate || '').localeCompare(b.postDate || ''),
  )

  return (
    <>
      <PageHeader
        subtitle={`${campaign.status} · ${formatDateRange(campaign.startDate, campaign.endDate)}`}
        action={
          <button
            onClick={() => {
              if (confirm(`Delete "${campaign.name}"? Posts will be lost too.`)) {
                removeCampaign(campaign.id)
                history.back()
              }
            }}
            className="p-2 rounded-full hover:bg-rose-50 text-rose-500"
            aria-label="Delete campaign"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        }
      />

      <div className="space-y-4">
        <section className="card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-base md:text-lg font-bold leading-tight">{campaign.name}</p>
              {campaign.description && (
                <p className="text-xs md:text-sm text-graphite mt-1 whitespace-pre-wrap">
                  {campaign.description}
                </p>
              )}
            </div>
            <button
              onClick={() => setEditingCampaign(true)}
              className="p-2 rounded-full hover:bg-iron text-graphite shrink-0"
              aria-label="Edit campaign"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`pill ${statusStyle(campaign.status)}`}>{campaign.status}</span>
            <span className="pill bg-iron text-graphite">
              <Calendar className="w-3 h-3 mr-1" />
              {formatDateRange(campaign.startDate, campaign.endDate)}
            </span>
            {product && (
              <Link
                to={`/products/${product.id}`}
                className="pill bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              >
                <Package className="w-3 h-3 mr-1" /> {product.name}
              </Link>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm md:text-base font-semibold text-near-black">
              To-do list
            </h2>
            <span className="text-xs text-graphite">
              {sortedTodos.length} post{sortedTodos.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setEditingTodo(null); setTodoModalOpen(true) }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" /> Add post
            </button>
            <button
              onClick={onImportClick}
              disabled={importing}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-shadow bg-charcoal text-near-black hover:bg-iron disabled:opacity-60"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Importing…
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" /> Import Excel
                </>
              )}
            </button>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs">
            <button
              onClick={onTemplateClick}
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
            >
              <Download className="w-3 h-3" /> Download template
            </button>
            {sortedTodos.length > 0 && (
              <>
                <span className="text-graphite">·</span>
                <button
                  onClick={onExportClick}
                  className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                >
                  <Upload className="w-3 h-3 rotate-180" /> Export current posts
                </button>
              </>
            )}
          </div>
          {importError && (
            <p className="text-xs text-rose-600 px-1">{importError}</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={onFilePicked}
          />

          {sortedTodos.length === 0 ? (
            <p className="text-center text-sm text-graphite py-6">
              No posts scheduled yet.
            </p>
          ) : (
            <div className="overflow-x-auto border border-shadow rounded-2xl bg-white">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-iron sticky top-0 z-10">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-graphite">
                    <th className="px-3 py-2 w-10">#</th>
                    <th className="px-3 py-2 whitespace-nowrap">Status</th>
                    <th className="px-3 py-2 whitespace-nowrap">Post date</th>
                    <th className="px-3 py-2 min-w-[180px]">Post title</th>
                    <th className="px-3 py-2 whitespace-nowrap">Type</th>
                    <th className="px-3 py-2 whitespace-nowrap">Channel</th>
                    <th className="px-3 py-2 min-w-[260px]">Caption</th>
                    <th className="px-3 py-2 whitespace-nowrap">Artwork</th>
                    <th className="px-3 py-2 w-10" aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTodos.map((t, idx) => {
                    const TypeIcon = postTypeIcon(t.type)
                    const artworks = normalizeArtworks(t)
                    const firstArtwork = artworks[0]
                    const isImage = firstArtwork?.type?.startsWith('image/')
                    return (
                      <tr
                        key={t.id}
                        onClick={() => { setEditingTodo(t); setTodoModalOpen(true) }}
                        className="border-t border-shadow hover:bg-iron cursor-pointer transition-colors align-top"
                      >
                        <td className="px-3 py-2.5 text-[11px] font-bold text-graphite">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateCampaignTodo(campaign.id, t.id, {
                                postStatus: cyclePostStatus(t.postStatus || 'draft'),
                              })
                            }}
                            className={`pill ${postStatusPill(t.postStatus || 'draft')} hover:scale-105 active:scale-95 transition-transform`}
                            title="Click to cycle status"
                          >
                            {postStatusLabel(t.postStatus || 'draft')}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-near-black whitespace-nowrap tabular-nums">
                          {t.postDate || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-near-black">
                          <span className="line-clamp-2">{t.concept || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`pill ${postTypePill(t.type)}`}>
                            <TypeIcon className="w-3 h-3 mr-1" /> {t.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {t.channel ? (
                            <span className={`pill ${channelStyle(t.channel)}`}>
                              <Radio className="w-3 h-3 mr-1" /> {t.channel}
                            </span>
                          ) : (
                            <span className="text-xs text-graphite">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-graphite">
                          {t.caption ? (
                            <span className="line-clamp-2 whitespace-pre-wrap">{t.caption}</span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {firstArtwork ? (
                            <div className="relative inline-block">
                              {isImage ? (
                                <AuthImage
                                  value={firstArtwork}
                                  alt={firstArtwork.name}
                                  className="w-12 h-12 object-cover rounded-md border border-shadow"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-graphite max-w-[140px]">
                                  <Paperclip className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{firstArtwork.name}</span>
                                </span>
                              )}
                              {artworks.length > 1 && (
                                <span className="absolute -top-1 -right-1 bg-near-black text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                                  +{artworks.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-graphite">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-graphite text-right">
                          <Pencil className="w-3.5 h-3.5 inline-block" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={editingCampaign}
        onClose={() => setEditingCampaign(false)}
        title="Edit campaign"
      >
        <CampaignForm
          key={`edit-${campaign.id}`}
          initial={campaign}
          products={state.products}
          onSubmit={(patch) => {
            updateCampaign(campaign.id, patch)
            setEditingCampaign(false)
          }}
        />
      </Modal>

      <Modal
        open={todoModalOpen}
        onClose={closeTodoModal}
        title={editingTodo ? 'Edit post' : 'New post'}
      >
        <TodoForm
          key={editingTodo?.id || 'new'}
          initial={editingTodo}
          onDelete={
            editingTodo
              ? () => {
                  if (confirm('Delete this post?')) {
                    removeCampaignTodo(campaign.id, editingTodo.id)
                    closeTodoModal()
                  }
                }
              : null
          }
          onSubmit={(data) => {
            if (editingTodo) updateCampaignTodo(campaign.id, editingTodo.id, data)
            else addCampaignTodo(campaign.id, data)
            closeTodoModal()
          }}
        />
      </Modal>
    </>
  )
}

function CampaignForm({ initial, products, onSubmit }) {
  const { t } = useT()
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    productId: initial?.productId || (products[0]?.id ?? ''),
    startDate: initial?.startDate || '',
    endDate: initial?.endDate || '',
    status: initial?.status || 'Planning',
  })
  const change = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (form.name.trim()) onSubmit(form) }}
      className="space-y-3"
    >
      <div>
        <label className="label">Campaign name *</label>
        <input className="input" autoFocus value={form.name} onChange={change('name')} />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          className="input min-h-[80px]"
          value={form.description}
          onChange={change('description')}
        />
      </div>
      <div>
        <label className="label">Product / Service</label>
        <select className="input" value={form.productId} onChange={change('productId')}>
          <option value="">— None —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.type})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Start date</label>
          <input className="input" type="date" value={form.startDate} onChange={change('startDate')} />
        </div>
        <div>
          <label className="label">End date</label>
          <input className="input" type="date" value={form.endDate} onChange={change('endDate')} />
        </div>
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" value={form.status} onChange={change('status')}>
          {CAMPAIGN_STATUS.map((s) => (
            <option key={s.value} value={s.value}>{t(s.tKey)}</option>
          ))}
        </select>
      </div>
      <button className="btn-primary w-full mt-2">Save changes</button>
    </form>
  )
}

function TodoForm({ initial, onSubmit, onDelete }) {
  const [form, setForm] = useState(() => {
    const base = initial || {
      postDate: new Date().toISOString().slice(0, 10),
      concept: '',
      type: 'Image',
      channel: '',
      caption: '',
      postStatus: 'draft',
    }
    return { ...base, artworks: normalizeArtworks(base) }
  })
  const [fileError, setFileError] = useState('')
  const [previewIndex, setPreviewIndex] = useState(null)
  const [uploading, setUploading] = useState(false)

  const readFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result,
      })
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const onFile = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const tooBig = files.find((f) => f.size > FILE_LIMIT_BYTES)
    if (tooBig) {
      setFileError(`"${tooBig.name}" is ${(tooBig.size / 1024 / 1024).toFixed(1)} MB — max 1 MB per file.`)
      return
    }
    setFileError('')
    setUploading(true)
    try {
      const loaded = await Promise.all(files.map(readFile))
      setForm((s) => ({ ...s, artworks: [...(s.artworks || []), ...loaded] }))
    } catch {
      setFileError('Could not read one of the selected files.')
    } finally {
      setUploading(false)
    }
  }

  const removeArtwork = (idx) => {
    setForm((s) => ({
      ...s,
      artworks: (s.artworks || []).filter((_, i) => i !== idx),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Move any freshly-attached artwork (held as a dataUrl) into the File store
    // so campaign rows never carry base64 bytes.
    const artworks = await Promise.all(
      (form.artworks || []).map((a) => persistImageRef(a, { entityType: 'campaign' })),
    )
    onSubmit({ ...form, artworks, artwork: artworks[0] || null })
  }

  const artworks = form.artworks || []
  const previewItem = previewIndex != null ? artworks[previewIndex] : null

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Post date *</label>
          <input
            className="input"
            type="date"
            autoFocus
            value={form.postDate}
            onChange={(e) => setForm({ ...form, postDate: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Post type</label>
          <select
            className="input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {POST_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Post channel</label>
          <select
            className="input"
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value })}
          >
            <option value="">— Pick a channel —</option>
            {POST_CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={form.postStatus || 'draft'}
            onChange={(e) => setForm({ ...form, postStatus: e.target.value })}
          >
            {POST_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Post title</label>
        <input
          className="input"
          value={form.concept}
          onChange={(e) => setForm({ ...form, concept: e.target.value })}
          placeholder="Founder story — why we built X"
        />
      </div>

      <div>
        <label className="label">Caption</label>
        <textarea
          className="input min-h-[100px]"
          value={form.caption}
          onChange={(e) => setForm({ ...form, caption: e.target.value })}
          placeholder="Hook + benefit + CTA"
        />
      </div>

      <div>
        <label className="label">
          Artwork {artworks.length > 0 && <span className="text-graphite font-normal">({artworks.length})</span>}
        </label>
        {artworks.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            {artworks.map((a, idx) => {
              const isImg = a.type?.startsWith('image/')
              return (
                <div
                  key={`${a.name}-${idx}`}
                  className="relative group rounded-xl border border-shadow overflow-hidden bg-iron"
                >
                  {isImg ? (
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(idx)}
                      className="block w-full aspect-square"
                      aria-label={`Preview ${a.name}`}
                    >
                      <AuthImage
                        value={a}
                        alt={a.name}
                        className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                      />
                    </button>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 aspect-square p-2 text-graphite">
                      <Paperclip className="w-5 h-5" />
                      <span className="text-[10px] text-center truncate w-full">{a.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeArtwork(idx)}
                    className="absolute top-1 right-1 p-1 bg-white/90 text-rose-500 rounded-full shadow hover:bg-white"
                    aria-label={`Remove ${a.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <label
          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-graphite text-sm text-graphite ${
            uploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-iron'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Paperclip className="w-4 h-4" />
              {artworks.length > 0 ? 'Add more artwork' : 'Attach artwork (max 1 MB each)'}
            </>
          )}
          <input
            type="file"
            className="hidden"
            multiple
            disabled={uploading}
            onChange={onFile}
          />
        </label>
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
          {initial ? 'Save changes' : 'Save post'}
        </button>
      </div>

      {previewItem && (
        <ArtworkPreview
          item={previewItem}
          index={previewIndex}
          total={artworks.length}
          onClose={() => setPreviewIndex(null)}
          onPrev={() => setPreviewIndex((i) => (i - 1 + artworks.length) % artworks.length)}
          onNext={() => setPreviewIndex((i) => (i + 1) % artworks.length)}
        />
      )}
    </form>
  )
}

function ArtworkPreview({ item, index, total, onClose, onPrev, onNext }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && total > 1) onPrev()
      else if (e.key === 'ArrowRight' && total > 1) onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext, total])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-near-black/80 backdrop-blur-sm" />
      <div
        className="relative max-w-[92vw] max-h-[92vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <AuthImage
          value={item}
          alt={item.name}
          className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
        />
        <div className="flex items-center gap-3 text-white text-sm">
          <span className="truncate max-w-[60vw]">{item.name}</span>
          {total > 1 && <span className="text-white/70">{index + 1} / {total}</span>}
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-white/10"
            aria-label="Download"
            onClick={(e) => { e.stopPropagation(); downloadArtwork(item) }}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={onPrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Previous"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={onNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 p-1.5 rounded-full bg-white text-near-black shadow hover:bg-iron"
          aria-label="Close preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

