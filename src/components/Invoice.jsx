import { useState, useMemo } from 'react'
import { Plus, Trash2, TrendingUp, Receipt } from 'lucide-react'

const newId = () => Math.random().toString(36).slice(2, 9)
const blankItem = () => ({ id: newId(), description: '', qty: 1, unitPrice: 0 })

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const monthLabel = (ym) => {
  if (!ym || ym.length < 7) return 'Undated'
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString([], { month: 'long', year: 'numeric' })
}

export function InvoiceForm({
  initial,
  defaultCustomer = {},
  lockCustomer = false,
  submitLabel = 'Save invoice',
  onSubmit,
}) {
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10))
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo || '')
  const [customerNo, setCustomerNo] = useState(
    initial?.customerNo ?? defaultCustomer.customerNo ?? '',
  )
  const [customerName, setCustomerName] = useState(
    initial?.customerName ?? defaultCustomer.customerName ?? '',
  )
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

export function MonthlyIncomeList({ items, onTap }) {
  const grouped = useMemo(() => {
    const acc = {}
    for (const x of items) {
      const ym = (x.date || '').slice(0, 7) || 'unknown'
      acc[ym] = acc[ym] || []
      acc[ym].push(x)
    }
    return Object.entries(acc).sort((a, b) => b[0].localeCompare(a[0]))
  }, [items])

  if (items.length === 0) {
    return <p className="text-center text-sm text-graphite py-6">No income recorded yet.</p>
  }

  return (
    <div className="space-y-4">
      {grouped.map(([ym, entries]) => {
        const monthTotal = entries.reduce((s, x) => s + Number(x.amount || 0), 0)
        const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        return (
          <section key={ym}>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-graphite">
                {monthLabel(ym)}
              </h3>
              <span className="text-xs font-bold text-emerald-700">
                ${Number(monthTotal).toLocaleString()}
              </span>
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

export function InvoiceDetail({ invoice, onDelete }) {
  if (!invoice) return null
  const isInvoice = Array.isArray(invoice.items) && invoice.items.length > 0
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
