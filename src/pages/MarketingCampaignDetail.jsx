import { useState, useRef } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Calendar, Package, Image as ImageIcon, Video,
  Layers, Star, Paperclip, Download, Upload, FileSpreadsheet, Loader2, Radio,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import { CAMPAIGN_STATUS, statusStyle, formatDateRange } from './Marketing.jsx'
import { parsePostsFile, downloadTemplate, exportPostsExcel } from '../utils/campaignExcel.js'

const POST_TYPES = ['Image', 'Video', 'Carousel', 'Reel', 'Story', 'Article', 'Other']
const POST_CHANNELS = [
  'Facebook', 'Instagram', 'TikTok', 'YouTube',
  'LinkedIn', 'X (Twitter)', 'Threads', 'Telegram', 'Other',
]
const FILE_LIMIT_BYTES = 1024 * 1024 // 1 MB

const channelStyle = (c) =>
    c === 'Facebook'    ? 'bg-blue-100 text-blue-700'
  : c === 'Instagram'   ? 'bg-pink-100 text-pink-700'
  : c === 'TikTok'      ? 'bg-shadow text-white'
  : c === 'YouTube'     ? 'bg-red-100 text-red-700'
  : c === 'LinkedIn'    ? 'bg-sky-100 text-sky-700'
  : c === 'X (Twitter)' ? 'bg-iron text-white'
  : c === 'Threads'     ? 'bg-violet-100 text-violet-700'
  : c === 'Telegram'    ? 'bg-cyan-100 text-cyan-700'
  : 'bg-iron text-white/75'

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
  : type === 'Article'   ? 'bg-iron text-white/85'
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
        setImportError('No rows detected. Make sure the sheet has Post Date / Post Concept columns.')
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
                <p className="text-xs md:text-sm text-white/75 mt-1 whitespace-pre-wrap">
                  {campaign.description}
                </p>
              )}
            </div>
            <button
              onClick={() => setEditingCampaign(true)}
              className="p-2 rounded-full hover:bg-iron text-steel shrink-0"
              aria-label="Edit campaign"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`pill ${statusStyle(campaign.status)}`}>{campaign.status}</span>
            <span className="pill bg-iron text-white/75">
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
            <h2 className="text-sm md:text-base font-semibold text-white">
              To-do list
            </h2>
            <span className="text-xs text-steel">
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
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-shadow bg-charcoal text-white/85 hover:bg-iron disabled:opacity-60"
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
            <p className="text-center text-sm text-steel py-6">
              No posts scheduled yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedTodos.map((t) => {
                const TypeIcon = postTypeIcon(t.type)
                const isImage = t.artwork?.type?.startsWith('image/')
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => { setEditingTodo(t); setTodoModalOpen(true) }}
                      className="card w-full text-left space-y-2 active:bg-iron"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-steel">
                          {t.postDate || 'No date'}
                        </span>
                        <span className={`pill ml-auto ${postTypePill(t.type)}`}>
                          <TypeIcon className="w-3 h-3 mr-1" /> {t.type}
                        </span>
                        {t.channel && (
                          <span className={`pill ${channelStyle(t.channel)}`}>
                            <Radio className="w-3 h-3 mr-1" /> {t.channel}
                          </span>
                        )}
                      </div>
                      {t.concept && (
                        <p className="text-sm md:text-base font-semibold leading-snug">
                          {t.concept}
                        </p>
                      )}
                      {t.keyFeature && (
                        <p className="text-[11px] md:text-xs text-steel flex items-center gap-1">
                          <Star className="w-3 h-3" /> {t.keyFeature}
                        </p>
                      )}
                      {t.caption && (
                        <p className="text-xs md:text-sm text-white/75 line-clamp-3 whitespace-pre-wrap">
                          {t.caption}
                        </p>
                      )}
                      {t.artwork && (
                        isImage ? (
                          <img
                            src={t.artwork.dataUrl}
                            alt={t.artwork.name}
                            className="w-full max-h-56 object-cover rounded-lg border border-shadow"
                          />
                        ) : (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-iron border border-shadow">
                            <Paperclip className="w-3.5 h-3.5 text-steel" />
                            <span className="text-xs truncate">{t.artwork.name}</span>
                          </div>
                        )
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
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
          {CAMPAIGN_STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <button className="btn-primary w-full mt-2">Save changes</button>
    </form>
  )
}

function TodoForm({ initial, onSubmit, onDelete }) {
  const [form, setForm] = useState(
    initial || {
      postDate: new Date().toISOString().slice(0, 10),
      concept: '',
      type: 'Image',
      channel: '',
      keyFeature: '',
      caption: '',
      artwork: null,
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
        artwork: { name: f.name, type: f.type, size: f.size, dataUrl: reader.result },
      }))
    }
    reader.readAsDataURL(f)
  }

  const isImage = form.artwork?.type?.startsWith('image/')

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form) }}
      className="space-y-3"
    >
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
        <label className="label">Post concept</label>
        <input
          className="input"
          value={form.concept}
          onChange={(e) => setForm({ ...form, concept: e.target.value })}
          placeholder="Founder story — why we built X"
        />
      </div>

      <div>
        <label className="label">Key feature</label>
        <input
          className="input"
          value={form.keyFeature}
          onChange={(e) => setForm({ ...form, keyFeature: e.target.value })}
          placeholder="One-tap invoicing"
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
        <label className="label">Artwork</label>
        {form.artwork ? (
          <div className="space-y-2">
            {isImage && (
              <img
                src={form.artwork.dataUrl}
                alt={form.artwork.name}
                className="w-full max-h-64 object-cover rounded-xl border border-shadow"
              />
            )}
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-shadow bg-iron">
              <Paperclip className="w-4 h-4 text-steel shrink-0" />
              <span className="text-sm flex-1 min-w-0 truncate">{form.artwork.name}</span>
              <a
                href={form.artwork.dataUrl}
                download={form.artwork.name}
                className="p-1.5 text-steel hover:bg-iron rounded"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setForm({ ...form, artwork: null })}
                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-graphite text-sm text-steel cursor-pointer hover:bg-iron">
            <Paperclip className="w-4 h-4" />
            Attach artwork (max 1 MB)
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
          {initial ? 'Save changes' : 'Save post'}
        </button>
      </div>
    </form>
  )
}

