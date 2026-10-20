import { useMemo } from 'react'
import { useLoader } from './sales.js'

// Worst first — the order statuses are listed in.
export const HEALTH_ORDER = ['red', 'amber', 'green']

// Check-in rhythms a customer can have (Customer.careCadence).
export const CARE_CADENCES = ['monthly', 'quarterly']

// Customer health (green / amber / red) for every Active or On hold
// customer, computed by the API from tasks, sales, product threads and
// invoices. `byId` maps customerId → that customer's health.
export const useCustomerHealth = () => {
  const r = useLoader('/customers/health')
  const byId = useMemo(() => new Map((r.data?.items || []).map((h) => [h.customerId, h])), [r.data])
  return { ...r, byId, thresholds: r.data?.thresholds }
}

// Check-ins for the Weekly Plan: `items` due in from..to (plus overdue ones),
// `done` logged in from..to; `userId` = one person's.
export const useCheckins = ({ from, to, userId }) => {
  const q = new URLSearchParams({ from, to, ...(userId ? { userId } : {}) })
  const r = useLoader(`/customers/checkins?${q}`)
  return { ...r, items: r.data?.items || [], done: r.data?.done || [] }
}
