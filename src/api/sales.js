import { useCallback, useEffect, useState } from 'react'
import { api } from './client.js'

// Sales are loaded per screen (one page of the table, one week, one
// customer), not kept in the global store — the set grows every day and is
// only needed where it is shown.

// `loading` is true until the response for the current path + refresh count
// arrives; the previous data stays on screen meanwhile so lists don't flash.
export function useLoader(path) {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState({ key: null, data: null, error: null })
  const key = `${path}#${version}`

  useEffect(() => {
    let live = true
    api.get(path).then(
      (res) => live && setResult({ key, data: res.data, error: null }),
      (err) => live && setResult((r) => ({ ...r, key, error: err })),
    )
    return () => { live = false }
  }, [path, key])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return { data: result.data, error: result.error, loading: result.key !== key, refresh }
}

const qs = (params) => {
  const p = Object.entries(params).filter(([, v]) => v)
  return p.length ? `?${new URLSearchParams(p)}` : ''
}

export const useSales = (filters) => {
  const r = useLoader(`/sales${qs(filters)}`)
  return { ...r, items: r.data?.items || [], total: r.data?.total || 0 }
}

export const useFollowups = ({ userId } = {}) => {
  const r = useLoader(`/sales/followups${qs({ userId })}`)
  return { ...r, groups: r.data || { overdue: [], today: [], upcoming: [] } }
}

// Dashboard cards (sales by status) and deals won by 'YYYY-MM'.
export const useDashboard = ({ userId, customerId, from, to }) => {
  const r = useLoader(`/sales/dashboard${qs({ userId, customerId, from, to })}`)
  return { ...r, totals: r.data?.totals || null, wonByMonth: r.data?.wonByMonth || {} }
}

// Activities due in a date range, each with its sale — the week calendar.
export const useCalendar = ({ from, to, userId }) => {
  const r = useLoader(`/sales/activities${qs({ from, to, userId })}`)
  return { ...r, items: r.data?.items || [] }
}

// Calls throw so forms can show the API's validation message. Writes return
// { sale }; win / convertPartner also return conversion: { customer, partner }.
export const saleApi = {
  get: (id) => api.get(`/sales/${id}`).then((r) => r.data.sale),
  create: (body) => api.post('/sales', body).then((r) => r.data),
  update: (id, body) => api.patch(`/sales/${id}`, body).then((r) => r.data),
  updateActivity: (id, body) => api.patch(`/sales/activities/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/sales/${id}`),
  // A prospect's sale is won: creates (or uses) the customer with `details`.
  win: (id, details) => api.post(`/sales/${id}/win`, details).then((r) => r.data),
  // Business card → customer, without a sale.
  convertPartner: (partnerId, details) => api.post(`/partners/${partnerId}/convert`, details).then((r) => r.data),
}
