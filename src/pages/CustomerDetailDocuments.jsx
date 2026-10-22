import { useState } from 'react'
import {
  Upload, Trash2, Download, Eye, Lock, FileSignature, ArrowDownToLine,
  FileText, FileImage, FileSpreadsheet, FileVideo, FileArchive, FileCode,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import { renewalState } from '../utils/payments.js'

// Documents tab on Customer detail: Agreements (contracts with start and
// renewal dates, which drive renewal reminders and health) and Other files.
// They stay two lists on the customer (agreements / files) — a document is in
// exactly one, and moving it changes both in one save (moveCustomerDocument).
// Agreements need the 'customers.agreements' ability; deleting a file needs
// 'customers.delete', as before the merge.

const FILE_LIMIT_BYTES = 1024 * 1024 // 1 MB (documents are stored inline)

const formatBytes = (b) => {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

// The icon for a document's type.
function DocIcon({ mime = '' }) {
  const c = 'w-5 h-5'
  if (mime.startsWith('image/')) return <FileImage className={c} />
  if (mime.startsWith('video/')) return <FileVideo className={c} />
  if (mime.includes('zip') || mime.includes('compressed')) return <FileArchive className={c} />
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return <FileSpreadsheet className={c} />
  if (mime.includes('json') || mime.includes('xml') || mime.includes('javascript')) return <FileCode className={c} />
  return <FileText className={c} />
}

const newest = (list) => [...(list || [])].sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''))

export default function CustomerDetailDocuments({ customer }) {
  const {
    addCustomerFile, removeCustomerFile,
    addCustomerAgreement, removeCustomerAgreement, updateCustomerAgreement,
    moveCustomerDocument,
  } = useStore()
  const { user } = useAuth()
  const canAgreements = hasPermission(user, 'customers.agreements')
  const canDeleteFiles = hasPermission(user, 'customers.delete')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  // Read the picked file inline and add it to `kind` ('files' | 'agreements').
  const upload = (kind) => (e) => {
    const f = e.target.files?.[0]
    e.target.value = '' // allow re-uploading the same file
    if (!f) return
    if (f.size > FILE_LIMIT_BYTES) {
      setError(`"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)} MB — max 1 MB per document.`)
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      const doc = { name: f.name, type: f.type, size: f.size, dataUrl: reader.result, description: '' }
      if (kind === 'agreements') addCustomerAgreement(customer.id, doc)
      else addCustomerFile(customer.id, doc)
    }
    reader.readAsDataURL(f)
  }

  const agreements = newest(customer.agreements)
  const files = newest(customer.files)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label className="btn-primary flex-1 cursor-pointer">
          <Upload className="w-4 h-4" /> Upload file
          <input type="file" className="hidden" onChange={upload('files')} />
        </label>
        {canAgreements && (
          <label className="btn-ghost flex-1 cursor-pointer">
            <FileSignature className="w-4 h-4" /> Upload agreement
            <input type="file" className="hidden" onChange={upload('agreements')} />
          </label>
        )}
      </div>
      <p className="text-[11px] text-graphite px-1 -mt-2">
        1 MB max per document. Agreements carry start and renewal dates for reminders.
      </p>
      {error && <p className="text-xs text-danger-600 px-1">{error}</p>}

      {/* Agreements */}
      <section className="space-y-2">
        <p className="section-title flex items-center gap-1.5">
          <FileSignature className="w-4 h-4" /> Agreements {canAgreements && `· ${agreements.length}`}
        </p>
        {!canAgreements ? (
          <div className="card !p-4 flex items-center gap-2.5 bg-iron/50">
            <Lock className="w-4 h-4 text-graphite shrink-0" />
            <p className="text-sm text-graphite">You don’t have permission to access agreements.</p>
          </div>
        ) : agreements.length === 0 ? (
          <p className="text-sm text-graphite px-1">No agreements yet. Upload one, or mark a file below as an agreement.</p>
        ) : (
          <ul className="space-y-2">
            {agreements.map((a) => (
              <DocRow key={a.id} doc={a} onPreview={setPreview}
                onDelete={() => { if (confirm('Delete this agreement?')) removeCustomerAgreement(customer.id, a.id) }}
                move={{ label: 'Move to files', onClick: () => moveCustomerDocument(customer.id, a.id, 'files') }}>
                {/* Contract dates — the end date drives renewal reminders and health. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:pl-[52px] text-xs text-graphite">
                  <label className="flex items-center gap-1.5">
                    Starts
                    <input type="date" className="input !py-1 !px-2 !text-xs w-auto" value={a.startDate || ''}
                      onChange={(e) => updateCustomerAgreement(customer.id, a.id, { startDate: e.target.value || null })} />
                  </label>
                  <label className="flex items-center gap-1.5">
                    Renews / ends
                    <input type="date" className="input !py-1 !px-2 !text-xs w-auto" value={a.endDate || ''}
                      onChange={(e) => updateCustomerAgreement(customer.id, a.id, { endDate: e.target.value || null })} />
                  </label>
                  <RenewalTag endDate={a.endDate} />
                </div>
              </DocRow>
            ))}
          </ul>
        )}
      </section>

      {/* Other files */}
      <section className="space-y-2">
        <p className="section-title flex items-center gap-1.5">
          <FileText className="w-4 h-4" /> Other files · {files.length}
        </p>
        {files.length === 0 ? (
          <p className="text-sm text-graphite px-1">No files uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <DocRow key={f.id} doc={f} onPreview={setPreview}
                onDelete={canDeleteFiles ? () => { if (confirm('Delete this file?')) removeCustomerFile(customer.id, f.id) } : null}
                move={canAgreements ? { label: 'Mark as agreement', onClick: () => moveCustomerDocument(customer.id, f.id, 'agreements') } : null} />
            ))}
          </ul>
        )}
      </section>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name || 'Preview'} size="3xl">
        {preview && (
          <div className="space-y-3">
            {preview.type?.startsWith('image/') ? (
              <img src={preview.dataUrl} alt={preview.name}
                className="max-w-full max-h-[70vh] mx-auto rounded-lg border border-shadow" />
            ) : preview.type === 'application/pdf' ? (
              <iframe src={preview.dataUrl} title={preview.name}
                className="w-full h-[70vh] rounded-lg border border-shadow" />
            ) : (
              <p className="text-sm text-graphite text-center py-8">
                Preview isn’t available for this file type. Use download to open it.
              </p>
            )}
            <a href={preview.dataUrl} download={preview.name} className="btn-primary w-full">
              <Download className="w-4 h-4" /> Download
            </a>
          </div>
        )}
      </Modal>
    </div>
  )
}

// One document: icon, name, size and date, then preview / download / move /
// delete. `children` is an extra line under it (an agreement's dates).
function DocRow({ doc, onPreview, onDelete, move, children }) {
  const date = doc.uploadedAt
    ? new Date(doc.uploadedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : ''
  return (
    <li className="card space-y-2">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => doc.dataUrl && onPreview(doc)} disabled={!doc.dataUrl}
          className="flex items-center gap-3 flex-1 min-w-0 text-left" title={doc.dataUrl ? 'Preview' : ''}>
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
            <DocIcon mime={doc.type} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{doc.name}</p>
            {doc.description && <p className="text-xs text-graphite truncate">{doc.description}</p>}
            <p className="text-[11px] text-graphite">{[formatBytes(doc.size), date].filter(Boolean).join(' · ')}</p>
          </div>
        </button>
        {move && (
          <button type="button" onClick={move.onClick}
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-wise-dark hover:bg-iron rounded-lg">
            <ArrowDownToLine className="w-3.5 h-3.5" /> {move.label}
          </button>
        )}
        {doc.dataUrl && (
          <button type="button" onClick={() => onPreview(doc)} className="p-2 text-graphite hover:bg-iron rounded-lg" aria-label="Preview">
            <Eye className="w-4 h-4" />
          </button>
        )}
        {doc.dataUrl && (
          <a href={doc.dataUrl} download={doc.name} className="p-2 text-graphite hover:bg-iron rounded-lg" aria-label="Download">
            <Download className="w-4 h-4" />
          </a>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className="p-2 text-danger-500 hover:bg-danger-50 rounded-lg" aria-label="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {move && (
        <button type="button" onClick={move.onClick}
          className="sm:hidden inline-flex items-center gap-1 text-xs font-semibold text-wise-dark">
          <ArrowDownToLine className="w-3.5 h-3.5" /> {move.label}
        </button>
      )}
      {children}
    </li>
  )
}

// "Renews in 45 days" (amber within the warning window) / "Ended 3 days ago".
function RenewalTag({ endDate }) {
  const r = renewalState(endDate)
  if (!r) return null
  if (r.state === 'ended') return <span className="pill bg-danger-100 text-danger-700">Ended {r.days} day{r.days === 1 ? '' : 's'} ago</span>
  if (r.days === 0) return <span className="pill bg-warning-100 text-warning-800">Renews today</span>
  return (
    <span className={`pill ${r.state === 'soon' ? 'bg-warning-100 text-warning-800' : 'bg-iron text-graphite'}`}>
      Renews in {r.days} day{r.days === 1 ? '' : 's'}
    </span>
  )
}
