import { useMemo, useState } from 'react'
import { Mail, Save, RotateCcw } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { CcEditor } from '../components/Invoice.jsx'
import { isEmail, applyPlaceholders } from '../utils/email.js'

// Per-customer email settings for task update mails. Stored on the customer as
// `taskEmail: { to, cc, subject, body }` and pre-filled with a default template.
const DEFAULT_SUBJECT = 'Update on your {task_name}'
const DEFAULT_BODY =
  'Dear {customer_name},\n\nHere is the latest update on {task_name}.\n\nBest regards,'

// Snapshot the saved state (or defaults) so Save/Cancel have a baseline.
const snapshotFrom = (customer) => ({
  to: customer.taskEmail?.to || customer.email || '',
  cc: Array.isArray(customer.taskEmail?.cc) ? customer.taskEmail.cc : [],
  subject: customer.taskEmail?.subject || DEFAULT_SUBJECT,
  body: customer.taskEmail?.body || DEFAULT_BODY,
})

export default function CustomerDetailEmail({ customer }) {
  const { updateCustomer } = useStore()
  const { t } = useT()

  const saved = useMemo(() => snapshotFrom(customer), [customer])
  const [to, setTo] = useState(saved.to)
  const [cc, setCc] = useState(saved.cc)
  const [subject, setSubject] = useState(saved.subject)
  const [body, setBody] = useState(saved.body)
  const [savedFlash, setSavedFlash] = useState(false)

  // Placeholders resolved for the live preview.
  const ctx = useMemo(
    () => ({
      task_name: customer.name || '',
      customer_name: customer.contact || customer.name || '',
      company_name: customer.name || '',
    }),
    [customer.name, customer.contact],
  )

  const dirty =
    to !== saved.to ||
    subject !== saved.subject ||
    body !== saved.body ||
    JSON.stringify(cc) !== JSON.stringify(saved.cc)

  const toValid = isEmail(to)
  const canSave = dirty && toValid

  const reset = () => {
    setTo(saved.to)
    setCc(saved.cc)
    setSubject(saved.subject)
    setBody(saved.body)
  }

  const save = () => {
    if (!canSave) return
    updateCustomer(customer.id, {
      taskEmail: {
        to: to.trim(),
        cc: cc.map((s) => s.trim()).filter(isEmail),
        subject,
        body,
      },
    })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="card !p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-mint-bg text-wise-dark flex items-center justify-center shrink-0">
          <Mail className="w-4 h-4" />
        </div>
        <p className="text-xs text-graphite">{t('customer.email.intro')}</p>
      </div>

      <div>
        <label className="label">{t('customer.email.to')} *</label>
        <input
          className="input"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="customer@company.com"
        />
        {to.trim() && !toValid && (
          <p className="text-xs text-red-600 mt-1">{t('customer.email.invalid')}</p>
        )}
      </div>

      <div>
        <label className="label">{t('customer.email.cc')}</label>
        <CcEditor value={cc} onChange={setCc} />
      </div>

      <div>
        <label className="label">{t('customer.email.subject')}</label>
        <input
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={DEFAULT_SUBJECT}
        />
      </div>

      <div>
        <label className="label">{t('customer.email.body')}</label>
        <textarea
          className="input min-h-[130px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={DEFAULT_BODY}
        />
        <p className="text-xs text-graphite mt-1">
          {t('customer.email.placeholders')}: {'{task_name}'}, {'{customer_name}'}, {'{company_name}'}
        </p>
        <p className="text-xs text-graphite mt-0.5">
          Tip: put <span className="font-mono">{'{invoice_table}'}</span> where you want the invoice
          table to appear in invoice emails (e.g. just before “Best regards,”).
        </p>
      </div>

      {(subject.includes('{') || body.includes('{')) && (
        <div className="rounded-lg bg-iron/60 px-3 py-2">
          <p className="text-xs font-medium text-graphite mb-1">{t('customer.email.preview')}</p>
          <p className="text-sm font-medium">{applyPlaceholders(subject, ctx)}</p>
          <p className="text-sm whitespace-pre-wrap mt-1">{applyPlaceholders(body, ctx)}</p>
        </div>
      )}

      {savedFlash && (
        <p className="text-xs text-emerald-700 text-center">{t('customer.email.saved')}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="btn-primary w-full disabled:opacity-40"
        >
          <Save className="w-4 h-4" /> {t('common.save')}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!dirty}
          className="px-4 py-2.5 rounded-xl bg-iron hover:bg-mint-bg hover:text-wise-dark text-sm font-semibold w-full border border-shadow inline-flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <RotateCcw className="w-4 h-4" /> {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
