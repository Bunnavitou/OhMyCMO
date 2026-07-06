import { useState, useMemo } from 'react'
import { Plus, Search, Boxes, Trash2, Pencil, Camera, Loader2 } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useT } from '../i18n/LanguageContext.jsx'

const PHOTO_LIMIT_BYTES = 1024 * 1024 // 1 MB per photo

const readPhoto = (file) =>
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

// Stored values stay English; UI shows translated labels.
const CATEGORIES = [
  { value: 'Hardware',  tKey: 'asset.category.hardware' },
  { value: 'Software',  tKey: 'asset.category.software' },
  { value: 'Marketing', tKey: 'asset.category.marketing' },
  { value: 'Office',    tKey: 'asset.category.office' },
  { value: 'Other',     tKey: 'asset.category.other' },
]
const STATUSES = [
  { value: 'In use',  tKey: 'asset.status.inUse' },
  { value: 'Active',  tKey: 'asset.status.active' },
  { value: 'Storage', tKey: 'asset.status.storage' },
  { value: 'Retired', tKey: 'asset.status.retired' },
]

const labelOf = (list, value, t) => {
  const f = list.find((x) => x.value === value)
  return f ? t(f.tKey) : value
}

export default function Assets() {
  const { state, addAsset, updateAsset, removeAsset } = useStore()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')

  const filtered = useMemo(
    () =>
      state.assets.filter((a) => {
        const matchesQ = [a.name, a.assignee, a.serial].join(' ').toLowerCase().includes(q.toLowerCase())
        const matchesCat = cat === 'All' || a.category === cat
        return matchesQ && matchesCat
      }),
    [state.assets, q, cat],
  )

  const grouped = useMemo(() => {
    const acc = {}
    for (const a of filtered) {
      acc[a.category] = acc[a.category] || []
      acc[a.category].push(a)
    }
    return acc
  }, [filtered])

  return (
    <>
      <PageHeader
        title={t('asset.title.business')}
        subtitle={t('asset.subtitle', { n: state.assets.length })}
        action={
          <button onClick={() => setOpen(true)} className="btn-primary !px-3 !py-2">
            <Plus className="w-4 h-4" /> {t('common.new')}
          </button>
        }
      />
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('asset.search')} className="input pl-9" />
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          <button
            onClick={() => setCat('All')}
            className={`pill border ${cat === 'All' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-charcoal border-shadow text-graphite'}`}
          >
            {t('asset.category.all')}
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCat(c.value)}
              className={`pill border ${cat === c.value ? 'bg-brand-600 border-brand-600 text-white' : 'bg-charcoal border-shadow text-graphite'}`}
            >
              {t(c.tKey)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={t('asset.empty.title')}
            description={t('asset.empty.body')}
            action={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> {t('asset.addNew')}</button>}
          />
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <section key={category} className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-graphite mt-3">
                {labelOf(CATEGORIES, category, t)}
              </h2>
              <ul className="card divide-y divide-shadow p-0">
                {items.map((a) => (
                  <li key={a.id} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{a.name}</p>
                      <p className="text-xs text-graphite truncate">{a.assignee || t('asset.unassigned')} · {a.serial || '—'}</p>
                    </div>
                    <span className={`pill ${
                      a.status === 'In use' || a.status === 'Active' ? 'bg-emerald-100 text-emerald-700'
                      : a.status === 'Storage' ? 'bg-iron text-graphite'
                      : 'bg-rose-100 text-rose-700'
                    }`}>{labelOf(STATUSES, a.status, t)}</span>
                    <button onClick={() => setEditing(a)} className="p-1.5 rounded-full hover:bg-iron text-graphite" aria-label={t('common.edit')}><Pencil className="w-4 h-4" /></button>
                    <button
                      onClick={() => { if (confirm(t('asset.delete.confirm'))) removeAsset(a.id) }}
                      className="p-1.5 rounded-full hover:bg-rose-50 text-rose-500"
                      aria-label={t('common.delete')}
                    ><Trash2 className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <AssetModal
        open={open || !!editing}
        editing={editing}
        onClose={() => { setOpen(false); setEditing(null) }}
        onSubmit={(data) => {
          if (editing) updateAsset(editing.id, data)
          else addAsset(data)
          setOpen(false); setEditing(null)
        }}
      />
    </>
  )
}

function AssetModal({ open, editing, onClose, onSubmit }) {
  const { t } = useT()
  const initial = editing
    ? { ...editing, photos: Array.isArray(editing.photos) ? editing.photos : [] }
    : { name: '', category: 'Hardware', assignee: '', serial: '', status: 'In use', photos: [] }
  const [form, setForm] = useState(initial)
  const [photoError, setPhotoError] = useState('')
  const [uploading, setUploading] = useState(false)
  const key = `${open}-${editing?.id || 'new'}`

  const onPickPhotos = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const tooBig = files.find((f) => f.size > PHOTO_LIMIT_BYTES)
    if (tooBig) {
      setPhotoError(t('asset.photos.tooBig', {
        name: tooBig.name,
        mb: (tooBig.size / 1024 / 1024).toFixed(1),
      }))
      return
    }
    setPhotoError('')
    setUploading(true)
    try {
      const loaded = await Promise.all(files.map(readPhoto))
      setForm((s) => ({ ...s, photos: [...(s.photos || []), ...loaded] }))
    } catch {
      setPhotoError(t('asset.photos.readError'))
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = (idx) => {
    setForm((s) => ({ ...s, photos: (s.photos || []).filter((_, i) => i !== idx) }))
  }

  const photos = form.photos || []

  return (
    <Modal open={open} onClose={onClose} title={editing ? t('asset.modal.edit') : t('asset.modal.new')} key={key}>
      <form onSubmit={(e) => { e.preventDefault(); if (form.name.trim()) onSubmit(form) }} className="space-y-3">
        <div>
          <label className="label">{t('field.name')} *</label>
          <input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='MacBook Pro 14"' />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('field.category')}</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.tKey)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('field.status')}</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{t(s.tKey)}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('field.assignee')}</label>
            <input className="input" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} placeholder="Sales Lead" />
          </div>
          <div>
            <label className="label">{t('asset.field.serialId')}</label>
            <input className="input" value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} placeholder="C02XJ" />
          </div>
        </div>
        <div>
          <label className="label">
            {t('asset.photos.label')}
            {photos.length > 0 && (
              <span className="text-graphite font-normal"> ({photos.length})</span>
            )}
          </label>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {photos.map((p, idx) => {
                const isImg = (p.type || '').startsWith('image/')
                return (
                  <div
                    key={`${p.name}-${idx}`}
                    className="relative group rounded-xl border border-shadow overflow-hidden bg-iron aspect-square"
                  >
                    {isImg ? (
                      <img
                        src={p.dataUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 p-2 text-graphite h-full">
                        <Camera className="w-5 h-5" />
                        <span className="text-[10px] text-center truncate w-full">{p.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-white/90 text-rose-500 rounded-full shadow hover:bg-white"
                      aria-label={t('asset.photos.remove')}
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
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('asset.photos.uploading')}
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                {photos.length > 0 ? t('asset.photos.addMore') : t('asset.photos.add')}
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              multiple
              disabled={uploading}
              onChange={onPickPhotos}
            />
          </label>
          <p className="text-[11px] text-graphite mt-1">{t('asset.photos.limit')}</p>
          {photoError && <p className="text-xs text-rose-600 mt-1">{photoError}</p>}
        </div>

        <button className="btn-primary w-full mt-2">{editing ? t('common.saveChanges') : t('asset.addNew')}</button>
      </form>
    </Modal>
  )
}
