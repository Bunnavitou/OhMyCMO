// Menu access (opt-in): a sub-user sees a menu only if its key is true.
export const PERMISSION_KEYS = [
  'customers',
  'products',
  'partners',
  'marketing',
  'assets',
  'subUsers',
]

// Owners (no ownerId) have implicit full access. For sub-users:
//  - menu keys are opt-in  → allowed only when explicitly true
//  - any other key is a per-menu ACTION ability, opt-OUT → allowed unless
//    explicitly set to false (e.g. 'billing.send', 'customers.delete').
export function hasPermission(user, key) {
  if (!user) return false
  if (!user.ownerId) return true // owner
  const p = user.permissions || {}
  if (PERMISSION_KEYS.includes(key)) return p[key] === true
  return p[key] !== false
}
