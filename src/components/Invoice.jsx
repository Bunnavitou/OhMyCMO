import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Trash2, TrendingUp, Receipt, Share2, Pencil, Copy, Search, X, ChevronDown, Eye, Paperclip, Download, Upload, FileSpreadsheet, Send, Printer, RefreshCw, Loader2, CheckCircle2, AlertCircle, Link2 } from 'lucide-react'
import Modal from './Modal.jsx'
import { fmtMoney, isEmail, applyPlaceholders, parseRecipients, validRecipients, recipientsText } from '../utils/email.js'
import { useZohoStatus, sendInvoiceReport } from '../utils/zoho.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'

// Format an ISO timestamp as a short, human date-time (or '—' when absent).
const fmtWhen = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

const newId = () => Math.random().toString(36).slice(2, 9)
const blankItem = () => ({ id: newId(), description: '', qty: 1, unitPrice: 0 })

// Email attachment constraints — spreadsheets only, capped at 10MB.
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
const ATTACHMENT_ACCEPT = '.xlsx,.xls,.csv'
const ATTACHMENT_EXTS = ['.xlsx', '.xls', '.csv']
const hasAllowedExt = (name) =>
  ATTACHMENT_EXTS.some((ext) => String(name || '').toLowerCase().endsWith(ext))
const fmtBytes = (n) => {
  const b = Number(n || 0)
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// Invoice email defaults.
const DEFAULT_EMAIL_SUBJECT = 'Invoice {invoice_no} from {company_name}'
const DEFAULT_EMAIL_BODY =
  'Dear {customer_name},\n\nPlease find attached invoice {invoice_no} for a total of {grand_total}.\n\nThank you for your business.'

// Resolve a customer's invoice-email template (raw, with {placeholders}). The
// customer's Email tab (taskEmail) is the single source of truth, then the
// invoice billing defaults, then the provided snapshot / global defaults. Used
// for the form prefill, the customer picker, and the send — so all three agree.
function resolveEmailTemplate(customer, snapshot = {}) {
  const te = customer?.taskEmail || {}
  // `to` is a list of recipients (legacy data may be a single string).
  const toSource = (te.to && (Array.isArray(te.to) ? te.to.length : true) && te.to)
    || customer?.billingEmail || customer?.email || snapshot.to || ''
  const to = parseRecipients(toSource)
  const cc = Array.isArray(te.cc) && te.cc.length ? te.cc
    : Array.isArray(customer?.emailCc) && customer.emailCc.length ? customer.emailCc
    : Array.isArray(snapshot.cc) ? snapshot.cc : []
  const subject = te.subject || customer?.emailTemplate?.subject || snapshot.subject || DEFAULT_EMAIL_SUBJECT
  const body = te.body || customer?.emailTemplate?.body || snapshot.body || DEFAULT_EMAIL_BODY
  return { to, cc, subject, body }
}

// Build the per-line attachment rows for the invoice preview / Excel export.
// Columns mirror the emailed spreadsheet: Description, Qty, Unit price,
// Total Fee, VAT %, Total Amount.
const buildAttachmentRows = (items, taxRate) => {
  const rate = Number(taxRate || 0)
  const rows = (items || []).map((it) => {
    const qty = Number(it.qty || 0)
    const unitPrice = Number(it.unitPrice || 0)
    const totalFee = qty * unitPrice
    const vat = totalFee * rate
    const totalAmount = totalFee + vat
    return {
      description: it.description || '',
      qty,
      unitPrice,
      totalFee,
      vat,
      totalAmount,
    }
  })
  const totalPay = rows.reduce((s, r) => s + r.totalAmount, 0)
  return { rows, totalPay, rate }
}

const invoiceExcelSafeName = (invoice) =>
  `invoice-${(invoice.invoiceNo || 'invoice').replace(/[^A-Za-z0-9-_]+/g, '_')}.xlsx`

// Build the shared XLSX workbook (single sheet) for an invoice's line items.
async function buildInvoiceWorkbook(invoice) {
  const XLSX = await import('xlsx')
  const { rows, totalPay, rate } = buildAttachmentRows(invoice.items, invoice.taxRate)
  const vatHeader = `VAT ${(rate * 100).toFixed(rate * 100 % 1 ? 1 : 0)}%`
  const aoa = [
    ['Description', 'Qty', 'Unit Price', 'Total Fee', vatHeader, 'Total Amount'],
    ...rows.map((r) => [r.description, r.qty, r.unitPrice, r.totalFee, r.vat, r.totalAmount]),
    ['Total Amount Pay', '', '', '', '', totalPay],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Invoice')
  return { XLSX, wb }
}

// Export a single invoice as an Excel attachment matching the preview table.
async function exportInvoiceExcel(invoice) {
  const { XLSX, wb } = await buildInvoiceWorkbook(invoice)
  XLSX.writeFile(wb, invoiceExcelSafeName(invoice))
}

// Small Cc editor: chips with remove, plus an input that adds on Enter/comma/blur.
export function CcEditor({ value, onChange }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const addr = draft.trim().replace(/,$/, '').trim()
    if (addr && !value.includes(addr)) onChange([...value, addr])
    setDraft('')
  }
  return (
    <div className="input flex flex-wrap items-center gap-1 min-h-[2.5rem] py-1">
      {value.map((addr) => (
        <span
          key={addr}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
            isEmail(addr) ? 'bg-iron text-near-black' : 'bg-red-100 text-red-700'
          }`}
        >
          {addr}
          <button
            type="button"
            onClick={() => onChange(value.filter((a) => a !== addr))}
            aria-label={`Remove ${addr}`}
            className="hover:text-red-600"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={value.length ? '' : 'cc@company.com'}
      />
    </div>
  )
}

// Read-only preview of the invoice email exactly as it will be sent — including
// its attachments: any user-uploaded spreadsheets plus the invoice spreadsheet
// generated from the line items (rendered as a table). Shown in a popup so the
// sender can confirm everything is correct before sending.
export function EmailPreview({ to, cc, subject, body, items = [], taxRate, invoiceNo, attachments = [] }) {
  // Render the message exactly as the send will build it: the invoice table is
  // injected at the {invoice_table} token (or just before the signature) using
  // the same helper doSend uses, so the preview matches the delivered email.
  const composedHtml = useMemo(
    () => composeInvoiceHtmlBody(body || '', invoiceEmailTableHtml({ items, taxRate })),
    [body, items, taxRate],
  )

  return (
    <div className="space-y-3 text-sm">
      <div className="card !p-3 space-y-1">
        <div className="flex gap-2">
          <span className="w-16 shrink-0 text-graphite">To</span>
          <span className="font-medium break-all">{recipientsText(to) || <em className="text-graphite">no recipient</em>}</span>
        </div>
        {cc?.length > 0 && (
          <div className="flex gap-2">
            <span className="w-16 shrink-0 text-graphite">Cc</span>
            <span className="break-all">{cc.join(', ')}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="w-16 shrink-0 text-graphite">Subject</span>
          <span className="font-semibold">{subject || <em className="text-graphite">no subject</em>}</span>
        </div>
      </div>

      <div className="card !p-3">
        <p className="text-xs text-graphite mb-1">Message</p>
        {composedHtml ? (
          <div
            className="text-sm leading-relaxed overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: composedHtml }}
          />
        ) : (
          <em className="text-graphite">empty body</em>
        )}
      </div>

      {(items.length > 0 || attachments.length > 0) && (
      <div className="space-y-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-graphite">
          <Paperclip className="w-3.5 h-3.5" /> Attachments{attachments.length ? ` (${attachments.length})` : ''}
        </p>

        {/* User-uploaded spreadsheets — the only files attached to the email. */}
        {attachments.length === 0 ? (
          <p className="text-[11px] text-graphite">No files attached — the invoice table is embedded in the message above.</p>
        ) : (
          attachments.map((att, i) => (
            <div key={`${att.name}-${i}`} className="card !p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{att.name}</p>
                <p className="text-[11px] text-graphite">{fmtBytes(att.size)} · attached to email</p>
              </div>
              {att.dataUrl && (
                <a
                  href={att.dataUrl}
                  download={att.name}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-iron text-graphite hover:bg-mint-bg hover:text-wise-dark transition-colors"
                >
                  <Download className="w-3 h-3" /> Download
                </a>
              )}
            </div>
          ))
        )}

        {/* The invoice table renders inline in the message above; the
            spreadsheet is offered here as a download convenience. */}
        {items.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <span className="inline-flex items-center gap-1.5 text-xs text-graphite">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Invoice table
              <span className="text-[10px] uppercase tracking-wider">· shown in message</span>
            </span>
            <button
              type="button"
              onClick={() => exportInvoiceExcel({ items, taxRate, invoiceNo })}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-iron text-graphite hover:bg-mint-bg hover:text-wise-dark transition-colors"
            >
              <Download className="w-3 h-3" /> Excel
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

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

  // Email section — the linked customer's Email tab is the source of truth, so
  // editing an existing invoice always prefills with the customer's LATEST
  // template (falling back to the invoice's stored snapshot). Fully editable.
  const initialCustomer = (initial?.customerId || defaultCustomer.customerId)
    ? customers.find((c) => c.id === (initial?.customerId || defaultCustomer.customerId))
    : null
  const initialEmail = initialCustomer
    ? resolveEmailTemplate(initialCustomer, initial?.email || {})
    : {
        to: parseRecipients(initial?.email?.to),
        cc: Array.isArray(initial?.email?.cc) ? initial.email.cc : [],
        subject: initial?.email?.subject || '',
        body: initial?.email?.body || '',
      }
  const [emailTo, setEmailTo] = useState(initialEmail.to)
  const [emailCc, setEmailCc] = useState(initialEmail.cc)
  const [emailSubject, setEmailSubject] = useState(initialEmail.subject)
  const [emailBody, setEmailBody] = useState(initialEmail.body)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Email attachments — user-uploaded spreadsheets that ride along with the
  // invoice email. Each stored as { name, size, type, dataUrl }; more than one
  // is allowed. Accepts the legacy single-`attachment` shape too.
  const [attachments, setAttachments] = useState(() => {
    if (Array.isArray(initial?.email?.attachments)) return initial.email.attachments
    if (initial?.email?.attachment) return [initial.email.attachment]
    return []
  })
  const [attachError, setAttachError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const attachInputRef = useRef(null)

  // Validate + read each dropped/picked file, appending valid ones to the list.
  const acceptFiles = (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setAttachError('')
    files.forEach((file) => {
      if (!hasAllowedExt(file.name)) {
        setAttachError('Only .xlsx, .xls or .csv files are allowed.')
        return
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        setAttachError(`"${file.name}" is too large (max 10MB).`)
        return
      }
      const reader = new FileReader()
      reader.onload = () =>
        setAttachments((prev) => [
          ...prev,
          { name: file.name, size: file.size, type: file.type || '', dataUrl: reader.result },
        ])
      reader.readAsDataURL(file)
    })
  }

  const onAttachPicked = (e) => {
    acceptFiles(e.target.files)
    e.target.value = '' // allow re-picking the same file(s)
  }
  const onAttachDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    acceptFiles(e.dataTransfer.files)
  }
  const removeAttachment = (idx) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx))

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

    // Auto-fill the email section from the customer's Email tab (the source of
    // truth). Subject/Body keep their {placeholders}; resolved in the preview.
    const email = resolveEmailTemplate(c)
    setEmailTo(email.to)
    setEmailCc(email.cc)
    setEmailSubject(email.subject)
    setEmailBody(email.body)
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

  // Placeholder values for resolving the email subject/body (preview + at save).
  const emailCtx = useMemo(() => {
    const c = customerId ? customers.find((x) => x.id === customerId) : null
    return {
      invoice_no: invoiceNo.trim() || '—',
      company_name: customerName.trim(),
      customer_name: (c?.contact || customerName).trim(),
      // task_name may appear in templates sourced from the customer's Email tab.
      task_name: customerName.trim(),
      grand_total: `$${fmtMoney(grandTotal)}`,
    }
  }, [customerId, customers, invoiceNo, customerName, grandTotal])

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
      email: {
        to: parseRecipients(emailTo),
        cc: emailCc.map((s) => s.trim()).filter(Boolean),
        // Store the raw templates (with placeholders) plus a resolved snapshot
        // so a later send has both the reusable template and the final text.
        subject: emailSubject,
        body: emailBody,
        resolvedSubject: applyPlaceholders(emailSubject, emailCtx),
        resolvedBody: applyPlaceholders(emailBody, emailCtx),
        // User-uploaded spreadsheets attached to the outgoing email (0 or more).
        attachments,
      },
    })
  }

  return (
    <>
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

      {/* Email — auto-filled from the customer's saved defaults. Review the
          composed email and its attachment in the preview popup before sending. */}
      {customerName.trim() ? (
        <div>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="btn-ghost w-full border border-shadow"
          >
            <Eye className="w-4 h-4" /> Preview email
          </button>
          <p className="text-[11px] text-graphite text-center mt-1">
            Opens a popup with the email and its attachment, exactly as it will be sent.
          </p>
        </div>
      ) : null}

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

      {/* Attachments — one or more spreadsheets sent with the invoice email. */}
      <div>
        <label className="label">Attachments</label>
        <input
          ref={attachInputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          onChange={onAttachPicked}
          className="hidden"
        />
        <div className="space-y-2">
          {attachments.map((att, idx) => (
            <div key={`${att.name}-${idx}`} className="card !p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{att.name}</p>
                <p className="text-[11px] text-graphite">{fmtBytes(att.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                aria-label={`Remove ${att.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => attachInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onAttachDrop}
            className={`w-full flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border-2 border-dashed text-center transition-colors ${
              dragOver ? 'border-brand-500 bg-mint-bg/50' : 'border-graphite/40 hover:bg-iron'
            }`}
          >
            <Upload className="w-5 h-5 text-graphite" />
            <span className="text-sm font-medium text-near-black">
              {attachments.length ? 'Add another file' : 'Drag & drop or click to upload'}
            </span>
            <span className="text-[11px] text-graphite">.xlsx, .xls or .csv · up to 10MB each</span>
          </button>
        </div>
        {attachError && <p className="text-xs text-red-600 mt-1">{attachError}</p>}
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

    <Modal
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      title="Email preview"
      size="2xl"
    >
      <EmailPreview
        to={emailTo}
        cc={emailCc.map((s) => s.trim()).filter(Boolean)}
        subject={applyPlaceholders(emailSubject, emailCtx)}
        body={applyPlaceholders(emailBody, emailCtx)}
        items={items}
        taxRate={taxRate}
        invoiceNo={invoiceNo.trim()}
        attachments={attachments}
      />
    </Modal>
    </>
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

export function MonthlyIncomeList({ items, onTap, productName, query = '', onBulkDuplicate }) {
  const { user } = useAuth()
  const canDuplicate = hasPermission(user, 'billing.duplicate')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const exitSelect = () => {
    setSelectMode(false)
    setSelected(new Set())
  }
  const doBulkDuplicate = () => {
    const chosen = items.filter((x) => selected.has(x.id))
    if (chosen.length) onBulkDuplicate?.(chosen)
    exitSelect()
  }

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
      {onBulkDuplicate && canDuplicate && (
        <div className="flex items-center justify-between gap-2 px-1">
          {selectMode ? (
            <>
              <span className="text-xs font-semibold text-graphite">{selected.size} selected</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exitSelect}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-iron text-graphite hover:bg-shadow"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={doBulkDuplicate}
                  disabled={selected.size === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-wise-dark text-white hover:opacity-90 disabled:opacity-40"
                >
                  <Copy className="w-3.5 h-3.5" /> Duplicate ({selected.size})
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-iron text-graphite hover:bg-mint-bg hover:text-wise-dark transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Select to duplicate
            </button>
          )}
        </div>
      )}
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
                      onClick={() => (selectMode ? toggle(x.id) : onTap(x))}
                      className="w-full text-left flex items-center gap-3 p-3.5 active:bg-iron"
                    >
                      {selectMode && (
                        <input
                          type="checkbox"
                          readOnly
                          checked={selected.has(x.id)}
                          className="w-4 h-4 accent-wise-dark shrink-0"
                        />
                      )}
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

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))

// Inline HTML table of the invoice line items, embedded into the email body so
// recipients see the figures in the message itself (matching the reference
// invoice email) — not only in the spreadsheet attachment. Uses inline styles
// because email clients strip <style> blocks. Returns '' when there are no
// line items (e.g. a plain income entry).
function invoiceEmailTableHtml(invoice) {
  const lines = Array.isArray(invoice.items) ? invoice.items : []
  if (!lines.length) return ''
  const { rows, totalPay, rate } = buildAttachmentRows(lines, invoice.taxRate)
  const vatPct = (rate * 100).toFixed(rate * 100 % 1 ? 1 : 0)
  const cell = 'border:1px solid #cccccc;padding:6px 10px;font-size:13px;'
  const th = `${cell}background:#f2f2f2;text-align:left;`
  const thR = `${cell}background:#f2f2f2;text-align:right;`
  const tdR = `${cell}text-align:right;`
  const totalCell = `${cell}background:#fff59d;font-weight:bold;`
  const body = rows
    .map(
      (r) => `<tr>
        <td style="${cell}">${esc(r.description || '')}</td>
        <td style="${tdR}">${esc(r.qty)}</td>
        <td style="${tdR}">${fmtMoney(r.unitPrice)}</td>
        <td style="${tdR}">${fmtMoney(r.totalFee)}</td>
        <td style="${tdR}">${fmtMoney(r.vat)}</td>
        <td style="${tdR}">${fmtMoney(r.totalAmount)}</td>
      </tr>`,
    )
    .join('')
  return `<table style="border-collapse:collapse;margin:16px 0;width:100%;max-width:680px" cellspacing="0" cellpadding="0">
    <thead><tr>
      <th style="${th}">Description</th>
      <th style="${thR}">Qty</th>
      <th style="${thR}">Unit Price</th>
      <th style="${thR}">Total Fee</th>
      <th style="${thR}">VAT ${vatPct}%</th>
      <th style="${thR}">Total Amount</th>
    </tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr>
      <td colspan="5" style="${totalCell}">Total Amount Pay</td>
      <td style="${totalCell}text-align:right;">$${fmtMoney(totalPay)}</td>
    </tr></tfoot>
  </table>`
}

// Compose the HTML email body: message text with the invoice table inserted.
// Placement priority:
//   1. where an explicit {invoice_table} token appears, else
//   2. at the start of the closing block — the paragraph containing the sign-off
//      (Best regards / Regards / Sincerely…) — so any note the user writes just
//      above the sign-off stays BELOW the table, else
//   3. appended at the end.
function composeInvoiceHtmlBody(bodyText, tableHtml) {
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>')
  const TOKEN = '{invoice_table}'
  const table = tableHtml || ''
  // Honour an explicit token first — joining with '' cleanly drops the token
  // when there's no table (e.g. previewing the template with no invoice).
  if (bodyText.includes(TOKEN)) {
    return bodyText.split(TOKEN).map(nl2br).join(table)
  }
  if (!table) return bodyText ? nl2br(bodyText) : ''
  const sig = bodyText.match(/\n\s*(best regards|kind regards|warm regards|sincerely|regards|thank you|thanks)\b/i)
  if (sig) {
    // Walk back to the blank line that starts the sign-off's paragraph so the
    // table separates the message from the whole closing block, not just the
    // sign-off word.
    const para = bodyText.lastIndexOf('\n\n', sig.index)
    const cut = para === -1 ? sig.index : para
    return nl2br(bodyText.slice(0, cut)) + tableHtml + nl2br(bodyText.slice(cut))
  }
  return `${nl2br(bodyText)}${tableHtml}`
}

// Open a standalone, print-ready invoice document in a new window and trigger
// the browser print dialog (which offers "Save as PDF").
function openInvoiceReport(invoice) {
  const lines = Array.isArray(invoice.items) ? invoice.items : []
  const vatPct = (Number(invoice.taxRate || 0) * 100).toFixed(1)
  const rowsHtml = lines.length
    ? lines.map((it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(it.description || '—')}</td>
          <td class="r">${esc(it.qty)}</td>
          <td class="r">$${fmtMoney(it.unitPrice)}</td>
          <td class="r">$${fmtMoney(it.total)}</td>
        </tr>`).join('')
    : `<tr><td colspan="5">Amount: $${fmtMoney(invoice.amount)}</td></tr>`
  const totalsHtml = lines.length
    ? `<div class="row"><span>Subtotal</span><span>$${fmtMoney(invoice.subtotal)}</span></div>
       <div class="row"><span>VAT ${vatPct}%</span><span>$${fmtMoney(invoice.tax)}</span></div>`
    : ''
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Invoice ${esc(invoice.invoiceNo || '')}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #0e0f0c; margin: 0; padding: 40px; }
      .doc { max-width: 720px; margin: 0 auto; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #ddd; padding-bottom: 16px; }
      h1 { font-size: 28px; margin: 0; letter-spacing: -0.5px; }
      .muted { color: #777; }
      .billto { padding: 16px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { padding: 8px 4px; border-bottom: 1px solid #eee; text-align: left; }
      th { color: #777; border-top: 1px solid #ddd; }
      .r { text-align: right; }
      .totals { max-width: 260px; margin-left: auto; margin-top: 16px; font-size: 14px; }
      .row { display: flex; justify-content: space-between; padding: 4px 0; }
      .grand { display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid #ddd; font-weight: 700; font-size: 16px; }
      .note { margin-top: 20px; padding-top: 12px; border-top: 1px solid #eee; font-size: 13px; }
      @media print { body { padding: 0; } }
    </style></head><body><div class="doc">
      <div class="head">
        <div><h1>INVOICE</h1>${invoice.invoiceNo ? `<div class="muted">${esc(invoice.invoiceNo)}</div>` : ''}</div>
        <div style="text-align:right"><div class="muted">Date</div><div>${esc(invoice.date || '—')}</div></div>
      </div>
      <div class="billto"><div class="muted" style="text-transform:uppercase;font-size:11px;letter-spacing:1px">Bill to</div>
        <div style="font-weight:600">${esc(invoice.customerName || invoice.source || '—')}</div>
        ${invoice.customerNo ? `<div class="muted">Customer #: ${esc(invoice.customerNo)}</div>` : ''}
      </div>
      <table><thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table>
      <div class="totals">${totalsHtml}<div class="grand"><span>Grand total</span><span>$${fmtMoney(invoice.amount)}</span></div></div>
      ${invoice.note ? `<div class="note"><div class="muted" style="text-transform:uppercase;font-size:11px;letter-spacing:1px">Note</div>${esc(invoice.note)}</div>` : ''}
    </div>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };</script>
    </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}

export function InvoiceDetail({ invoice, onDelete, onUpdate, onDuplicate, customers = [], onLogSend }) {
  const [editing, setEditing] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [sendState, setSendState] = useState('idle') // idle | sending | success | error
  const [sendError, setSendError] = useState('')
  const [setupOpen, setSetupOpen] = useState(false)
  const zoho = useZohoStatus()
  const { user } = useAuth()
  const canSend = hasPermission(user, 'billing.send')
  const canDelete = hasPermission(user, 'billing.delete')
  const canDuplicate = hasPermission(user, 'billing.duplicate')

  // Resolve the email using the linked customer's CURRENT Email-tab settings so
  // edits made after the invoice was created are honoured at send time. Falls
  // back to the invoice's stored snapshot when no linked customer is found.
  const liveEmail = useMemo(() => {
    const snap = invoice?.email || {}
    const fallback = {
      to: parseRecipients(snap.to),
      cc: Array.isArray(snap.cc) ? snap.cc : [],
      subject: snap.resolvedSubject || snap.subject || `Invoice ${invoice?.invoiceNo || ''}`.trim(),
      body: snap.resolvedBody || snap.body || '',
    }
    const c = invoice?.customerId ? customers.find((x) => x.id === invoice.customerId) : null
    if (!c) return fallback

    // The customer's Email tab (taskEmail) is the source of truth; the invoice
    // snapshot is only a fallback. Same resolver the form uses, so all agree.
    const tpl = resolveEmailTemplate(c, snap)
    const ctx = {
      invoice_no: (invoice?.invoiceNo || '').trim() || '—',
      company_name: (invoice?.customerName || c.name || '').trim(),
      customer_name: (c.contact || invoice?.customerName || c.name || '').trim(),
      task_name: (invoice?.customerName || c.name || '').trim(),
      grand_total: `$${fmtMoney(invoice?.grandTotal ?? invoice?.amount ?? 0)}`,
    }
    return {
      to: tpl.to,
      cc: tpl.cc,
      subject: applyPlaceholders(tpl.subject, ctx),
      body: applyPlaceholders(tpl.body, ctx),
    }
  }, [invoice, customers])

  // `to` may hold multiple recipients (array); keep a valid subset for sending
  // and a display string for the UI.
  const recipients = validRecipients(liveEmail.to)
  const recipientsLabel = recipientsText(liveEmail.to)
  const ccList = liveEmail.cc

  // Send the invoice report over Zoho Mail (server-side SMTP). Attaches only
  // the user-uploaded files (the invoice figures are rendered inline in the
  // email body), records a send-history entry, and logs an audit entry.
  const doSend = async () => {
    if (!recipients.length) {
      setSendState('error')
      setSendError('No valid recipient. Set the invoice email address first (edit the invoice).')
      return
    }
    if (!zoho.configured) {
      setSendState('error')
      setSendError('Zoho email is not configured on the server yet.')
      return
    }
    setSendState('sending')
    setSendError('')
    try {
      // Attach only the user-uploaded files (the invoice table is embedded in
      // the email body, so no auto-generated spreadsheet is attached).
      const attachments = []
      for (const a of invoice.email?.attachments || []) {
        const b64 = String(a.dataUrl || '').split(',')[1]
        if (b64) attachments.push({ filename: a.name, content: b64 })
      }
      const subject = liveEmail.subject || `Invoice ${invoice.invoiceNo || ''}`.trim()
      const bodyText = liveEmail.body || ''
      // Inline invoice table placed before the signature (or at {invoice_table}).
      const html = composeInvoiceHtmlBody(bodyText, invoiceEmailTableHtml(invoice)) || undefined
      // Plain-text fallback: drop the token (no table in text form).
      const text = bodyText.split('{invoice_table}').join('').trim()

      await sendInvoiceReport({ to: recipients, cc: ccList, subject, text, html, attachments })
    } catch (err) {
      setSendState('error')
      setSendError(err?.message || 'Failed to send. Please try again.')
      return
    }

    // The message has left the building. Recording it — send history and the
    // audit log — happens OUTSIDE the try above: a bookkeeping failure must
    // never be reported as a delivery failure, which is exactly what used to
    // happen when a caller threw here.
    setSendState('success')
    const ts = new Date().toISOString()
    try {
      onUpdate?.({ sends: [...(invoice.sends || []), { ts, to: recipientsLabel, cc: ccList }] })
      onLogSend?.({
        to: recipientsLabel,
        cc: ccList,
        ts,
        invoiceNo: invoice.invoiceNo || '',
        amount: invoice.amount || 0,
      })
    } catch (err) {
      console.error('Invoice email was sent, but recording the send failed:', err)
    }
  }

  const closeSend = () => {
    setSendOpen(false)
    setSendState('idle')
    setSendError('')
  }

  if (!invoice) return null
  const isInvoice = Array.isArray(invoice.items) && invoice.items.length > 0
  const lastSends = invoice.sends || []

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
      {/* Zoho Mail connection status */}
      {zoho.loading ? (
        <div className="card !p-3 flex items-center gap-3 text-graphite">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p className="text-sm">Checking Zoho connection…</p>
        </div>
      ) : zoho.configured ? (
        <div className="card !p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-near-black">Connected to Zoho Mail</p>
            <p className="text-[11px] text-graphite truncate">
              Sending as {zoho.from || 'Zoho mailbox'} · SMTP
            </p>
          </div>
        </div>
      ) : (
        <div className="card !p-3 flex items-center gap-3 border-amber-200 bg-amber-50/60">
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-near-black">Zoho email not configured</p>
            <p className="text-[11px] text-graphite">Add Zoho Mail SMTP credentials to enable sending.</p>
          </div>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-charcoal text-white hover:opacity-90 transition-opacity"
          >
            <Link2 className="w-3.5 h-3.5" /> Setup guide
          </button>
        </div>
      )}

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

      {/* Report actions */}
      <div className={`grid ${canSend ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-iron hover:bg-mint-bg hover:text-wise-dark text-sm font-semibold w-full border border-shadow inline-flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" /> Preview email
        </button>
        {canSend && (
          <button
            type="button"
            onClick={() => { setSendState('idle'); setSendError(''); setSendOpen(true) }}
            className="btn-primary w-full"
          >
            <Send className="w-4 h-4" /> Send report
          </button>
        )}
      </div>

      {lastSends.length > 0 && (
        <p className="text-[11px] text-graphite text-center">
          Last sent {fmtWhen(lastSends[lastSends.length - 1].ts)} to {lastSends[lastSends.length - 1].to}
          {lastSends.length > 1 ? ` · ${lastSends.length} sends` : ''}
        </p>
      )}

      {/* Existing actions */}
      {(onUpdate || (onDuplicate && canDuplicate)) && (
        <div className={`grid ${onUpdate && onDuplicate && canDuplicate ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
          {onUpdate && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-4 py-2.5 rounded-xl bg-iron hover:bg-mint-bg hover:text-wise-dark text-sm font-semibold w-full border border-shadow inline-flex items-center justify-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Update
            </button>
          )}
          {onDuplicate && canDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(invoice)}
              className="px-4 py-2.5 rounded-xl bg-iron hover:bg-mint-bg hover:text-wise-dark text-sm font-semibold w-full border border-shadow inline-flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> Duplicate
            </button>
          )}
        </div>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="px-4 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 text-sm font-semibold w-full border border-rose-100"
        >
          Delete entry
        </button>
      )}

      {/* Preview email — exactly as it will be sent */}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Email preview" size="2xl">
        <div className="space-y-3">
          <EmailPreview
            to={liveEmail.to}
            cc={ccList}
            subject={liveEmail.subject}
            body={liveEmail.body}
            items={invoice.items}
            taxRate={invoice.taxRate}
            invoiceNo={invoice.invoiceNo}
            attachments={invoice.email?.attachments || []}
          />
          <button
            type="button"
            onClick={() => openInvoiceReport(invoice)}
            className="px-4 py-2.5 rounded-xl bg-iron hover:bg-mint-bg hover:text-wise-dark text-sm font-semibold w-full border border-shadow inline-flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
        </div>
      </Modal>

      {/* Send report — confirmation + status */}
      <Modal open={sendOpen} onClose={closeSend} title="Send invoice report">
        {sendState === 'success' ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold">Report sent</p>
            <p className="text-xs text-graphite">Sent to {recipientsLabel}{ccList.length ? ` · Cc ${ccList.length}` : ''}.</p>
            <button type="button" onClick={closeSend} className="btn-primary w-full">Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="card !p-3 space-y-1 text-sm">
              <Row label="To" value={recipientsLabel || '— none —'} />
              {ccList.length > 0 && <Row label="Cc" value={ccList.join(', ')} />}
              <Row label="Subject" value={liveEmail.subject || `Invoice ${invoice.invoiceNo || ''}`} />
              <Row label="Attachments" value={`${(invoice?.email?.attachments || []).length} file(s)`} />
            </div>
            {sendState === 'error' && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {sendError}
              </p>
            )}
            <button
              type="button"
              onClick={doSend}
              disabled={sendState === 'sending'}
              className="btn-primary w-full disabled:opacity-60"
            >
              {sendState === 'sending'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : <><Send className="w-4 h-4" /> Send now</>}
            </button>
          </div>
        )}
      </Modal>

      {/* Zoho Mail setup guide (SMTP is configured server-side, not per-user) */}
      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Enable Zoho Mail sending">
        <div className="space-y-3 text-sm">
          <p className="text-graphite">
            Invoice reports are sent through your Zoho Mail account over SMTP. An administrator
            configures this once on the server:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-near-black">
            <li>In Zoho Mail, open <span className="font-medium">Settings → Security → App Passwords</span> and generate an app-specific password.</li>
            <li>Add these to the API <span className="font-mono text-xs">.env</span> and restart:
              <pre className="mt-1 p-2 rounded-lg bg-iron text-[11px] overflow-x-auto">{`SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=you@zohomail.com
SMTP_PASS=<app-password>
SMTP_FROM=you@zohomail.com`}</pre>
            </li>
            <li>Reopen this invoice — the banner will show <span className="font-medium">Connected to Zoho Mail</span>.</li>
          </ol>
          <button type="button" onClick={() => { setSetupOpen(false); zoho.refresh() }} className="btn-primary w-full">
            <RefreshCw className="w-4 h-4" /> Re-check connection
          </button>
        </div>
      </Modal>
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
