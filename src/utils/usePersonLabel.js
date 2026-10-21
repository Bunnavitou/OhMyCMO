import { useCallback } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { memberName, memberLabel } from './tasks.js'

// What to show for a person saved on a record as an id plus a name (task
// assignee, "created by", log author). The main account shows as "Admin";
// other team members by their current name; anyone else by the stored text.
// Older records that saved only the admin's name text are matched by name.
export function usePersonLabel() {
  const { state } = useStore()
  const { t } = useT()
  const team = state.team
  return useCallback((id, stored) => {
    const admin = t('role.admin')
    const m = id ? (team || []).find((x) => x.id === id) : null
    if (m) return memberLabel(m, admin)
    const main = (team || []).find((x) => x.role === 'ADMIN')
    if (stored && main && stored === memberName(main)) return admin
    return stored || ''
  }, [team, t])
}
