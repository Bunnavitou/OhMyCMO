// Shared email helpers used by the invoice email section and the customer
// Email tab. Kept in a plain module so components can import them without
// tripping react-refresh's "only export components" rule.

export const fmtMoney = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isEmail = (s) => EMAIL_RE.test(String(s || '').trim())

// Replace {token} placeholders from a context map; unknown tokens are left as-is.
export const applyPlaceholders = (text, ctx) =>
  String(text ?? '').replace(/\{(\w+)\}/g, (m, k) => (ctx[k] != null ? String(ctx[k]) : m))
