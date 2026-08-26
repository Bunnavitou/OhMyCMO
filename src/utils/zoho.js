// Zoho Mail integration (frontend side).
//
// Sending happens server-side over Zoho Mail SMTP; the browser just asks the
// API whether it's configured (GET /zoho/status) and posts the composed email
// (POST /zoho/send). No OAuth/token handling lives in the client.

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'

// Report whether the server can send email via Zoho, plus the "from" address.
export function useZohoStatus() {
  const [state, setState] = useState({ loading: true, configured: false, from: null })

  const fetchStatus = useCallback(async () => {
    try {
      const r = await api.get('/zoho/status')
      return { loading: false, configured: !!r.data.configured, from: r.data.from || null }
    } catch {
      return { loading: false, configured: false, from: null }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchStatus().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [fetchStatus])

  // User-triggered re-check (e.g. from the setup guide). Safe to set loading here.
  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    setState(await fetchStatus())
  }, [fetchStatus])

  return { ...state, refresh }
}

// Send an invoice report. payload: { to, cc[], subject, text, html, attachments[] }
// where each attachment is { filename, content } (base64, no data: prefix).
export async function sendInvoiceReport(payload) {
  const r = await api.post('/zoho/send', payload)
  return r.data
}

// Per-user Zoho Mail settings (More → Email settings). The app password is
// never returned once saved — the GET response only reports whether one is
// set (`hasPassword`); PUT accepts a new one but it's optional on update.
export async function getMailSettings() {
  const r = await api.get('/zoho/settings')
  return r.data
}

// payload: { host, port, user, pass?, fromName?, bcc? } or { clear: true }
export async function saveMailSettings(payload) {
  const r = await api.put('/zoho/settings', payload)
  return r.data
}

// Actually connects/authenticates (unlike /zoho/status, which just checks
// presence) — used by the Settings page's "Test connection" action. payload
// fields (host/port/user/pass) are optional overrides on top of whatever is
// already saved, so this tests the CURRENT form values even before Save —
// omit `pass` to test with the already-saved password instead of retyping it.
export async function verifyMailSettings(payload = {}) {
  const r = await api.post('/zoho/verify', payload)
  return r.data
}
