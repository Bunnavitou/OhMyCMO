// Shared email helpers used by the invoice email section and the customer
// Email tab. Kept in a plain module so components can import them without
// tripping react-refresh's "only export components" rule.

export const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isEmail = (s) => EMAIL_RE.test(String(s || '').trim())

// Normalize a recipient value (an array, or a comma/semicolon/whitespace
// -separated string) into an array of trimmed, non-empty address strings.
// Used so the "To" field can hold multiple recipients just like "Cc".
export const parseRecipients = (v) => {
  if (Array.isArray(v)) return v.map((s) => String(s || '').trim()).filter(Boolean)
  return String(v || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Only the valid email addresses from a recipient value.
export const validRecipients = (v) => parseRecipients(v).filter(isEmail)

// Human-readable "a@x.com, b@y.com" string for a recipient value.
export const recipientsText = (v) => parseRecipients(v).join(', ')

// Replace {token} placeholders from a context map; unknown tokens are left as-is.
export const applyPlaceholders = (text, ctx) =>
  String(text ?? '').replace(/\{(\w+)\}/g, (m, k) => (ctx[k] != null ? String(ctx[k]) : m))
