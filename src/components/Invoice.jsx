import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Trash2, TrendingUp, Receipt, Share2, Pencil, Copy, Search, X, ChevronDown } from 'lucide-react'

const newId = () => Math.random().toString(36).slice(2, 9)
const blankItem = () => ({ id: newId(), description: '', qty: 1, unitPrice: 0 })

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const monthLabel = (ym) => {
  if (!ym || ym.length < 7) return 'Undated'
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString([], { month: 'long', year: 'numeric' })
}

const deriveCustomerNo = (c) => (c?.id ? String(c.id).toUpperCase() : '')

function CustomerSearchPicker({ customers, selectedId, selectedName, disabled, onPick }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const toggleOpen = () => {
    if (disabled) return
    setOpen((v) => {
      const next = !v
      if (next) setQuery('')
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => {
      const haystack = [c.name, c.industry, c.contact, c.email, c.phone, deriveCustomerNo(c)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [customers, query])

  const choose = (c) => {
    onPick(c.id)
    setOpen(false)
  }

  const clear = (e) => {
    e.stopPropagation()
    onPick('')
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        className="input flex items-center justify-between gap-2 text-left disabled:bg-iron disabled:text-graphite"
      >
        <span className={`truncate ${selectedName ? '' : 'text-graphite'}`}>
          {selectedName || '— Select customer —'}
        </span>
        <span className="flex items-center gap-1 shrink-0 text-graphite">
          {selectedId && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={clear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  clear(e)
                }
              }}
              aria-label="Clear customer"
              className="p-0.5 rounded hover:bg-iron text-graphite cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 right-0 card !p-0 overflow-hidden shadow-lg">
          <div className="relative border-b border-shadow">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-graphite text-center">No matches.</li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => choose(c)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-iron flex items-center justify-between gap-2 ${
                      c.id === selectedId ? 'bg-mint-bg text-wise-dark' : ''
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    {c.industry && (
                      <span className="text-[10px] uppercase tracking-wider text-graphite shrink-0">
                        {c.industry}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export function InvoiceForm({
  initial,
  defaultCustomer = {},
  lockCustomer = false,
  submitLabel = 'Save invoice',
  customers = [],
  onSubmit,
}) {
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10))
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo || '')
  const [customerId, setCustomerId] = useState(
    initial?.customerId ?? defaultCustomer.customerId ?? '',
  )
  const [customerNo, setCustomerNo] = useState(
    initial?.customerNo ?? defaultCustomer.customerNo ?? '',
  )
  const [customerName, setCustomerName] = useState(
    initial?.customerName ?? defaultCustomer.customerName ?? '',
  )

  const hasCustomerList = Array.isArray(customers) && customers.length > 0
  const sortedCustomers = useMemo(
    () => (hasCustomerList ? [...customers].sort((a, b) => (a.name || '').localeCompare(b.name || '')) : []),
    [customers, hasCustomerList],
  )

  const onPickCustomer = (id) => {
    const c = sortedCustomers.find((x) => x.id === id)
    if (!c) {
      setCustomerId('')
      setCustomerName('')
      setCustomerNo('')
      return
    }
    setCustomerId(c.id)
    setCustomerName(c.name || '')
    setCustomerNo(deriveCustomerNo(c))
  }
  const [items, setItems] = useState(
    initial?.items?.length
      ? initial.items.map((it) => ({ id: it.id || newId(), ...it }))
      : [blankItem()],
  )
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? 0.1)
  const [note, setNote] = useState(initial?.note || '')

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.unitPrice || 0), 0),
    [items],
  )
  const tax = subtotal * Number(taxRate || 0)
  const grandTotal = subtotal + tax

  const updateItem = (id, patch) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const removeItem = (id) =>
    setItems((xs) => (xs.length > 1 ? xs.filter((x) => x.id !== id) : xs))
  const addItem = () => setItems((xs) => [...xs, blankItem()])

  const submit = (e) => {
    e.preventDefault()
    if (!customerName.trim()) return
    onSubmit({
      date,
      invoiceNo: invoiceNo.trim(),
      customerId: customerId || undefined,
      customerNo: customerNo.trim(),
      customerName: customerName.trim(),
      source: customerName.trim(),
      items: items.map(({ id, description, qty, unitPrice }) => ({
        id: id || newId(),
        description,
        qty: Number(qty) || 0,
        unitPrice: Number(unitPrice) || 0,
        total: (Number(qty) || 0) * (Number(unitPrice) || 0),
      })),
      taxRate: Number(taxRate) || 0,
      subtotal,
      tax,
      grandTotal,
      amount: grandTotal,
      note: note.trim(),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Invoice date</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Invoice no</label>
          <input
            className="input"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="INV-2026-001"
          />
        </div>
      </div>

      {hasCustomerList ? (
        <div>
          <label className="label">Customer *</label>
          <CustomerSearchPicker
            customers={sortedCustomers}
            selectedId={customerId}
            selectedName={customerName}
            disabled={lockCustomer}
            onPick={onPickCustomer}
          />
          {customerNo && (
            <p className="text-xs text-graphite mt-1">Customer no: <span className="font-medium text-near-black">{customerNo}</span></p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Customer no</label>
            <input
              className="input disabled:bg-iron disabled:text-graphite"
              value={customerNo}
              onChange={(e) => setCustomerNo(e.target.value)}
              placeholder="C-001"
              disabled={lockCustomer}
            />
          </div>
          <div>
            <label className="label">Customer name *</label>
            <input
              className="input disabled:bg-iron disabled:text-graphite"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Acme Holdings"
              disabled={lockCustomer}
            />
          </div>
        </div>
      )}

      <div>
        <label className="label">Line items</label>
        <ul className="space-y-2">
          {items.map((it, idx) => {
            const lineTotal = Number(it.qty || 0) * Number(it.unitPrice || 0)
            return (
              <li key={it.id} className="card !p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-graphite">#{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    disabled={items.length <= 1}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  className="input"
                  value={it.description}
                  onChange={(e) => updateItem(it.id, { description: e.target.value })}
                  placeholder="Description"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-graphite block mb-0.5">Qty</label>
                    <input
                      className="input !py-1.5 !text-sm"
                      type="number"
                      min="0"
                      step="any"
                      value={it.qty}
                      onChange={(e) => updateItem(it.id, { qty: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-graphite block mb-0.5">Unit price</label>
                    <input
                      className="input !py-1.5 !text-sm"
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(it.id, { unitPrice: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-graphite block mb-0.5">Total</label>
                    <p className="px-3 py-1.5 rounded-xl bg-iron text-sm font-medium text-near-black">
                      ${fmtMoney(lineTotal)}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          onClick={addItem}
          className="btn-ghost w-full mt-2 border border-dashed border-graphite"
        >
          <Plus className="w-4 h-4" /> Add row
        </button>
      </div>

      <div className="card !p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-graphite">Subtotal</span>
          <span className="font-semibold">${fmtMoney(subtotal)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-graphite flex items-center gap-2">
            VAT
            <input
              type="number"
              className="w-16 px-2 py-1 rounded-md bg-iron border border-shadow text-xs text-near-black"
              value={Number(taxRate) * 100}
              onChange={(e) => setTaxRate(Number(e.target.value) / 100)}
              step="0.1"
              min="0"
            />
            %
          </span>
          <span className="font-semibold">${fmtMoney(tax)}</span>
        </div>
        <div className="flex justify-between text-base pt-2 border-t border-shadow">
          <span className="font-bold">Grand total</span>
          <span className="font-bold text-emerald-700">${fmtMoney(grandTotal)}</span>
        </div>
      </div>

      <div>
        <label className="label">Note</label>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <button className="btn-primary w-full" type="submit">{submitLabel}</button>
    </form>
  )
}

async function exportMonthlyInvoicesExcel(productName, ym, items) {
  const XLSX = await import('xlsx')

  // Sheet 1: invoice summary, one row per invoice.
  const summary = items.map((x) => ({
    'Invoice Date': x.date || '',
    'Invoice No': x.invoiceNo || '',
    'Customer No': x.customerNo || '',
    'Customer Name': x.customerName || x.source || '',
    'Subtotal (USD)': Number(x.subtotal || 0),
    'VAT %': Number((Number(x.taxRate || 0) * 100).toFixed(2)),
    'VAT Amount (USD)': Number(x.tax || 0),
    'Grand Total (USD)': Number(x.amount || 0),
    'Note': x.note || '',
  }))
  const wsSummary = XLSX.utils.json_to_sheet(summary)
  wsSummary['!cols'] = [
    { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 28 },
    { wch: 14 }, { wch: 8 },  { wch: 14 }, { wch: 16 }, { wch: 30 },
  ]

  // Sheet 2: line items, one row per line, with parent invoice ref.
  const lineRows = []
  for (const x of items) {
    const lines = Array.isArray(x.items) ? x.items : []
    if (lines.length === 0) continue
    lines.forEach((it, i) => {
      lineRows.push({
        'Invoice No': x.invoiceNo || '',
        'Invoice Date': x.date || '',
        'Customer Name': x.customerName || x.source || '',
        'Line': i + 1,
        'Description': it.description || '',
        'Qty': Number(it.qty || 0),
        'Unit Price (USD)': Number(it.unitPrice || 0),
        'Total (USD)': Number(it.total || 0),
      })
    })
  }
  const wsLines = XLSX.utils.json_to_sheet(
    lineRows.length ? lineRows : [{
      'Invoice No': '', 'Invoice Date': '', 'Customer Name': '',
      'Line': '', 'Description': 'No line items',
      'Qty': '', 'Unit Price (USD)': '', 'Total (USD)': '',
    }],
  )
  wsLines['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 6 },
    { wch: 36 }, { wch: 8 },  { wch: 14 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Invoices')
  XLSX.utils.book_append_sheet(wb, wsLines, 'Line items')

  const safeMonth = monthLabel(ym).replace(/[^A-Za-z0-9-_]+/g, '_')
  const safeProduct = (productName || 'product').replace(/[^A-Za-z0-9-_]+/g, '_')
  XLSX.writeFile(wb, `accounting-${safeProduct}-${safeMonth}.xlsx`)
}

export function MonthlyIncomeList({ items, onTap, productName, query = '' }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((x) => {
      const haystack = [
        x.customerName,
        x.customerNo,
        x.invoiceNo,
        x.source,
        x.note,
        x.date,
        ...(Array.isArray(x.items) ? x.items.map((it) => it.description) : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, query])

  const grouped = useMemo(() => {
    const acc = {}
    for (const x of filtered) {
      const ym = (x.date || '').slice(0, 7) || 'unknown'
      acc[ym] = acc[ym] || []
      acc[ym].push(x)
    }
    return Object.entries(acc).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  if (items.length === 0) {
    return <p className="text-center text-sm text-graphite py-6">No income recorded yet.</p>
  }

  if (filtered.length === 0) {
    return <p className="text-center text-sm text-graphite py-6">No matches.</p>
  }

  return (
    <div className="space-y-4">
      {grouped.map(([ym, entries]) => {
        const monthTotal = entries.reduce((s, x) => s + Number(x.amount || 0), 0)
        const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        return (
          <section key={ym}>
            <div className="flex items-center justify-between gap-2 px-1 mb-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-graphite">
                {monthLabel(ym)}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700">
                  ${Number(monthTotal).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => exportMonthlyInvoicesExcel(productName, ym, sorted)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-iron text-graphite hover:bg-mint-bg hover:text-wise-dark transition-colors"
                  title="Share this month's invoices to the accounting team"
                >
                  <Share2 className="w-3 h-3" /> Share
                </button>
              </div>
            </div>
            <ul className="card divide-y divide-shadow p-0">
              {sorted.map((x) => {
                const isInvoice = Array.isArray(x.items) && x.items.length > 0
                const subtitleParts = [x.date]
                if (x.invoiceNo) subtitleParts.push(x.invoiceNo)
                if (isInvoice) subtitleParts.push(`${x.items.length} item${x.items.length > 1 ? 's' : ''}`)
                return (
                  <li key={x.id}>
                    <button
                      onClick={() => onTap(x)}
                      className="w-full text-left flex items-center gap-3 p-3.5 active:bg-iron"
                    >
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        {isInvoice ? <Receipt className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {x.customerName || x.source || x.note || 'Income'}
                        </p>
                        <p className="text-xs text-graphite truncate">
                          {subtitleParts.filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <p className="font-semibold text-sm text-emerald-700">
                        +${Number(x.amount || 0).toLocaleString()}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function InvoiceDetail({ invoice, onDelete, onUpdate, onDuplicate, customers = [] }) {
  const [editing, setEditing] = useState(false)
  if (!invoice) return null
  const isInvoice = Array.isArray(invoice.items) && invoice.items.length > 0

  if (editing && onUpdate) {
    return (
      <InvoiceForm
        initial={invoice}
        customers={customers}
        submitLabel="Update invoice"
        onSubmit={(data) => {
          onUpdate(data)
          setEditing(false)
        }}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="card !p-3 space-y-1 text-sm">
        <Row label="Date" value={invoice.date || '—'} />
        {invoice.invoiceNo && <Row label="Invoice #" value={invoice.invoiceNo} />}
        {invoice.customerNo && <Row label="Customer #" value={invoice.customerNo} />}
        <Row label="Customer" value={invoice.customerName || invoice.source || '—'} bold />
      </div>

      {isInvoice ? (
        <>
          <div className="card !p-0 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-iron text-graphite">
                <tr>
                  <th className="text-left p-2 font-semibold">#</th>
                  <th className="text-left p-2 font-semibold">Description</th>
                  <th className="text-right p-2 font-semibold">Qty</th>
                  <th className="text-right p-2 font-semibold">Unit</th>
                  <th className="text-right p-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it, i) => (
                  <tr key={it.id || i} className="border-t border-shadow">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{it.description || '—'}</td>
                    <td className="p-2 text-right">{it.qty}</td>
                    <td className="p-2 text-right">${fmtMoney(it.unitPrice)}</td>
                    <td className="p-2 text-right font-medium">${fmtMoney(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card !p-3 space-y-1.5 text-sm">
            <Row label="Subtotal" value={`$${fmtMoney(invoice.subtotal)}`} />
            <Row
              label={`VAT ${(Number(invoice.taxRate || 0) * 100).toFixed(1)}%`}
              value={`$${fmtMoney(invoice.tax)}`}
            />
            <div className="flex justify-between text-base pt-2 border-t border-shadow">
              <span className="font-bold">Grand total</span>
              <span className="font-bold text-emerald-700">${fmtMoney(invoice.amount)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="card !p-3 text-sm">
          <Row label="Amount" value={`$${Number(invoice.amount || 0).toLocaleString()}`} bold />
        </div>
      )}

      {invoice.note && (
        <div className="card !p-3">
          <p className="text-xs text-graphite mb-1">Note</p>
          <p className="text-sm">{invoice.note}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {onUpdate && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn-primary w-full"
          >
            <Pencil className="w-4 h-4" /> Update
          </button>
        )}
        {onDuplicate && (
          <button
            type="button"
            onClick={() => onDuplicate(invoice)}
            className="px-4 py-2.5 rounded-xl bg-iron hover:bg-mint-bg hover:text-wise-dark text-sm font-semibold w-full border border-shadow inline-flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" /> Duplicate
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="px-4 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 text-sm font-semibold w-full border border-rose-100"
      >
        Delete entry
      </button>
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-graphite">{label}</span>
      <span className={`text-right ${bold ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  )
}
