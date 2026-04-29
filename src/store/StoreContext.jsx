// API-backed CRM store.
//
// Bootstrap: after auth, fetches all entities from the backend in parallel.
// Reads: synchronous, from `state` (same shape as before).
// Mutations: optimistic local update + write-through to the API.
//   - On API failure we log it; pages do not see throws to keep call sites simple.
//   - For audit-loggable nested mutations (tasks/files/product links/...),
//     the frontend POSTs the log entry alongside the entity PATCH so the
//     timeline matches what the old localStorage version produced.
//
// Every page that previously called useStore() keeps working — the function
// names and state shape are intentionally identical to the old store.

import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'

const StoreContext = createContext(null)

const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const EMPTY_STATE = {
  customers: [],
  products: [],
  partners: [],
  campaigns: [],
  assets: [],
  // subUsers are managed separately via /api/sub-users; keep an empty list
  // here so legacy reads of state.subUsers don't crash.
  subUsers: [],
}

export function StoreProvider({ children }) {
  const { status } = useAuth()
  const [state, setState] = useState(EMPTY_STATE)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [bootstrapError, setBootstrapError] = useState(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Bootstrap from the backend whenever the user becomes authenticated.
  useEffect(() => {
    if (status !== 'authed') {
      setBootstrapped(false)
      setState(EMPTY_STATE)
      return
    }
    let cancelled = false
    setBootstrapError(null)
    Promise.all([
      api.get('/customers'),
      api.get('/products'),
      api.get('/partners'),
      api.get('/campaigns'),
      api.get('/assets'),
    ])
      .then(([cust, prod, part, camp, ass]) => {
        if (cancelled) return
        setState({
          customers: cust.data.items,
          products: prod.data.items,
          partners: part.data.items,
          campaigns: camp.data.items,
          assets: ass.data.items,
          subUsers: [],
        })
        setBootstrapped(true)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[store] bootstrap failed', err)
        setBootstrapError(err)
        setBootstrapped(true)
      })
    return () => {
      cancelled = true
    }
  }, [status])

  const api2 = useMemo(() => {
    // Helpers ────────────────────────────────────────────────────────────
    const getCustomer = (id) => stateRef.current.customers.find((c) => c.id === id)
    const getProduct = (id) => stateRef.current.products.find((p) => p.id === id)

    // Replace one entity in a collection.
    const replaceIn = (key, item) =>
      setState((s) => ({
        ...s,
        [key]: s[key].map((x) => (x.id === item.id ? item : x)),
      }))

    const prependTo = (key, item) =>
      setState((s) => ({ ...s, [key]: [item, ...s[key]] }))

    const removeFrom = (key, id) =>
      setState((s) => ({ ...s, [key]: s[key].filter((x) => x.id !== id) }))

    // Generic safe API runner — logs failures instead of throwing through.
    const run = async (fn) => {
      try {
        return await fn()
      } catch (err) {
        console.error('[store]', err)
      }
    }

    // PATCH a customer with the given partial body and replace the row in
    // local state. Optionally append an audit log entry alongside.
    const patchCustomer = (id, body, log) =>
      run(async () => {
        const res = await api.patch(`/customers/${id}`, body)
        let customer = res.data.customer
        if (log) {
          const r2 = await api.post(`/customers/${id}/logs`, log)
          customer = { ...customer, logs: [r2.data.log, ...(customer.logs || [])] }
        }
        replaceIn('customers', customer)
        return customer
      })

    // ────────────────────────────────────────────────────────────────────

    return {
      state,
      bootstrapped,
      bootstrapError,
      // Kept for parity; clients used to call this to nuke localStorage.
      // Now it just refetches from server.
      resetAll: () => setBootstrapped(false),

      // ── Customers
      addCustomer: (data) =>
        run(async () => {
          const res = await api.post('/customers', data)
          prependTo('customers', res.data.customer)
        }),

      updateCustomer: (id, patch) => patchCustomer(id, patch),

      removeCustomer: (id) =>
        run(async () => {
          await api.delete(`/customers/${id}`)
          removeFrom('customers', id)
        }),

      // Manual audit log entry (used by "Log activity")
      appendCustomerLog: (id, entry) =>
        run(async () => {
          const res = await api.post(`/customers/${id}/logs`, entry)
          setState((s) => ({
            ...s,
            customers: s.customers.map((c) =>
              c.id === id ? { ...c, logs: [res.data.log, ...(c.logs || [])] } : c,
            ),
          }))
        }),

      // ── Customer files (metadata array on customer; bytes uploaded separately)
      addCustomerFile: (id, file) => {
        const c = getCustomer(id)
        if (!c) return
        const f = {
          id: file.id || uid('f'),
          uploadedAt: new Date().toISOString(),
          description: '',
          ...file,
        }
        return patchCustomer(
          id,
          { files: [f, ...(c.files || [])] },
          { type: 'file.upload', message: `Uploaded "${f.name}"`, meta: { fileId: f.id, size: f.size, type: f.type || f.mimeType } },
        )
      },
      removeCustomerFile: (id, fileId) => {
        const c = getCustomer(id)
        if (!c) return
        const f = (c.files || []).find((x) => x.id === fileId)
        return patchCustomer(
          id,
          { files: (c.files || []).filter((x) => x.id !== fileId) },
          { type: 'file.delete', message: `Deleted "${f?.name || ''}"`, meta: { fileId } },
        )
      },

      // ── Customer ↔ Product link
      addCustomerProductLink: (customerId, productId) => {
        const c = getCustomer(customerId)
        const p = getProduct(productId)
        if (!c) return
        const link = { id: uid('pl'), productId, linkedAt: new Date().toISOString(), activities: [] }
        return patchCustomer(
          customerId,
          { productLinks: [...(c.productLinks || []), link] },
          { type: 'product.link', message: `Started product history: "${p?.name || productId}"`, meta: { linkId: link.id, productId } },
        )
      },
      removeCustomerProductLink: (customerId, linkId) => {
        const c = getCustomer(customerId)
        if (!c) return
        const link = (c.productLinks || []).find((l) => l.id === linkId)
        const p = link ? getProduct(link.productId) : null
        return patchCustomer(
          customerId,
          { productLinks: (c.productLinks || []).filter((l) => l.id !== linkId) },
          { type: 'product.unlink', message: `Unlinked product "${p?.name || link?.productId || ''}"`, meta: { linkId, productId: link?.productId } },
        )
      },

      // ── Customer ↔ Product activity thread
      addCustomerProductActivity: (customerId, linkId, entry) => {
        const c = getCustomer(customerId)
        if (!c) return
        const newEntry = {
          id: uid('act'),
          ts: new Date().toISOString(),
          side: 'mine',
          type: 'text',
          ...entry,
        }
        const productLinks = (c.productLinks || []).map((l) =>
          l.id === linkId ? { ...l, activities: [...(l.activities || []), newEntry] } : l,
        )
        return patchCustomer(customerId, { productLinks })
      },
      updateCustomerProductActivity: (customerId, linkId, entryId, patch) => {
        const c = getCustomer(customerId)
        if (!c) return
        const productLinks = (c.productLinks || []).map((l) =>
          l.id === linkId
            ? {
                ...l,
                activities: (l.activities || []).map((a) =>
                  a.id === entryId ? { ...a, ...patch } : a,
                ),
              }
            : l,
        )
        return patchCustomer(customerId, { productLinks })
      },
      removeCustomerProductActivity: (customerId, linkId, entryId) => {
        const c = getCustomer(customerId)
        if (!c) return
        const productLinks = (c.productLinks || []).map((l) =>
          l.id === linkId
            ? { ...l, activities: (l.activities || []).filter((a) => a.id !== entryId) }
            : l,
        )
        return patchCustomer(customerId, { productLinks })
      },

      // ── Customer income / expense (writes to product.income, tagged with customerId)
      addCustomerProductIncome: (customerId, productId, entry) =>
        run(async () => {
          const c = getCustomer(customerId)
          const p = getProduct(productId)
          if (!p) return
          const income = {
            id: uid('i'),
            date: new Date().toISOString().slice(0, 10),
            amount: 0,
            source: c?.name || '',
            note: '',
            ...entry,
            customerId,
          }
          const res = await api.patch(`/products/${productId}`, {
            income: [income, ...(p.income || [])],
          })
          replaceIn('products', res.data.product)
          await api.post(`/customers/${customerId}/logs`, {
            type: 'product.income',
            message: `Recorded income $${Number(income.amount).toLocaleString()} on "${p.name}"`,
            meta: { productId, incomeId: income.id, amount: income.amount },
          }).then((r) => {
            setState((s) => ({
              ...s,
              customers: s.customers.map((cu) =>
                cu.id === customerId ? { ...cu, logs: [r.data.log, ...(cu.logs || [])] } : cu,
              ),
            }))
          })
        }),
      removeCustomerProductIncome: (customerId, productId, incomeId) =>
        run(async () => {
          const p = getProduct(productId)
          if (!p) return
          const entry = (p.income || []).find((i) => i.id === incomeId)
          const res = await api.patch(`/products/${productId}`, {
            income: (p.income || []).filter((i) => i.id !== incomeId),
          })
          replaceIn('products', res.data.product)
          await api.post(`/customers/${customerId}/logs`, {
            type: 'product.income.delete',
            message: `Deleted income $${Number(entry?.amount || 0).toLocaleString()} on "${p.name}"`,
            meta: { productId, incomeId },
          }).then((r) => {
            setState((s) => ({
              ...s,
              customers: s.customers.map((cu) =>
                cu.id === customerId ? { ...cu, logs: [r.data.log, ...(cu.logs || [])] } : cu,
              ),
            }))
          })
        }),
      addCustomerProductExpense: (customerId, productId, entry) =>
        run(async () => {
          const p = getProduct(productId)
          if (!p) return
          const expense = {
            id: uid('e'),
            date: new Date().toISOString().slice(0, 10),
            amount: 0,
            category: 'Other',
            note: '',
            ...entry,
            customerId,
          }
          const res = await api.patch(`/products/${productId}`, {
            expenses: [expense, ...(p.expenses || [])],
          })
          replaceIn('products', res.data.product)
          await api.post(`/customers/${customerId}/logs`, {
            type: 'product.expense',
            message: `Recorded expense $${Number(expense.amount).toLocaleString()} on "${p.name}"`,
            meta: { productId, expenseId: expense.id, amount: expense.amount },
          }).then((r) => {
            setState((s) => ({
              ...s,
              customers: s.customers.map((cu) =>
                cu.id === customerId ? { ...cu, logs: [r.data.log, ...(cu.logs || [])] } : cu,
              ),
            }))
          })
        }),
      removeCustomerProductExpense: (customerId, productId, expenseId) =>
        run(async () => {
          const p = getProduct(productId)
          if (!p) return
          const entry = (p.expenses || []).find((e) => e.id === expenseId)
          const res = await api.patch(`/products/${productId}`, {
            expenses: (p.expenses || []).filter((e) => e.id !== expenseId),
          })
          replaceIn('products', res.data.product)
          await api.post(`/customers/${customerId}/logs`, {
            type: 'product.expense.delete',
            message: `Deleted expense $${Number(entry?.amount || 0).toLocaleString()} on "${p.name}"`,
            meta: { productId, expenseId },
          }).then((r) => {
            setState((s) => ({
              ...s,
              customers: s.customers.map((cu) =>
                cu.id === customerId ? { ...cu, logs: [r.data.log, ...(cu.logs || [])] } : cu,
              ),
            }))
          })
        }),

      // ── Customer task groups
      addCustomerTaskGroup: (id, name) => {
        const c = getCustomer(id)
        if (!c) return
        const g = { id: uid('tg'), name }
        return patchCustomer(
          id,
          { taskGroups: [...(c.taskGroups || []), g] },
          { type: 'group.create', message: `Created task group "${name}"`, meta: { groupId: g.id } },
        )
      },
      renameCustomerTaskGroup: (id, groupId, name) => {
        const c = getCustomer(id)
        if (!c) return
        const before = (c.taskGroups || []).find((g) => g.id === groupId)
        if (!before || before.name === name) return
        return patchCustomer(
          id,
          {
            taskGroups: (c.taskGroups || []).map((g) =>
              g.id === groupId ? { ...g, name } : g,
            ),
          },
          {
            type: 'group.rename',
            message: `Renamed group "${before.name}" → "${name}"`,
            meta: { groupId, before: before.name, after: name },
          },
        )
      },
      removeCustomerTaskGroup: (id, groupId) => {
        const c = getCustomer(id)
        if (!c) return
        const removed = (c.taskGroups || []).find((g) => g.id === groupId)
        return patchCustomer(
          id,
          {
            taskGroups: (c.taskGroups || []).filter((g) => g.id !== groupId),
            tasks: (c.tasks || []).map((t) => (t.groupId === groupId ? { ...t, groupId: null } : t)),
          },
          { type: 'group.delete', message: `Deleted group "${removed?.name || ''}"`, meta: { groupId } },
        )
      },

      // ── Customer tasks
      addCustomerTask: (id, task) => {
        const c = getCustomer(id)
        if (!c) return
        const newTask = {
          id: uid('t'),
          name: '',
          registerDate: new Date().toISOString().slice(0, 10),
          description: '',
          status: 'Todo',
          file: null,
          due: '',
          assignee: '',
          groupId: null,
          ...task,
        }
        return patchCustomer(
          id,
          { tasks: [newTask, ...(c.tasks || [])] },
          {
            type: 'task.create',
            message: `Created task "${newTask.name}"`,
            meta: { taskId: newTask.id, status: newTask.status, assignee: newTask.assignee },
          },
        )
      },
      updateCustomerTask: (id, taskId, patch) => {
        const c = getCustomer(id)
        if (!c) return
        const before = (c.tasks || []).find((t) => t.id === taskId)
        if (!before) return
        const after = { ...before, ...patch }
        const changed = Object.keys(patch).filter(
          (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
        )
        if (changed.length === 0) return
        let type = 'task.update'
        let message
        if (changed.length === 1 && changed[0] === 'status') {
          type = 'task.status'
          message = `Task "${after.name}": ${before.status} → ${after.status}`
        } else {
          message = `Updated task "${after.name}" (${changed.join(', ')})`
        }
        return patchCustomer(
          id,
          { tasks: (c.tasks || []).map((t) => (t.id === taskId ? after : t)) },
          { type, message, meta: { taskId, changed } },
        )
      },
      removeCustomerTask: (id, taskId) => {
        const c = getCustomer(id)
        if (!c) return
        const removed = (c.tasks || []).find((t) => t.id === taskId)
        return patchCustomer(
          id,
          { tasks: (c.tasks || []).filter((t) => t.id !== taskId) },
          { type: 'task.delete', message: `Deleted task "${removed?.name || 'Untitled'}"`, meta: { taskId } },
        )
      },

      // ── Customer staff
      addCustomerStaff: (id, staff) => {
        const c = getCustomer(id)
        if (!c) return
        const s = {
          id: uid('s'),
          name: '', role: '', department: '', email: '', phone: '', reportsTo: null,
          ...staff,
        }
        return patchCustomer(
          id,
          { staff: [...(c.staff || []), s] },
          { type: 'staff.create', message: `Added staff "${s.name}"`, meta: { staffId: s.id } },
        )
      },
      updateCustomerStaff: (id, staffId, patch) => {
        const c = getCustomer(id)
        if (!c) return
        const before = (c.staff || []).find((s) => s.id === staffId)
        if (!before) return
        const after = { ...before, ...patch }
        const changed = Object.keys(patch).filter(
          (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
        )
        if (changed.length === 0) return
        return patchCustomer(
          id,
          { staff: (c.staff || []).map((s) => (s.id === staffId ? after : s)) },
          { type: 'staff.update', message: `Updated staff "${after.name}" (${changed.join(', ')})`, meta: { staffId, changed } },
        )
      },
      removeCustomerStaff: (id, staffId) => {
        const c = getCustomer(id)
        if (!c) return
        const removed = (c.staff || []).find((s) => s.id === staffId)
        return patchCustomer(
          id,
          {
            staff: (c.staff || [])
              .filter((s) => s.id !== staffId)
              .map((s) => (s.reportsTo === staffId ? { ...s, reportsTo: null } : s)),
          },
          { type: 'staff.delete', message: `Removed staff "${removed?.name || ''}"`, meta: { staffId } },
        )
      },

      // ── Products
      addProduct: (data) =>
        run(async () => {
          const body = { type: 'Service', price: 0, ...data }
          const res = await api.post('/products', body)
          prependTo('products', res.data.product)
        }),
      updateProduct: (id, patch) =>
        run(async () => {
          const res = await api.patch(`/products/${id}`, patch)
          replaceIn('products', res.data.product)
        }),
      removeProduct: (id) =>
        run(async () => {
          await api.delete(`/products/${id}`)
          removeFrom('products', id)
        }),
      addProductChild: (id, field, item) =>
        run(async () => {
          const p = getProduct(id)
          if (!p) return
          const newItem = { id: uid(field[0]), ...item }
          const res = await api.patch(`/products/${id}`, {
            [field]: [newItem, ...(p[field] || [])],
          })
          replaceIn('products', res.data.product)
        }),
      removeProductChild: (id, field, entryId) =>
        run(async () => {
          const p = getProduct(id)
          if (!p) return
          const res = await api.patch(`/products/${id}`, {
            [field]: (p[field] || []).filter((x) => x.id !== entryId),
          })
          replaceIn('products', res.data.product)
        }),

      // ── Partners
      addPartner: (data) =>
        run(async () => {
          const res = await api.post('/partners', data)
          prependTo('partners', res.data.partner)
        }),
      updatePartner: (id, patch) =>
        run(async () => {
          const res = await api.patch(`/partners/${id}`, patch)
          replaceIn('partners', res.data.partner)
        }),
      removePartner: (id) =>
        run(async () => {
          await api.delete(`/partners/${id}`)
          removeFrom('partners', id)
        }),
      addPartnerChild: (id, field, item) =>
        run(async () => {
          const p = stateRef.current.partners.find((x) => x.id === id)
          if (!p) return
          const newItem = { id: uid(field[0]), ...item }
          const res = await api.patch(`/partners/${id}`, {
            [field]: [newItem, ...(p[field] || [])],
          })
          replaceIn('partners', res.data.partner)
        }),
      togglePartnerTask: (id, taskId) =>
        run(async () => {
          const p = stateRef.current.partners.find((x) => x.id === id)
          if (!p) return
          const tasks = (p.tasks || []).map((t) =>
            t.id === taskId ? { ...t, done: !t.done } : t,
          )
          const res = await api.patch(`/partners/${id}`, { tasks })
          replaceIn('partners', res.data.partner)
        }),
      addPartnerTask: (id, task) =>
        run(async () => {
          const p = stateRef.current.partners.find((x) => x.id === id)
          if (!p) return
          const newTask = {
            id: uid('pt'),
            name: '', setDate: new Date().toISOString().slice(0, 10),
            description: '', expense: 0, file: null, due: '', done: false,
            ...task,
          }
          const res = await api.patch(`/partners/${id}`, {
            tasks: [newTask, ...(p.tasks || [])],
          })
          replaceIn('partners', res.data.partner)
        }),
      updatePartnerTask: (id, taskId, patch) =>
        run(async () => {
          const p = stateRef.current.partners.find((x) => x.id === id)
          if (!p) return
          const tasks = (p.tasks || []).map((t) =>
            t.id === taskId ? { ...t, ...patch } : t,
          )
          const res = await api.patch(`/partners/${id}`, { tasks })
          replaceIn('partners', res.data.partner)
        }),
      removePartnerTask: (id, taskId) =>
        run(async () => {
          const p = stateRef.current.partners.find((x) => x.id === id)
          if (!p) return
          const tasks = (p.tasks || []).filter((t) => t.id !== taskId)
          const res = await api.patch(`/partners/${id}`, { tasks })
          replaceIn('partners', res.data.partner)
        }),

      // ── Assets
      addAsset: (data) =>
        run(async () => {
          const body = { status: 'In use', ...data }
          const res = await api.post('/assets', body)
          prependTo('assets', res.data.asset)
        }),
      updateAsset: (id, patch) =>
        run(async () => {
          const res = await api.patch(`/assets/${id}`, patch)
          replaceIn('assets', res.data.asset)
        }),
      removeAsset: (id) =>
        run(async () => {
          await api.delete(`/assets/${id}`)
          removeFrom('assets', id)
        }),

      // ── Sub-users — managed via /api/sub-users (see useSubUsers).
      // These no-ops keep any stragglers from crashing.
      addSubUser: () => {},
      updateSubUser: () => {},
      removeSubUser: () => {},

      // ── Marketing campaigns
      addCampaign: (data) =>
        run(async () => {
          const body = { name: '', description: '', status: 'Planning', todos: [], ...data }
          const res = await api.post('/campaigns', body)
          prependTo('campaigns', res.data.campaign)
        }),
      updateCampaign: (id, patch) =>
        run(async () => {
          const res = await api.patch(`/campaigns/${id}`, patch)
          replaceIn('campaigns', res.data.campaign)
        }),
      removeCampaign: (id) =>
        run(async () => {
          await api.delete(`/campaigns/${id}`)
          removeFrom('campaigns', id)
        }),
      addCampaignTodo: (campaignId, todo) =>
        run(async () => {
          const c = stateRef.current.campaigns.find((x) => x.id === campaignId)
          if (!c) return
          const newTodo = {
            id: uid('cmt'),
            postDate: '', concept: '', type: 'Image', channel: '',
            keyFeature: '', caption: '', artwork: null, postStatus: 'draft',
            ...todo,
          }
          const res = await api.patch(`/campaigns/${campaignId}`, {
            todos: [newTodo, ...(c.todos || [])],
          })
          replaceIn('campaigns', res.data.campaign)
        }),
      replaceCampaignTodos: (campaignId, todos) =>
        run(async () => {
          const normalized = (todos || []).map((t) => ({
            id: t.id || uid('cmt'),
            postDate: '', concept: '', type: 'Image', channel: '',
            keyFeature: '', caption: '', artwork: null, postStatus: 'draft',
            ...t,
          }))
          const res = await api.patch(`/campaigns/${campaignId}`, { todos: normalized })
          replaceIn('campaigns', res.data.campaign)
        }),
      updateCampaignTodo: (campaignId, todoId, patch) =>
        run(async () => {
          const c = stateRef.current.campaigns.find((x) => x.id === campaignId)
          if (!c) return
          const todos = (c.todos || []).map((t) =>
            t.id === todoId ? { ...t, ...patch } : t,
          )
          const res = await api.patch(`/campaigns/${campaignId}`, { todos })
          replaceIn('campaigns', res.data.campaign)
        }),
      removeCampaignTodo: (campaignId, todoId) =>
        run(async () => {
          const c = stateRef.current.campaigns.find((x) => x.id === campaignId)
          if (!c) return
          const todos = (c.todos || []).filter((t) => t.id !== todoId)
          const res = await api.patch(`/campaigns/${campaignId}`, { todos })
          replaceIn('campaigns', res.data.campaign)
        }),
    }
  }, [state, bootstrapped, bootstrapError])

  // While auth is pending or we are loading the initial bundle, show a tiny
  // splash. Pages assume state is populated, so we must not render them
  // before bootstrap completes.
  if (status === 'pending' || (status === 'authed' && !bootstrapped)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-graphite text-sm">
        Loading workspace…
      </div>
    )
  }

  return <StoreContext.Provider value={api2}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
