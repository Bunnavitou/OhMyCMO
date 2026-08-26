// Menu access (opt-in): a sub-user sees a menu only if its key is true.
export const PERMISSION_KEYS = [
  'tasks',
  'customers',
  'products',
  'partners',
  'marketing',
  'assets',
  'reports',
  'subUsers',
  // Opt-in like the menu keys above, not the default-allow abilities below —
  // the PMO menu is visible to everyone, but promoting/demoting a PMO,
  // reassigning a product's PMO owner, and editing a PMO's tasks are
  // sensitive enough that a sub-user must be explicitly granted this.
  'pmo.manage',
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
