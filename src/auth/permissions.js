// Owners (no ownerId) have implicit full access.
// Sub-users go by their permissions JSON.
export function hasPermission(user, key) {
  if (!user) return false
  if (!user.ownerId) return true // owner
  const p = user.permissions || {}
  return p[key] === true
}

export const PERMISSION_KEYS = [
  'customers',
  'products',
  'partners',
  'marketing',
  'assets',
  'subUsers',
]
