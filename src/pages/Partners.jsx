import { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Handshake, Mail, Phone, Camera, Pencil, Loader2, Sparkles, Trash2, ArrowDownAZ, ArrowDownZA, ArrowUpDown, Check, Building2 } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import DateFilterButton from '../components/DateFilterButton.jsx'
import { scanCard } from '../utils/cardScanner.js'
import { compressImage } from '../utils/imageCompress.js'
import { useT } from '../i18n/LanguageContext.jsx'
import AuthImage from '../components/AuthImage.jsx'
import { persistImageRef, hasImage } from '../utils/imageRef.js'

const EMPTY_PARTNER = {
  name: '',
  company: '',
  role: '',
  email: '',
  phone: '',
  telegram: '',
  cardImage: null,
  telegramQr: null,
}

const TG_QR_LIMIT_BYTES = 2 * 1024 * 1024 // 2 MB

const SEARCH_KEY = 'ohmycmo:partners:q'
const SCROLL_KEY = 'ohmycmo:partners:scroll'
const SORT_KEY = 'ohmycmo:partners:sort'

const SORT_OPTIONS = ['default', 'az', 'za', 'companyAz', 'companyZa']

const partnerInRange = (p, range) => {
  if (!range) return true
  const startMs = range.start.getTime()
  const endMs = range.end.getTime()
  return (p.tasks || []).some((t) => {
    const candidates = [t.setDate, t.due].filter(Boolean)
    return candidates.some((d) => {
      const ms = new Date(d).getTime()
      return !isNaN(ms) && ms >= startMs && ms <= endMs
    })
  })
}

export default function Partners() {
  const { state, addPartner } = useStore()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [initial, setInitial] = useState(EMPTY_PARTNER)
  const [fromScan, setFromScan] = useState(false)
  const [q, setQ] = useState(() => {
    try { return sessionStorage.getItem(SEARCH_KEY) || '' } catch { return '' }
  })
  const [sort, setSort] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SORT_KEY)
      return SORT_OPTIONS.includes(saved) ? saved : 'default'
    } catch { return 'default' }
  })
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortMenuRef = useRef(null)

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [dateRange, setDateRange] = useState(null)
  const [chooserOpen, setChooserOpen] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    try { sessionStorage.setItem(SEARCH_KEY, q) } catch { /* ignore */ }
  }, [q])

  useEffect(() => {
    try { sessionStorage.setItem(SORT_KEY, sort) } catch { /* ignore */ }
  }, [sort])

  useEffect(() => {
    if (!sortMenuOpen) return
    const onClick = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setSortMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [sortMenuOpen])

  // Restore scroll on mount; save before unmount.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SCROLL_KEY)
      if (saved) {
        const y = Number(saved)
        if (!Number.isNaN(y)) window.scrollTo(0, y)
      }
    } catch { /* ignore */ }
    return () => {
      try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)) } catch { /* ignore */ }
    }
  }, [])

  const filtered = useMemo(() => {
    const base = state.partners
      .filter((p) =>
        [p.name, p.company, p.role].join(' ').toLowerCase().includes(q.toLowerCase()),
      )
      .filter((p) => partnerInRange(p, dateRange))
    if (sort === 'az' || sort === 'za') {
      const sorted = [...base].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
      )
      return sort === 'za' ? sorted.reverse() : sorted
    }
    if (sort === 'companyAz' || sort === 'companyZa') {
      const sorted = [...base].sort((a, b) =>
        (a.company || '').localeCompare(b.company || '', undefined, { sensitivity: 'base' }),
      )
      return sort === 'companyZa' ? sorted.reverse() : sorted
    }
    return base
  }, [state.partners, q, dateRange, sort])

  const onScanClick = () => {
    setScanError('')
    setChooserOpen(false)
    fileInputRef.current?.click()
  }

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setScanning(true)
    setScanError('')
    try {
      const fields = await scanCard(file)
      const found = ['name', 'company', 'role', 'email', 'phone'].filter((k) => fields[k])
      if (found.length === 0) {
        setScanError(t('partner.scanError.read'))
        return
      }
      setInitial({
        name: fields.name || '',
        company: fields.company || '',
        role: fields.role || '',
        email: fields.email || '',
        phone: fields.phone || '',
        cardImage: fields.cardImage || null,
      })
      setFromScan(true)
      setOpen(true)
    } catch (err) {
      console.error(err)
      setScanError(t('partner.scanError.ocr'))
    } finally {
      setScanning(false)
    }
  }

  const openManual = () => {
    setChooserOpen(false)
    setInitial(EMPTY_PARTNER)
    setFromScan(false)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setFromScan(false)
    setInitial(EMPTY_PARTNER)
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFilePicked}
      />

      <div className="space-y-3">
        {scanError && (
          <p className="card !p-3 text-xs text-rose-600 border-rose-100 bg-rose-50/60">
            {scanError}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('partner.search')}
              className="input pl-9"
            />
          </div>
          <DateFilterButton
            value={dateRange}
            onChange={setDateRange}
            storageKey="ohmycmo:filter:partners"
          />
          <div className="relative" ref={sortMenuRef}>
            <button
              type="button"
              onClick={() => setSortMenuOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border ${
                sort !== 'default'
                  ? 'bg-brand-50 border-brand-200 text-brand-700'
                  : 'bg-charcoal border-shadow text-near-black hover:bg-iron'
              }`}
              aria-haspopup="menu"
              aria-expanded={sortMenuOpen}
            >
              {sort === 'az' ? (
                <ArrowDownAZ className="w-4 h-4" />
              ) : sort === 'za' ? (
                <ArrowDownZA className="w-4 h-4" />
              ) : sort === 'companyAz' || sort === 'companyZa' ? (
                <Building2 className="w-4 h-4" />
              ) : (
                <ArrowUpDown className="w-4 h-4" />
              )}
              {sort === 'az'
                ? t('partner.sort.az')
                : sort === 'za'
                  ? t('partner.sort.za')
                  : sort === 'companyAz'
                    ? t('partner.sort.companyAz')
                    : sort === 'companyZa'
                      ? t('partner.sort.companyZa')
                      : t('partner.sort.label')}
            </button>
            {sortMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 z-20 w-56 rounded-xl border border-shadow bg-charcoal shadow-xl overflow-hidden"
              >
                {[
                  { key: 'default', label: t('partner.sort.default'), Icon: ArrowUpDown },
                  { key: 'az', label: t('partner.sort.az'), Icon: ArrowDownAZ },
                  { key: 'za', label: t('partner.sort.za'), Icon: ArrowDownZA },
                  { key: 'companyAz', label: t('partner.sort.companyAz'), Icon: Building2 },
                  { key: 'companyZa', label: t('partner.sort.companyZa'), Icon: Building2 },
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={sort === key}
                    onClick={() => {
                      setSort(key)
                      setSortMenuOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-iron ${
                      sort === key ? 'text-brand-700 font-semibold' : 'text-near-black'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {sort === key && <Check className="w-4 h-4 text-brand-700 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {state.partners.length > 0 && (
          <div className="card !p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-mint-bg text-wise-dark flex items-center justify-center shrink-0">
              <Handshake className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-graphite">{t('partner.total')}</p>
              <p className="text-lg font-bold text-near-black tabular-nums leading-tight">
                {state.partners.length}
              </p>
            </div>
          </div>
        )}

        {state.partners.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title={t('partner.empty.title')}
            description={t('partner.empty.body')}
            action={
              <button onClick={() => setChooserOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> {t('partner.addNew')}
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-graphite py-6">
            {t('partner.noFilterMatch')}
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {filtered.map((p) => {
              const openTasks = p.tasks.filter((t) => !t.done).length
              return (
                <li key={p.id}>
                  <Link
                    to={`/partners/${p.id}`}
                    className="card !p-0 overflow-hidden block hover:scale-[1.01] transition-transform"
                  >
                    {/* Name card photo banner */}
                    {hasImage(p.cardImage) ? (
                      <div className="bg-iron border-b border-shadow">
                        <AuthImage
                          value={p.cardImage}
                          alt={`${p.name} business card`}
                          className="w-full h-40 md:h-48 object-cover object-center"
                        />
                      </div>
                    ) : (
                      <div className="bg-mint-bg h-20 md:h-24 flex items-center justify-center border-b border-shadow">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-wise-dark/70">
                          {t('partner.noNameCard')}
                        </p>
                      </div>
                    )}

                    {/* Body */}
                    <div className="p-4 md:p-5 flex gap-3">
                      <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-mint-bg text-wise-dark flex items-center justify-center font-bold shrink-0">
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-bold text-near-black truncate leading-tight">
                          {p.name}
                        </p>
                        {p.role && (
                          <p className="text-sm font-semibold text-wise-dark truncate">
                            {p.role}
                          </p>
                        )}
                        {p.company && (
                          <p className="text-xs text-graphite truncate">{p.company}</p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[11px] text-graphite">
                          {p.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{p.email}</span>
                            </span>
                          )}
                          {p.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 shrink-0" /> {p.phone}
                            </span>
                          )}
                        </div>
                        {openTasks > 0 && (
                          <p className="text-[11px] text-graphite pt-1">
                            {t('partner.openTasks', { count: openTasks })}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {scanning && <ScanningOverlay />}

      <NewPartnerModal
        key={open ? `partner-${initial.name}-${initial.email}` : 'partner-new'}
        open={open}
        onClose={closeModal}
        initial={initial}
        fromScan={fromScan}
        onSubmit={async (d) => {
          closeModal()
          // Move any inline image (scanned card / picked QR) into the File store
          // so base64 never lands in the DB row.
          const [cardImage, telegramQr] = await Promise.all([
            persistImageRef(d.cardImage, { entityType: 'partner' }),
            persistImageRef(d.telegramQr, { entityType: 'partner' }),
          ])
          addPartner({ ...d, cardImage, telegramQr })
        }}
      />

      <button
        onClick={() => setChooserOpen(true)}
        className="btn-primary fixed z-40 right-4 md:right-8 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-8 shadow-xl"
        aria-label={t('partner.addNew')}
      >
        <Plus className="w-5 h-5" /> {t('common.new')}
      </button>

      <Modal open={chooserOpen} onClose={() => setChooserOpen(false)} title={t('partner.chooser.title')}>
        <p className="text-sm text-graphite mb-4">
          {t('partner.chooser.body')}
        </p>
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onScanClick}
            className="w-full text-left card flex items-center gap-3 hover:bg-iron transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="w-11 h-11 rounded-full bg-mint-bg text-wise-dark flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-near-black">{t('partner.chooser.scan')}</p>
              <p className="text-xs text-graphite mt-0.5">
                {t('partner.chooser.scanBody')}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={openManual}
            className="w-full text-left card flex items-center gap-3 hover:bg-iron transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="w-11 h-11 rounded-full bg-mint-bg text-wise-dark flex items-center justify-center shrink-0">
              <Pencil className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-near-black">{t('partner.chooser.manual')}</p>
              <p className="text-xs text-graphite mt-0.5">
                {t('partner.chooser.manualBody')}
              </p>
            </div>
          </button>
        </div>
      </Modal>
    </>
  )
}

export function TelegramQrPicker({ value, onChange }) {
  const [error, setError] = useState('')

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > TG_QR_LIMIT_BYTES) {
      setError(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB — max 2 MB.`)
      return
    }
    setError('')
    try {
      // QR codes need crisp edges to stay scannable — keep more pixels & quality.
      const qr = await compressImage(f, { maxDim: 1024, quality: 0.9 })
      onChange(qr)
    } catch {
      setError('Could not read that image — try a different file.')
    }
  }

  return (
    <div>
      <label className="label">Telegram QR</label>
      {hasImage(value) ? (
        <div className="flex items-center gap-3 p-2.5 rounded-xl border border-shadow bg-iron">
          <AuthImage value={value} alt="Telegram QR" className="w-14 h-14 object-cover rounded-md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{value.name || 'qr.png'}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
            aria-label="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-graphite text-sm text-graphite cursor-pointer hover:bg-iron">
          <Camera className="w-4 h-4" />
          Upload QR image
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
      )}
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  )
}

function ScanningOverlay() {
  const { t } = useT()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-charcoal rounded-2xl p-6 shadow-xl flex flex-col items-center gap-3 max-w-xs mx-4">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-sm font-semibold">{t('partner.scanning')}</p>
        <p className="text-xs text-graphite text-center">
          {t('partner.scanning.note')}
        </p>
      </div>
    </div>
  )
}

function NewPartnerModal({ open, onClose, initial, fromScan, onSubmit }) {
  const { t } = useT()
  const [form, setForm] = useState(initial)
  return (
    <Modal open={open} onClose={onClose} title={fromScan ? t('partner.review.title') : t('partner.modal.new')}>
      {fromScan && (
        <>
          {hasImage(form.cardImage) && (
            <div className="mb-3 overflow-hidden rounded-2xl border border-shadow">
              <AuthImage
                value={form.cardImage}
                alt="Scanned name card"
                className="w-full max-h-48 object-cover"
              />
            </div>
          )}
          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-50 text-brand-800 text-xs">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{t('partner.review.note')}</span>
          </div>
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (form.name.trim()) onSubmit(form)
        }}
        className="space-y-3"
      >
        <div>
          <label className="label">{t('partner.fullName')} *</label>
          <input
            className="input"
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Vannak Sok"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('partner.field.company')}</label>
            <input
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Pixel Studio"
            />
          </div>
          <div>
            <label className="label">{t('partner.field.role')}</label>
            <input
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="Creative Director"
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
        <button className="btn-primary w-full mt-2">{t('partner.save')}</button>
      </form>
    </Modal>
  )
}
