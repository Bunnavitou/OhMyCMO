import { useState } from 'react'
import {
  Upload, Trash2, Download,
  FileText, FileImage, FileSpreadsheet, FileVideo, FileArchive, FileCode,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'

const FILE_LIMIT_BYTES = 1024 * 1024 // 1 MB

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

export default function CustomerDetailFile({ customer }) {
  const { addCustomerFile, removeCustomerFile } = useStore()
  const [error, setError] = useState('')

  const items = customer.files || []

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
      addCustomerFile(customer.id, {
        name: f.name,
        type: f.type,
        size: f.size,
        dataUrl: reader.result,
        description: '',
      })
    }
    reader.readAsDataURL(f)
  }

  const handleDelete = (fid) => {
    if (confirm('Delete this file?')) removeCustomerFile(customer.id, fid)
  }

  const sorted = [...items].sort(
    (a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''),
  )

  return (
    <div className="space-y-3">
      <label className="btn-primary w-full cursor-pointer">
        <Upload className="w-4 h-4" /> Upload file
        <input type="file" className="hidden" onChange={handleFile} />
      </label>
      <p className="text-[11px] text-steel px-1">
        Files are stored on this device. 1 MB max per file.
      </p>
      {error && <p className="text-xs text-rose-600 px-1">{error}</p>}

      {sorted.length === 0 ? (
        <p className="text-center text-sm text-steel py-6">No files uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((f) => {
            const Icon = fileIconFor(f.type)
            const date = f.uploadedAt
              ? new Date(f.uploadedAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : ''
            return (
              <li key={f.id} className="card flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{f.name}</p>
                  {f.description && (
                    <p className="text-xs text-steel truncate">{f.description}</p>
                  )}
                  <p className="text-[11px] text-ash">
                    {[formatBytes(f.size), date].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {f.dataUrl && (
                  <a
                    href={f.dataUrl}
                    download={f.name}
                    className="p-2 text-steel hover:bg-iron rounded-lg"
                    aria-label="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(f.id)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                  aria-label="Delete file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
