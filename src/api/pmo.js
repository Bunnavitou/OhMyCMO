import { useCallback, useEffect, useState } from 'react'
import { api } from './client.js'

// Unlike useSubUsers (gated behind the 'subUsers' account-management
// permission), /pmo is readable by every tenant member — the PMO menu has
// no visibility gate. Only `update` (promote/demote, edit tasks/log) is
// permission-checked, server-side via 'pmo.manage'.
export function usePmos() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/pmo')
      setItems(res.data.items)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const update = useCallback(async (id, patch) => {
    const res = await api.patch(`/pmo/${id}`, patch)
    const next = res.data.pmo
    setItems((cur) => {
      if (!next.isPmo) return cur.filter((p) => p.id !== id) // demoted → drop
      const exists = cur.some((p) => p.id === id)
      return exists ? cur.map((p) => (p.id === id ? next : p)) : [next, ...cur] // promoted → add
    })
    return next
  }, [])

  return { items, loading, error, refresh, update }
}
