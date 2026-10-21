import { useEffect, useRef, useState } from 'react'
import { Search, Phone, User, X, Plus, StickyNote } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'

const MAX_PER_GROUP = 6

// Who a sales activity is with — one search box over Customers and prospects
// (Partner business cards). The result list floats over the form and is only
// open while searching, so the form keeps its height however many customers
// there are. A card that already became a customer selects that customer; a
// Deal Won with a prospect turns it into one (API, convertIfWon).
export default function PartyPicker({ customerId, partnerId, onChange }) {
  const { state, addPartner } = useStore()
  const { t } = useT()
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0) // highlighted row for the keyboard
  const [card, setCard] = useState(null) // null | { name, company, phone, notes } while adding a card

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
  const customerName = (id) => state.customers.find((c) => c.id === id)?.name
  const customerRows = state.customers.filter((c) => hit(c.name, c.phone, c.contact))
  const partnerRows = state.partners.filter((p) => hit(p.name, p.company, p.phone))
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
    else onChange(row.item.customerId
      ? { customerId: row.item.customerId, partnerId: row.item.id }
      : { customerId: null, partnerId: row.item.id })
    close()
  }
  const createCard = async () => {
    const p = await addPartner({ name: card.name.trim(), company: card.company.trim() || null, phone: card.phone.trim() || null, notes: card.notes.trim() || null })
    if (p) choose({ kind: 'partner', item: p })
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

  return (
    <div ref={boxRef} className="relative">
      {showChip ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button type="button" onClick={startSearch}
              className="flex items-center gap-2 min-w-0 rounded-full bg-iron hover:bg-shadow/50 pl-3 pr-2 py-1.5 font-semibold text-near-black">
              <span className="truncate">{customer ? customer.name : partner.company || partner.name}</span>
              {prospect && <span className="pill bg-accent-100 text-accent-700 !text-[10px] shrink-0">{t('sales.prospect')}</span>}
            </button>
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
          {/* The business card's note — who they are, what they need. */}
          {partner?.notes && (
            <p className="flex items-start gap-1 text-xs text-near-black px-1" title={partner.notes}>
              <StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-graphite" />
              <span className="whitespace-pre-wrap line-clamp-3">{partner.notes}</span>
            </p>
          )}
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
            <div className="p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-graphite">{t('sales.newCard')}</p>
              <input className="input" autoFocus placeholder={t('sales.cardName')} value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
              <input className="input" placeholder={t('sales.cardCompany')} value={card.company} onChange={(e) => setCard({ ...card, company: e.target.value })} />
              <input className="input" placeholder={t('sales.prospectPhone')} value={card.phone} onChange={(e) => setCard({ ...card, phone: e.target.value })} />
              <textarea className="input min-h-[72px]" placeholder={t('sales.cardNotes')} aria-label={t('partner.field.notes')} value={card.notes} onChange={(e) => setCard({ ...card, notes: e.target.value })} />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={() => setCard(null)}>{t('common.cancel')}</button>
                <button type="button" className="btn-primary !py-1.5 text-sm" disabled={!card.name.trim()} onClick={createCard}>{t('common.save')}</button>
              </div>
            </div>
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
                          <span className="font-semibold flex-1 truncate">{row.item.name}</span>
                          {row.item.phone && <span className="text-xs text-graphite tabular-nums">{row.item.phone}</span>}
                        </>
                      )}
                      {row.kind === 'partner' && (
                        <>
                          <span className="flex-1 truncate">
                            <span className="font-semibold">{row.item.name}</span>
                            {row.item.company && <span className="text-graphite"> · {row.item.company}</span>}
                          </span>
                          {row.item.customerId
                            ? <span className="pill bg-success-100 text-success-700 !text-[10px]">{t('sales.nowCustomer', { name: customerName(row.item.customerId) || '' })}</span>
                            : <span className="pill bg-accent-100 text-accent-700 !text-[10px]">{t('sales.prospect')}</span>}
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
