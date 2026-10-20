import { useMemo } from 'react'
import { useLoader } from './sales.js'

// Worst first — the order statuses are listed in.
export const HEALTH_ORDER = ['red', 'amber', 'green']

// Customer health (green / amber / red) for every Active or On hold
// customer, computed by the API from tasks, sales, product threads and
// invoices. `byId` maps customerId → that customer's health.
export const useCustomerHealth = () => {
  const r = useLoader('/customers/health')
  const byId = useMemo(() => new Map((r.data?.items || []).map((h) => [h.customerId, h])), [r.data])
  return { ...r, byId, thresholds: r.data?.thresholds }
}
