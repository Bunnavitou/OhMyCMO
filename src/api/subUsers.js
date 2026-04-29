import { useCallback, useEffect, useState } from 'react'
import { api } from './client.js'

export function useSubUsers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/sub-users')
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

  const create = useCallback(async (payload) => {
    const res = await api.post('/sub-users', payload)
    setItems((cur) => [res.data.subUser, ...cur])
    return res.data.subUser
  }, [])

  const update = useCallback(async (id, patch) => {
    const res = await api.patch(`/sub-users/${id}`, patch)
    setItems((cur) => cur.map((u) => (u.id === id ? res.data.subUser : u)))
    return res.data.subUser
  }, [])

  const remove = useCallback(async (id) => {
    await api.delete(`/sub-users/${id}`)
    setItems((cur) => cur.filter((u) => u.id !== id))
  }, [])

  return { items, loading, error, refresh, create, update, remove }
}
