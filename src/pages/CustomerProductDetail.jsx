import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import {
  Send, Paperclip, ListChecks, Type, Image as ImageIcon, Video,
  FileText, FileSpreadsheet, FileArchive, Download, Trash2, Share2,
  Check, Clock, Circle as CircleIcon, ArrowUp,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'

const FILE_LIMIT_BYTES = 1024 * 1024 // 1 MB

const TASK_STATUSES = [
  { value: 'todo',         label: 'Todo',        icon: CircleIcon },
  { value: 'in_progress',  label: 'In progress', icon: Clock },
  { value: 'done',         label: 'Done',        icon: Check },
]

const cycleStatus = (s) => {
  const idx = TASK_STATUSES.findIndex((t) => t.value === s)
  return TASK_STATUSES[(idx + 1) % TASK_STATUSES.length].value
}

const statusStyle = (s) =>
  s === 'done'
    ? 'bg-wise-green text-wise-dark'
    : s === 'in_progress'
    ? 'bg-warning text-near-black'
    : 'bg-iron text-graphite'

const formatBytes = (b) => {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

const fileIconFor = (mime = '') => {
  if (mime.startsWith('image/')) return ImageIcon
  if (mime.startsWith('video/')) return Video
  if (mime.includes('zip') || mime.includes('compressed')) return FileArchive
  if (mime.includes('sheet') || mime.includes('csv')) return FileSpreadsheet
  return FileText
}

const formatTimestamp = (ts) => {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatDayHeader = (ts) => {
  const d = new Date(ts)
  const today = new Date()
  const yest = new Date(); yest.setDate(yest.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CustomerProductDetail() {
  const { id, linkId } = useParams()
  const {
    state,
    addCustomerProductActivity,
    updateCustomerProductActivity,
    removeCustomerProductActivity,
  } = useStore()

  const customer = state.customers.find((c) => c.id === id)
  const link = customer?.productLinks?.find((l) => l.id === linkId)
  const product = link ? state.products.find((p) => p.id === link.productId) : null

  const threadRef = useRef(null)
  const fileInputRef = useRef(null)

  const [side, setSide] = useState('mine')
  const [type, setType] = useState('text')
  const [draftText, setDraftText] = useState('')
  const [draftTaskTitle, setDraftTaskTitle] = useState('')

  const activities = useMemo(
    () => [...(link?.activities || [])].sort((a, b) => (a.ts || '').localeCompare(b.ts || '')),
    [link?.activities],
  )

  // Auto-scroll thread to bottom whenever activity count changes.
  useEffect(() => {
    if (!threadRef.current) return
    threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [activities.length])

  if (!customer) return <Navigate to="/customers" replace />
  if (!link || !product) return <Navigate to={`/customers/${id}`} replace />

  // ----- Handlers -----

  const sendText = () => {
    const text = draftText.trim()
    if (!text) return
    addCustomerProductActivity(customer.id, link.id, { side, type: 'text', text })
    setDraftText('')
  }

  const sendTask = () => {
    const title = draftTaskTitle.trim()
    if (!title) return
    addCustomerProductActivity(customer.id, link.id, {
      side,
      type: 'task',
      taskTitle: title,
      taskStatus: 'todo',
    })
    setDraftTaskTitle('')
  }

  const onFilePicked = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > FILE_LIMIT_BYTES) {
      alert(`"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)} MB — max 1 MB per file.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      addCustomerProductActivity(customer.id, link.id, {
        side,
        type: 'file',
        file: { name: f.name, type: f.type, size: f.size, dataUrl: reader.result },
        text: draftText.trim() || '',
      })
      setDraftText('')
    }
    reader.readAsDataURL(f)
  }

  const cycleTask = (entry) =>
    updateCustomerProductActivity(customer.id, link.id, entry.id, {
      taskStatus: cycleStatus(entry.taskStatus),
    })

  const removeEntry = (entry) => {
    if (!confirm('Remove this entry from the thread?')) return
    removeCustomerProductActivity(customer.id, link.id, entry.id)
  }

  // ----- Export thread to Markdown -----

  const exportMarkdown = () => {
    const lines = []
    lines.push(`# Activity log — ${product.name} × ${customer.name}`)
    lines.push(`Exported ${new Date().toLocaleString()}`)
    lines.push('')
    let lastDay = ''
    for (const a of activities) {
      const day = formatDayHeader(a.ts)
      if (day !== lastDay) {
        lines.push(`## ${day}`)
        lines.push('')
        lastDay = day
      }
      const time = formatTimestamp(a.ts)
      const who = a.side === 'mine' ? 'My team' : customer.name
      if (a.type === 'text') {
        lines.push(`- **${time} · ${who}**: ${a.text}`)
      } else if (a.type === 'file') {
        const f = a.file || {}
        lines.push(`- **${time} · ${who}** uploaded \`${f.name}\` (${formatBytes(f.size)})${a.text ? ` — ${a.text}` : ''}`)
      } else if (a.type === 'task') {
        lines.push(`- **${time} · ${who}** task: \`${a.taskTitle}\` — _${a.taskStatus}_`)
      }
    }
    if (activities.length === 0) lines.push('_(empty)_')
    const md = lines.join('\n')
    const safeName = (product.name + '-' + customer.name).replace(/[^A-Za-z0-9-_]+/g, '_')
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-${safeName}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ----- Day grouping for the thread -----

  const grouped = useMemo(() => {
    const out = []
    let lastDay = ''
    for (const a of activities) {
      const day = formatDayHeader(a.ts)
      if (day !== lastDay) {
        out.push({ kind: 'day', label: day, key: `day-${out.length}` })
        lastDay = day
      }
      out.push({ kind: 'entry', entry: a, key: a.id })
    }
    return out
  }, [activities])

  // ----- Render -----

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -mt-4 md:-mt-6 -mx-3 md:-mx-6">
      <div className="px-3 md:px-6 pt-4 md:pt-6">
        <PageHeader
          action={
            <button
              onClick={exportMarkdown}
              className="btn-ghost !px-3 !py-1.5 text-xs"
              title="Download markdown"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          }
        />
      </div>

      {/* Thread (scrollable) */}
      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto px-3 md:px-6 space-y-3"
        style={{ scrollBehavior: 'smooth' }}
      >
        {activities.length === 0 ? (
          <div className="card text-center py-10 mb-3">
            <p className="display text-2xl text-near-black">Start the thread.</p>
            <p className="text-sm text-graphite mt-2 max-w-sm mx-auto">
              Capture every conversation, file and task linking your team to {customer.name} on{' '}
              {product.name}.
            </p>
          </div>
        ) : (
          grouped.map((row) =>
            row.kind === 'day' ? (
              <div key={row.key} className="flex items-center gap-3 py-2">
                <span className="flex-1 h-px bg-shadow" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-graphite">
                  {row.label}
                </span>
                <span className="flex-1 h-px bg-shadow" />
              </div>
            ) : (
              <ChatBubble
                key={row.key}
                entry={row.entry}
                customer={customer}
                onCycleTask={cycleTask}
                onRemove={removeEntry}
              />
            ),
          )
        )}
      </div>

      {/* Composer (sticky bottom) */}
      <div className="border-t border-shadow bg-white px-3 md:px-6 py-3 md:py-4">
        <div className="flex items-center gap-2 mb-2.5">
          <SideToggle value={side} onChange={setSide} customerName={customer.name} />
          <TypeToggle value={type} onChange={setType} />
        </div>

        {type === 'text' && (
          <div className="flex items-end gap-2">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  sendText()
                }
              }}
              placeholder={
                side === 'mine'
                  ? 'Note from your team…'
                  : `What did ${customer.name} say or do?`
              }
              rows={1}
              className="input flex-1 min-h-[42px] max-h-32 resize-none"
            />
            <button
              type="button"
              onClick={sendText}
              disabled={!draftText.trim()}
              className="btn-primary !px-4 !py-2.5"
              aria-label="Send"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        )}

        {type === 'file' && (
          <div className="space-y-2">
            <input type="file" ref={fileInputRef} onChange={onFilePicked} className="hidden" />
            <input
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Optional caption"
              className="input"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary flex-1"
              >
                <Paperclip className="w-4 h-4" /> Attach &amp; send
              </button>
              <p className="text-[11px] text-graphite self-center px-1">1 MB max</p>
            </div>
          </div>
        )}

        {type === 'task' && (
          <div className="flex items-end gap-2">
            <input
              value={draftTaskTitle}
              onChange={(e) => setDraftTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  sendTask()
                }
              }}
              placeholder="Task title…"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={sendTask}
              disabled={!draftTaskTitle.trim()}
              className="btn-primary !px-4 !py-2.5"
              aria-label="Add task"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SideToggle({ value, onChange, customerName }) {
  const customerLabel = customerName.length > 12 ? customerName.slice(0, 11) + '…' : customerName
  return (
    <div className="inline-flex bg-iron p-1 rounded-full text-xs font-bold">
      <button
        type="button"
        onClick={() => onChange('customer')}
        className={`px-3 py-1.5 rounded-full transition-colors ${
          value === 'customer' ? 'bg-white text-near-black shadow-ring-soft' : 'text-graphite'
        }`}
      >
        {customerLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange('mine')}
        className={`px-3 py-1.5 rounded-full transition-colors ${
          value === 'mine' ? 'bg-wise-green text-wise-dark' : 'text-graphite'
        }`}
      >
        My team
      </button>
    </div>
  )
}

function TypeToggle({ value, onChange }) {
  const items = [
    { v: 'text', icon: Type,        label: 'Text' },
    { v: 'file', icon: Paperclip,   label: 'File' },
    { v: 'task', icon: ListChecks,  label: 'Task' },
  ]
  return (
    <div className="inline-flex bg-iron p-1 rounded-full text-xs font-bold ml-auto">
      {items.map((it) => {
        const active = value === it.v
        return (
          <button
            key={it.v}
            type="button"
            onClick={() => onChange(it.v)}
            className={`px-2.5 py-1.5 rounded-full transition-colors flex items-center gap-1 ${
              active ? 'bg-white text-near-black shadow-ring-soft' : 'text-graphite'
            }`}
          >
            <it.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function ChatBubble({ entry, customer, onCycleTask, onRemove }) {
  const isMine = entry.side === 'mine'
  const align = isMine ? 'items-end' : 'items-start'
  const bubbleColor = isMine
    ? 'bg-wise-green text-wise-dark border-wise-dark/15'
    : 'bg-iron text-near-black border-shadow'
  const author = isMine ? 'My team' : customer.name

  return (
    <div className={`flex flex-col ${align} group`}>
      <div className="flex items-center gap-2 mb-1 px-1 max-w-[85%]">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isMine ? 'text-wise-dark' : 'text-graphite'}`}>
          {author}
        </span>
        <span className="text-[10px] text-graphite">{formatTimestamp(entry.ts)}</span>
      </div>
      <div className={`relative max-w-[85%] md:max-w-[70%] border ${bubbleColor}`} style={{ borderRadius: '20px' }}>
        {entry.type === 'text' && <TextBody entry={entry} />}
        {entry.type === 'file' && <FileBody entry={entry} />}
        {entry.type === 'task' && (
          <TaskBody entry={entry} onCycle={() => onCycleTask(entry)} />
        )}
        <button
          onClick={() => onRemove(entry)}
          className="absolute -top-2 -right-2 p-1 bg-white border border-shadow rounded-full text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove entry"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function TextBody({ entry }) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed px-4 py-2.5">
      {entry.text}
    </p>
  )
}

function FileBody({ entry }) {
  const f = entry.file || {}
  const Icon = fileIconFor(f.type)
  const isImage = f.type?.startsWith('image/')
  return (
    <div className="px-3 py-2.5 space-y-2">
      {isImage && f.dataUrl ? (
        <img
          src={f.dataUrl}
          alt={f.name}
          className="max-w-full max-h-64 object-contain rounded-lg border border-white/40"
        />
      ) : (
        <div className="flex items-center gap-2 p-2 bg-white/40 rounded-lg">
          <Icon className="w-4 h-4 shrink-0" />
          <span className="text-sm flex-1 min-w-0 truncate">{f.name}</span>
          <span className="text-[10px] text-graphite shrink-0">{formatBytes(f.size)}</span>
        </div>
      )}
      {entry.text && (
        <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
      )}
      {f.dataUrl && (
        <a
          href={f.dataUrl}
          download={f.name}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-wise-dark hover:underline"
        >
          <Download className="w-3 h-3" /> Download
        </a>
      )}
    </div>
  )
}

function TaskBody({ entry, onCycle }) {
  const status = TASK_STATUSES.find((t) => t.value === entry.taskStatus) || TASK_STATUSES[0]
  const StatusIcon = status.icon
  return (
    <div className="px-4 py-2.5 space-y-1.5">
      <p className="text-sm font-semibold leading-snug">{entry.taskTitle}</p>
      <button
        type="button"
        onClick={onCycle}
        className={`pill ${statusStyle(entry.taskStatus)} text-[10px] font-bold`}
      >
        <StatusIcon className="w-3 h-3 mr-1" />
        {status.label}
      </button>
    </div>
  )
}
