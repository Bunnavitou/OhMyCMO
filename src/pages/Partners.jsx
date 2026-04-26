import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Handshake, Mail, Phone, Camera, Pencil, Loader2, Sparkles } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import DateFilterButton from '../components/DateFilterButton.jsx'
import { scanCard } from '../utils/cardScanner.js'

const EMPTY_PARTNER = { name: '', company: '', role: '', email: '', phone: '' }

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
  const [open, setOpen] = useState(false)
  const [initial, setInitial] = useState(EMPTY_PARTNER)
  const [fromScan, setFromScan] = useState(false)
  const [q, setQ] = useState('')

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [dateRange, setDateRange] = useState(null)
  const [chooserOpen, setChooserOpen] = useState(false)
  const fileInputRef = useRef(null)

  const filtered = useMemo(
    () =>
      state.partners
        .filter((p) =>
          [p.name, p.company, p.role].join(' ').toLowerCase().includes(q.toLowerCase()),
        )
        .filter((p) => partnerInRange(p, dateRange)),
    [state.partners, q, dateRange],
  )

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
        setScanError('Could not read the card. Try a clearer, well-lit photo.')
        return
      }
      setInitial({
        name: fields.name || '',
        company: fields.company || '',
        role: fields.role || '',
        email: fields.email || '',
        phone: fields.phone || '',
      })
      setFromScan(true)
      setOpen(true)
    } catch (err) {
      console.error(err)
      setScanError('OCR failed. Check your connection (the language pack downloads on first run).')
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
              placeholder="Search partner, company, role"
              className="input pl-9"
            />
          </div>
          <DateFilterButton
            value={dateRange}
            onChange={setDateRange}
            storageKey="ohmycmo:filter:partners"
          />
        </div>

        {state.partners.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No partners yet"
            description="Capture name cards, log meetings and follow-ups in one place."
            action={
              <button onClick={() => setChooserOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Add a partner
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-graphite py-6">
            No partners match your filters.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((p) => {
              const openTasks = p.tasks.filter((t) => !t.done).length
              return (
                <li key={p.id}>
                  <Link to={`/partners/${p.id}`} className="card flex gap-3 active:scale-[0.99]">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      {p.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-graphite truncate">
                        {p.role || '—'} · {p.company || '—'}
                      </p>
                      <div className="flex gap-3 mt-2 text-xs text-graphite">
                        {p.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {p.email}
                          </span>
                        )}
                        {p.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {p.phone}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-graphite">
                        <span>{openTasks} open task{openTasks !== 1 ? 's' : ''}</span>
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
        onSubmit={(d) => {
          addPartner(d)
          closeModal()
        }}
      />

      <button
        onClick={() => setChooserOpen(true)}
        className="btn-primary fixed z-40 right-4 md:right-8 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-8 shadow-xl"
        aria-label="New partner"
      >
        <Plus className="w-5 h-5" /> New
      </button>

      <Modal open={chooserOpen} onClose={() => setChooserOpen(false)} title="Add a new partner">
        <p className="text-sm text-graphite mb-4">
          Choose how you'd like to capture this partner.
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
              <p className="text-base font-bold text-near-black">Scan a name card</p>
              <p className="text-xs text-graphite mt-0.5">
                Snap a photo and we'll fill the form for you using OCR.
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
              <p className="text-base font-bold text-near-black">Enter manually</p>
              <p className="text-xs text-graphite mt-0.5">
                Type in the partner's details from scratch.
              </p>
            </div>
          </button>
        </div>
      </Modal>
    </>
  )
}

function ScanningOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-charcoal rounded-2xl p-6 shadow-xl flex flex-col items-center gap-3 max-w-xs mx-4">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-sm font-semibold">Reading name card…</p>
        <p className="text-xs text-graphite text-center">
          First scan downloads the OCR language pack — please wait a few seconds.
        </p>
      </div>
    </div>
  )
}

function NewPartnerModal({ open, onClose, initial, fromScan, onSubmit }) {
  const [form, setForm] = useState(initial)
  return (
    <Modal open={open} onClose={onClose} title={fromScan ? 'Review scanned card' : 'New partner'}>
      {fromScan && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-50 text-brand-700 text-xs">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Pre-filled from your photo. Review and edit before saving.</span>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (form.name.trim()) onSubmit(form)
        }}
        className="space-y-3"
      >
        <div>
          <label className="label">Full name *</label>
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
            <label className="label">Company</label>
            <input
              className="input"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Pixel Studio"
            />
          </div>
          <div>
            <label className="label">Role</label>
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
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <button className="btn-primary w-full mt-2">Save partner</button>
      </form>
    </Modal>
  )
}
