import { useState } from 'react'
import {
  Upload, Trash2, Download, Eye, Lock,
  FileText, FileImage, FileSpreadsheet, FileVideo, FileArchive, FileCode,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import { renewalState } from '../utils/payments.js'

const FILE_LIMIT_BYTES = 1024 * 1024 // 1 MB (documents are stored inline)

const formatBytes = (b) => {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

const fileIconFor = (mime = '') => {
  if (mime.startsWith('image/')) return FileImage
  if (mime.startsWith('video/')) return FileVideo
  if (mime.includes('zip') || mime.includes('compressed')) return FileArchive
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return FileSpreadsheet
  if (mime.includes('json') || mime.includes('xml') || mime.includes('javascript')) return FileCode
  return FileText
}

export default function CustomerDetailAgreement({ customer }) {
  const { addCustomerAgreement, removeCustomerAgreement, updateCustomerAgreement } = useStore()
  const { user } = useAuth()
  const canManage = hasPermission(user, 'customers.agreements')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  const items = customer.agreements || []

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    e.target.value = '' // allow re-uploading same file
    if (!f) return
    if (f.size > FILE_LIMIT_BYTES) {
      setError(`"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)} MB — max 1 MB stored locally.`)
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      addCustomerAgreement(customer.id, {
        name: f.name,
        type: f.type,
        size: f.size,
        dataUrl: reader.result,
        description: '',
      })
    }
    reader.readAsDataURL(f)
  }

  const handleDelete = (aid) => {
    if (confirm('Delete this agreement?')) removeCustomerAgreement(customer.id, aid)
  }

  const sorted = [...items].sort(
    (a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''),
  )

  // The 'Manage agreements' ability gates the whole tab — no access, no listing.
  if (!canManage) {
    return (
      <div className="space-y-3">
        <div className="card !p-4 flex items-center gap-2.5 bg-iron/50">
          <Lock className="w-4 h-4 text-graphite shrink-0" />
          <p className="text-sm text-graphite">
            You don’t have permission to access agreements.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label className="btn-primary w-full cursor-pointer">
        <Upload className="w-4 h-4" /> Upload agreement
        <input type="file" className="hidden" onChange={handleFile} />
      </label>
      <p className="text-[11px] text-graphite px-1">
        Agreement documents are stored on this device. 1 MB max per file.
      </p>
      {error && <p className="text-xs text-danger-600 px-1">{error}</p>}

      {sorted.length === 0 ? (
        <p className="text-center text-sm text-graphite py-6">No agreements recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((a) => {
            const Icon = fileIconFor(a.type)
            const date = a.uploadedAt
              ? new Date(a.uploadedAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : ''
            return (
              <li key={a.id} className="card space-y-2">
                <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => a.dataUrl && setPreview(a)}
                  disabled={!a.dataUrl}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  title={a.dataUrl ? 'Preview' : ''}
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{a.name}</p>
                    {a.description && (
                      <p className="text-xs text-graphite truncate">{a.description}</p>
                    )}
                    <p className="text-[11px] text-graphite">
                      {[formatBytes(a.size), date].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </button>
                {a.dataUrl && (
                  <button
                    type="button"
                    onClick={() => setPreview(a)}
                    className="p-2 text-graphite hover:bg-iron rounded-lg"
                    aria-label="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                {a.dataUrl && (
                  <a
                    href={a.dataUrl}
                    download={a.name}
                    className="p-2 text-graphite hover:bg-iron rounded-lg"
                    aria-label="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                {canManage && (
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-2 text-danger-500 hover:bg-danger-50 rounded-lg"
                    aria-label="Delete agreement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                </div>
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
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name || 'Preview'} size="3xl">
        {preview && (
          <div className="space-y-3">
            {preview.type?.startsWith('image/') ? (
              <img
                src={preview.dataUrl}
                alt={preview.name}
                className="max-w-full max-h-[70vh] mx-auto rounded-lg border border-shadow"
              />
            ) : preview.type === 'application/pdf' ? (
              <iframe
                src={preview.dataUrl}
                title={preview.name}
                className="w-full h-[70vh] rounded-lg border border-shadow"
              />
            ) : (
              <p className="text-sm text-graphite text-center py-8">
                Preview isn’t available for this file type. Use download to open it.
              </p>
            )}
            <a
              href={preview.dataUrl}
              download={preview.name}
              className="btn-primary w-full"
            >
              <Download className="w-4 h-4" /> Download
            </a>
          </div>
        )}
      </Modal>
    </div>
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
