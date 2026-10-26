import { useEffect, useRef, useState } from 'react'
import { Search, Phone, User, X, Plus, StickyNote, Pencil } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'

const MAX_PER_GROUP = 6

// Who a sales activity is with — one search box over Customers and prospects
// (Partner business cards). The result list floats over the form and is only
// open while searching, so the form keeps its height however many customers
// there are. A card that already became a customer selects that customer; a
// Deal Won with a prospect turns it into one (API, convertIfWon).
export default function PartyPicker({ customerId, partnerId, onChange }) {
  const { state, addPartner, updatePartner } = useStore()
  const { user } = useAuth()
  const { t } = useT()
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0) // highlighted row for the keyboard
  const [card, setCard] = useState(null) // null | { name, company, phone, notes } while adding a card
  const [edit, setEdit] = useState(null) // null | the same, while editing the selected prospect's card

  const customer = state.customers.find((c) => c.id === customerId)
  const partner = state.partners.find((p) => p.id === partnerId)
  const selected = customer || partner

  // Close when clicking anywhere outside the box or its list.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) { setOpen(false); setCard(null) } }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const needle = q.trim().toLowerCase()
  const hit = (...fields) => !needle || fields.some((f) => f && f.toLowerCase().includes(needle))
  // A business card that won a deal is now a customer: list it once, as that
  // customer, which its person's name and phone still find.
  const cardsOf = (id) => state.partners.filter((p) => p.customerId === id)
  const customerRows = state.customers.filter((c) =>
    hit(c.name, c.phone, c.contact, c.industry, ...cardsOf(c.id).flatMap((p) => [p.name, p.phone])))
  const partnerRows = state.partners.filter((p) => !p.customerId && hit(p.name, p.company, p.phone))
  // One flat list so ↑ ↓ Enter move across both groups and the "new card" row.
  const rows = [
    ...customerRows.slice(0, MAX_PER_GROUP).map((c) => ({ kind: 'customer', item: c })),
    ...partnerRows.slice(0, MAX_PER_GROUP).map((p) => ({ kind: 'partner', item: p })),
    { kind: 'new' },
  ]
  const more = Math.max(0, customerRows.length - MAX_PER_GROUP) + Math.max(0, partnerRows.length - MAX_PER_GROUP)

  const close = () => { setOpen(false); setQ(''); setCard(null) }
  const choose = (row) => {
    if (row.kind === 'new') {
      setCard({ name: q.trim(), company: '', phone: '', notes: '' })
      return
    }
    if (row.kind === 'customer') onChange({ customerId: row.item.id, partnerId: null })
    else onChange({ customerId: null, partnerId: row.item.id })
    close()
  }
  const cardBody = (c) => ({ name: c.name.trim(), company: c.company.trim() || null, phone: c.phone.trim() || null, notes: c.notes.trim() || null })
  const createCard = async () => {
    const p = await addPartner(cardBody(card))
    if (p) choose({ kind: 'partner', item: p })
  }
  const startEdit = () =>
    setEdit({ name: partner.name || '', company: partner.company || '', phone: partner.phone || '', notes: partner.notes || '' })
  const saveEdit = async () => {
    const p = await updatePartner(partner.id, cardBody(edit))
    if (p) setEdit(null)
  }
  const startSearch = () => {
    setOpen(true)
    setActive(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { if (open) { e.preventDefault(); choose(rows[active]) } }
    else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close() }
  }

  const prospect = !customer && !!partner
  const showChip = selected && !open
  const canEditCard = prospect && hasPermission(user, 'partners')

  return (
    <div ref={boxRef} className="relative">
      {showChip && edit ? (
        <div className="rounded-2xl border border-shadow">
          <CardForm title={t('sales.editCard')} card={edit} onChange={setEdit} onCancel={() => setEdit(null)} onSave={saveEdit} />
        </div>
      ) : showChip ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button type="button" onClick={startSearch}
              className="flex items-center gap-2 min-w-0 rounded-full bg-iron hover:bg-shadow/50 pl-3 pr-2 py-1.5 font-semibold text-near-black">
              <span className="truncate">{customer ? customer.name : partner.company || partner.name}</span>
              {prospect && <span className="pill bg-accent-100 text-accent-700 !text-[10px] shrink-0">{t('sales.prospect')}</span>}
            </button>
            {canEditCard && (
              <button type="button" aria-label={t('sales.editCard')} title={t('sales.editCard')}
                className="p-1 text-graphite hover:text-near-black" onClick={startEdit}>
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button type="button" aria-label={t('sales.clear')} className="p-1 text-graphite hover:text-near-black"
              onClick={() => { onChange({ customerId: null, partnerId: null }); startSearch() }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Contact and phone always come from the record (BR-01). */}
          <p className="flex flex-wrap gap-x-3 text-xs text-graphite px-1">
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{prospect ? partner.name : customer.contact || t('sales.noContact')}</span>
            {(prospect ? partner.phone : customer.phone) && (
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{prospect ? partner.phone : customer.phone}</span>
            )}
          </p>
          <RecordNote customer={customer} partner={partner} />
          {prospect && <p className="text-xs text-graphite px-1">{t('sales.prospectHint')}</p>}
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-graphite absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            className="input pl-9"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            placeholder={t('sales.searchParty')}
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); setCard(null) }}
            onKeyDown={onKey}
          />
        </div>
      )}

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 rounded-2xl border border-shadow bg-white shadow-xl overflow-hidden">
          {card ? (
            <CardForm title={t('sales.newCard')} card={card} onChange={setCard} onCancel={() => setCard(null)} onSave={createCard} />
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1 text-sm">
              {rows.length === 1 && <li className="px-3 py-2 text-graphite">{t('sales.noMatch')}</li>}
              {rows.map((row, i) => {
                const first = i === 0 || rows[i - 1].kind !== row.kind
                const hl = i === active ? 'bg-iron' : ''
                return (
                  <li key={row.kind === 'new' ? 'new' : `${row.kind}-${row.item.id}`}>
                    {first && row.kind === 'customer' && <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-graphite">{t('sales.group.customers')}</p>}
                    {first && row.kind === 'partner' && <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-graphite">{t('sales.group.prospects')}</p>}
                    {row.kind === 'new' && <div className="border-t border-shadow mt-1" />}
                    <button type="button" role="option" aria-selected={i === active}
                      onMouseEnter={() => setActive(i)} onClick={() => choose(row)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2 ${hl}`}>
                      {row.kind === 'customer' && (
                        <>
                          <span className="flex-1 truncate">
                            <span className="font-semibold">{row.item.name}</span>
                            {row.item.industry && <span className="text-graphite"> · {row.item.industry}</span>}
                          </span>
                          {row.item.phone && <span className="text-xs text-graphite tabular-nums">{row.item.phone}</span>}
                        </>
                      )}
                      {row.kind === 'partner' && (
                        <>
                          <span className="flex-1 truncate">
                            <span className="font-semibold">{row.item.name}</span>
                            {row.item.company && <span className="text-graphite"> · {row.item.company}</span>}
                          </span>
                          <span className="pill bg-accent-100 text-accent-700 !text-[10px]">{t('sales.prospect')}</span>
                        </>
                      )}
                      {row.kind === 'new' && (
                        <span className="font-semibold text-wise-dark flex items-center gap-1">
                          <Plus className="w-4 h-4" />
                          {q.trim() ? t('sales.newCardNamed', { name: q.trim() }) : t('sales.newCard')}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
              {more > 0 && <li className="px-3 py-1.5 text-xs text-graphite">{t('sales.typeToNarrow', { n: more })}</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// A business card's details — adding a new one, or editing the selected
// prospect's. Saved on the Partner, so the Partners page shows the change too.
function CardForm({ title, card, onChange, onCancel, onSave }) {
  const { t } = useT()
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => onChange({ ...card, [k]: e.target.value })
  const save = async () => {
    setSaving(true)
    try { await onSave() } finally { setSaving(false) }
  }
  return (
    <div className="p-3 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-graphite">{title}</p>
      <input className="input" autoFocus placeholder={t('sales.cardName')} aria-label={t('sales.cardName')} value={card.name} onChange={set('name')} />
      <input className="input" placeholder={t('sales.cardCompany')} aria-label={t('sales.cardCompany')} value={card.company} onChange={set('company')} />
      <input className="input" placeholder={t('sales.prospectPhone')} aria-label={t('sales.prospectPhone')} value={card.phone} onChange={set('phone')} />
      <textarea className="input min-h-[72px]" placeholder={t('sales.cardNotes')} aria-label={t('partner.field.notes')} value={card.notes} onChange={set('notes')} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" className="btn-primary !py-1.5 text-sm disabled:opacity-60" disabled={saving || !card.name.trim()} onClick={save}>{t('common.save')}</button>
      </div>
    </div>
  )
}

// The selected customer's or business card's note — who they are, what they
// need — with Add / Edit in place. It is saved on that record, so it shows
// wherever the record does. A customer without a note of its own shows the
// note of the card it came from.
function RecordNote({ customer, partner }) {
  const { updateCustomer, updatePartner } = useStore()
  const { user } = useAuth()
  const { t } = useT()
  const [draft, setDraft] = useState(null) // null = not editing
  const [saving, setSaving] = useState(false)
  const record = customer || partner
  const note = customer ? (customer.notes || partner?.notes || '') : (partner?.notes || '')
  const canEdit = hasPermission(user, customer ? 'customers' : 'partners')
  if (!record) return null

  const save = async () => {
    setSaving(true)
    try {
      const notes = draft.trim() || null
      if (customer) await updateCustomer(customer.id, { notes })
      else await updatePartner(partner.id, { notes })
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  if (draft !== null) {
    return (
      <div className="space-y-1.5 px-1">
        <textarea className="input min-h-[72px] text-sm" autoFocus value={draft}
          placeholder={t('sales.cardNotes')} aria-label={t('partner.field.notes')}
          onChange={(e) => setDraft(e.target.value)} />
        <div className="flex gap-2">
          <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => setDraft(null)}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary !py-1 text-xs disabled:opacity-60" disabled={saving} onClick={save}>{t('common.save')}</button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-1 text-xs px-1">
      {note && (
        <p className="flex items-start gap-1 text-near-black min-w-0" title={note}>
          <StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-graphite" />
          <span className="whitespace-pre-wrap line-clamp-3">{note}</span>
        </p>
      )}
      {canEdit && (
        <button type="button" onClick={() => setDraft(note)}
          className="shrink-0 inline-flex items-center gap-1 font-semibold text-wise-dark hover:underline">
          {note ? <Pencil className="w-3 h-3" /> : <><Plus className="w-3 h-3" /> {t('sales.addNote')}</>}
          {note && <span className="sr-only">{t('sales.editNote')}</span>}
        </button>
      )}
    </div>
  )
}
