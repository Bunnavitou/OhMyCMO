import { useEffect, useState } from 'react'
import {
  Mail, Server, AtSign, KeyRound, Tag, Users2, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2, RefreshCw, Trash2,
} from 'lucide-react'
import { getMailSettings, saveMailSettings, verifyMailSettings } from '../utils/zoho.js'

const ZOHO_DEFAULTS = { host: 'smtp.zoho.com', port: 465 }

// Mail settings are per user — every team member (owner or sub-user)
// connects their own Zoho mailbox here and sends invoice reports as
// themselves. No owner-only gate.
export default function MoreMailSettings() {
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(null) // last-loaded snapshot, for the status banner
  const [host, setHost] = useState('')
  const [port, setPort] = useState(465)
  const [mailUser, setMailUser] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [fromName, setFromName] = useState('')
  const [bcc, setBcc] = useState('')
  const [hasPassword, setHasPassword] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [verifying, setVerifying] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getMailSettings()
      setSaved(data)
      setHost(data.host || ZOHO_DEFAULTS.host)
      setPort(data.port || ZOHO_DEFAULTS.port)
      setMailUser(data.user || '')
      setFromName(data.fromName || '')
      setBcc(data.bcc || '')
      setHasPassword(data.hasPassword)
      setPass('')
    } catch (err) {
      setError(err.message || 'Failed to load mail settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setOk('')
    setBusy(true)
    try {
      await saveMailSettings({
        host: host.trim(),
        port: Number(port) || 465,
        user: mailUser.trim(),
        ...(pass ? { pass } : {}),
        fromName: fromName.trim(),
        bcc: bcc.trim(),
      })
      setOk('Saved.')
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save mail settings')
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setError(''); setOk('')
    setVerifying(true)
    try {
      // Test the CURRENT form values (even unsaved) — omit pass so the
      // server falls back to the already-saved one instead of requiring it
      // to be retyped every time.
      await verifyMailSettings({
        host: host.trim(),
        port: Number(port) || 465,
        user: mailUser.trim(),
        ...(pass ? { pass } : {}),
      })
      setOk('Connected — credentials verified.')
    } catch (err) {
      setError(err.message || 'Connection test failed')
    } finally {
      setVerifying(false)
    }
  }

  const clearCustom = async () => {
    if (!confirm("Remove your Zoho account? You won't be able to send invoice reports until you connect one again.")) return
    setError(''); setOk('')
    setBusy(true)
    try {
      await saveMailSettings({ clear: true })
      setOk('Cleared.')
      await load()
    } catch (err) {
      setError(err.message || 'Failed to clear mail settings')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="card !p-3 flex items-center gap-3 text-graphite">
        <Loader2 className="w-4 h-4 animate-spin" />
        <p className="text-sm">Loading mail settings…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="card flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-mint-bg text-wise-dark flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold">Email settings</p>
          <p className="text-xs text-graphite">
            Connect your own Zoho Mail account to send invoice reports.
          </p>
        </div>
      </section>

      {saved && (
        saved.configured ? (
          <div className="card !p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-near-black">Connected to Zoho Mail</p>
              <p className="text-[11px] text-graphite truncate">Sending as {saved.user}</p>
            </div>
          </div>
        ) : (
          <div className="card !p-3 flex items-center gap-3 border-amber-200 bg-amber-50/60">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-near-black">Not connected — you can't send invoice reports yet</p>
              <p className="text-[11px] text-graphite">Fill in your Zoho Mail account below to enable sending.</p>
            </div>
          </div>
        )
      )}

      <form onSubmit={submit} className="card space-y-3">
        <Field icon={Server} label="SMTP host">
          <input className="input" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.zoho.com" required />
        </Field>

        <Field icon={Server} label="SMTP port">
          <input
            className="input" type="number" value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="465"
          />
        </Field>

        <Field icon={AtSign} label="Zoho mailbox (username)">
          <input
            className="input" type="email" value={mailUser}
            onChange={(e) => setMailUser(e.target.value)}
            placeholder="you@zohomail.com" required
          />
        </Field>

        <Field icon={KeyRound} label={hasPassword ? 'App password (leave blank to keep current)' : 'App password'}>
          <div className="relative">
            <input
              className="input pr-10" type={showPass ? 'text' : 'password'}
              value={pass} onChange={(e) => setPass(e.target.value)}
              placeholder={hasPassword ? '••••••••' : 'Generated in Zoho → Security → App Passwords'}
              autoComplete="new-password"
            />
            <button
              type="button" onClick={() => setShowPass((s) => !s)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-graphite hover:text-near-black"
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>

        <Field icon={Tag} label="From display name (optional)">
          <input className="input" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="KOSIGN" />
        </Field>

        <Field icon={Users2} label="Archive Bcc (optional)">
          <input className="input" type="email" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="archive@yourcompany.com" />
        </Field>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </p>
        )}
        {ok && (
          <p className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{ok}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button type="submit" disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button" onClick={test} disabled={verifying || !host.trim() || !mailUser.trim() || (!pass && !hasPassword)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-shadow font-semibold py-2.5 px-4 text-sm disabled:opacity-50"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Test connection
          </button>
        </div>
      </form>

      {saved?.hasPassword && (
        <button
          type="button" onClick={clearCustom} disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full text-rose-600 hover:bg-rose-50 font-semibold py-2.5 text-sm border border-rose-100 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" /> Remove this account
        </button>
      )}

      <p className="text-[11px] text-graphite text-center">
        In Zoho Mail, generate an app-specific password under Settings → Security → App Passwords —
        don't use your regular login password.
      </p>
    </div>
  )
}

function Field({ icon: Icon, label, children }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-graphite font-semibold">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      {children}
    </div>
  )
}
