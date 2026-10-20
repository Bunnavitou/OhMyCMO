// Menu access (opt-in): a sub-user sees a menu only if its key is true.
export const PERMISSION_KEYS = [
  'tasks',
  'customers',
  'sales',
  'products',
  'partners',
  'marketing',
  'assets',
  'reports',
  'subUsers',
]

// Owners (no ownerId) have implicit full access. For sub-users:
//  - menu keys are opt-in  → allowed only when explicitly true
//  - any other key is a per-menu ACTION ability, opt-OUT → allowed unless
//    explicitly set to false (e.g. 'billing.send', 'customers.delete').
// Abilities that widen what a sub-user can do to other people's work are
// opt-IN instead: off until the owner turns them on, so adding one never
// grants it to existing sub-users. Must match the API's utils/tenant.js.
export const OPT_IN_ABILITIES = ['sales.assign']

export function hasPermission(user, key) {
  if (!user) return false
  if (!user.ownerId) return true // owner
  const p = user.permissions || {}
  if (PERMISSION_KEYS.includes(key) || OPT_IN_ABILITIES.includes(key)) return p[key] === true
  return p[key] !== false
}
