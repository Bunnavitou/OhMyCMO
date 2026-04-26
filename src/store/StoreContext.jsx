import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { seedData } from './seed.js'

const STORAGE_KEY = 'ohmycmo:v1'

const StoreContext = createContext(null)

const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

function migrateCustomerTask(t) {
  if (t.name) return t
  return {
    id: t.id,
    name: t.title || 'Untitled task',
    registerDate: t.registerDate || new Date().toISOString().slice(0, 10),
    description: t.description || '',
    status: t.status || (t.done ? 'Done' : 'Todo'),
    file: t.file || null,
    due: t.due || '',
    assignee: t.assignee || '',
    groupId: t.groupId || null,
  }
}

function migrateCampaign(c) {
  return {
    ...c,
    todos: Array.isArray(c.todos) ? c.todos : [],
    status: c.status || 'Planning',
  }
}

function migratePartnerTask(t) {
  if (t.name) return t
  return {
    id: t.id,
    name: t.title || 'Untitled task',
    setDate: t.setDate || new Date().toISOString().slice(0, 10),
    description: t.description || '',
    expense: typeof t.expense === 'number' ? t.expense : 0,
    file: t.file || null,
    due: t.due || '',
    done: !!t.done,
  }
}

function migratePartner(p) {
  return {
    ...p,
    tasks: (p.tasks || []).map(migratePartnerTask),
    activities: p.activities || [],
  }
}

function migrateCustomer(c) {
  const taskGroups = c.taskGroups || []
  const tasks = (c.tasks || []).map(migrateCustomerTask)
  let logs = c.logs ? [...c.logs] : null
  if (!logs && c.activities) {
    logs = c.activities.map((a) => ({
      id: a.id || uid('log'),
      ts: a.date ? `${a.date}T09:00:00.000Z` : new Date().toISOString(),
      type: 'activity',
      message: a.type || 'Activity',
      meta: { activityType: a.type, note: a.note, date: a.date },
    }))
  }
  if (!logs) logs = []
  let files = c.files
  if (!files && c.agreements) {
    files = c.agreements.map((a) => ({
      id: a.id || uid('f'),
      name: a.title || 'Untitled',
      description: [
        a.status,
        a.value ? `$${Number(a.value).toLocaleString()}` : null,
        a.renewal ? `Renews ${a.renewal}` : null,
      ].filter(Boolean).join(' · '),
      type: 'application/pdf',
      size: 0,
      uploadedAt: new Date().toISOString(),
      dataUrl: null,
    }))
  }
  if (!files) files = []
  const productLinks = (c.productLinks || []).map((pl) => ({
    ...pl,
    activities: Array.isArray(pl.activities) ? pl.activities : [],
  }))
  const staff = c.staff || []
  const out = {
    address: '',
    vatTin: '',
    ...c,
    taskGroups,
    tasks,
    logs,
    files,
    productLinks,
    staff,
  }
  delete out.activities
  delete out.agreements
  return out
}

function reconcileProducts(stored) {
  return seedData.products.map((sp) => {
    const match = stored?.find((p) => p.id === sp.id)
    if (!match) return sp
    return {
      ...sp,
      income: Array.isArray(match.income) ? match.income : sp.income,
      expenses: Array.isArray(match.expenses) ? match.expenses : sp.expenses,
      assets: Array.isArray(match.assets) ? match.assets : sp.assets,
    }
  })
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedData
    const parsed = JSON.parse(raw)
    const merged = { ...seedData, ...parsed }
    return {
      ...merged,
      products: reconcileProducts(parsed.products),
      customers: (merged.customers || []).map(migrateCustomer),
      partners: (merged.partners || []).map(migratePartner),
      campaigns: (merged.campaigns || []).map(migrateCampaign),
    }
  } catch {
    return seedData
  }
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const api = useMemo(() => {
    const updateCollection = (key, updater) =>
      setState((s) => ({ ...s, [key]: updater(s[key]) }))

    const mutateCustomer = (id, fn) =>
      updateCollection('customers', (list) => list.map((c) => (c.id === id ? fn(c) : c)))

    const withLog = (c, entry) => ({
      ...c,
      logs: [
        {
          id: uid('log'),
          ts: new Date().toISOString(),
          ...entry,
        },
        ...(c.logs || []),
      ],
    })

    return {
      state,
      resetAll: () => setState(seedData),

      // Customers
      addCustomer: (data) => {
        const newCustomer = {
          id: uid('c'),
          tasks: [],
          taskGroups: [],
          files: [],
          logs: [],
          productLinks: [],
          staff: [],
          address: '',
          vatTin: '',
          stage: 'Prospect',
          ...data,
        }
        newCustomer.logs = [
          {
            id: uid('log'),
            ts: new Date().toISOString(),
            type: 'customer.create',
            message: `Customer created`,
            meta: { name: newCustomer.name },
          },
        ]
        updateCollection('customers', (list) => [newCustomer, ...list])
      },
      updateCustomer: (id, patch) =>
        mutateCustomer(id, (c) => {
          const changed = Object.keys(patch).filter((k) => c[k] !== patch[k])
          if (changed.length === 0) return c
          const next = { ...c, ...patch }
          return withLog(next, {
            type: 'customer.update',
            message: `Updated ${changed.join(', ')}`,
            meta: {
              changed,
              before: Object.fromEntries(changed.map((k) => [k, c[k]])),
              after: Object.fromEntries(changed.map((k) => [k, next[k]])),
            },
          })
        }),
      removeCustomer: (id) =>
        updateCollection('customers', (list) => list.filter((c) => c.id !== id)),

      // Manual audit log entry (used by "Log activity")
      appendCustomerLog: (id, entry) =>
        mutateCustomer(id, (c) => withLog(c, entry)),

      // Customer files (with auto-log)
      addCustomerFile: (id, file) =>
        mutateCustomer(id, (c) => {
          const f = {
            id: uid('f'),
            uploadedAt: new Date().toISOString(),
            description: '',
            ...file,
          }
          return withLog(
            { ...c, files: [f, ...(c.files || [])] },
            {
              type: 'file.upload',
              message: `Uploaded "${f.name}"`,
              meta: { fileId: f.id, size: f.size, type: f.type },
            },
          )
        }),
      removeCustomerFile: (id, fileId) =>
        mutateCustomer(id, (c) => {
          const f = c.files.find((x) => x.id === fileId)
          return withLog(
            { ...c, files: c.files.filter((x) => x.id !== fileId) },
            { type: 'file.delete', message: `Deleted "${f?.name || ''}"` },
          )
        }),

      // Customer ↔ Product links
      addCustomerProductLink: (customerId, productId) =>
        setState((s) => {
          const product = s.products.find((p) => p.id === productId)
          return {
            ...s,
            customers: s.customers.map((c) => {
              if (c.id !== customerId) return c
              if ((c.productLinks || []).some((l) => l.productId === productId)) return c
              const link = { id: uid('pl'), productId, linkedAt: new Date().toISOString() }
              return withLog(
                { ...c, productLinks: [...(c.productLinks || []), link] },
                {
                  type: 'product.link',
                  message: `Linked product "${product?.name || productId}"`,
                  meta: { linkId: link.id, productId },
                },
              )
            }),
          }
        }),
      removeCustomerProductLink: (customerId, linkId) =>
        setState((s) => ({
          ...s,
          customers: s.customers.map((c) => {
            if (c.id !== customerId) return c
            const link = (c.productLinks || []).find((l) => l.id === linkId)
            const product = link ? s.products.find((p) => p.id === link.productId) : null
            return withLog(
              { ...c, productLinks: (c.productLinks || []).filter((l) => l.id !== linkId) },
              {
                type: 'product.unlink',
                message: `Unlinked product "${product?.name || link?.productId || ''}"`,
                meta: { linkId, productId: link?.productId },
              },
            )
          }),
        })),

      // Customer ↔ Product activity thread (chat: text / file / task entries)
      addCustomerProductActivity: (customerId, linkId, entry) =>
        mutateCustomer(customerId, (c) => {
          const productLinks = (c.productLinks || []).map((l) => {
            if (l.id !== linkId) return l
            const newEntry = {
              id: uid('act'),
              ts: new Date().toISOString(),
              side: 'mine',
              type: 'text',
              ...entry,
            }
            return { ...l, activities: [...(l.activities || []), newEntry] }
          })
          return { ...c, productLinks }
        }),
      updateCustomerProductActivity: (customerId, linkId, entryId, patch) =>
        mutateCustomer(customerId, (c) => {
          const productLinks = (c.productLinks || []).map((l) => {
            if (l.id !== linkId) return l
            return {
              ...l,
              activities: (l.activities || []).map((a) =>
                a.id === entryId ? { ...a, ...patch } : a,
              ),
            }
          })
          return { ...c, productLinks }
        }),
      removeCustomerProductActivity: (customerId, linkId, entryId) =>
        mutateCustomer(customerId, (c) => {
          const productLinks = (c.productLinks || []).map((l) => {
            if (l.id !== linkId) return l
            return { ...l, activities: (l.activities || []).filter((a) => a.id !== entryId) }
          })
          return { ...c, productLinks }
        }),

      // Customer income / expense on a linked product (writes to global product, tagged with customerId)
      addCustomerProductIncome: (customerId, productId, entry) =>
        setState((s) => {
          const customer = s.customers.find((c) => c.id === customerId)
          const product = s.products.find((p) => p.id === productId)
          const incomeEntry = {
            id: uid('i'),
            date: new Date().toISOString().slice(0, 10),
            amount: 0,
            source: customer?.name || '',
            note: '',
            ...entry,
            customerId,
          }
          return {
            ...s,
            products: s.products.map((p) =>
              p.id === productId ? { ...p, income: [incomeEntry, ...p.income] } : p,
            ),
            customers: s.customers.map((c) =>
              c.id === customerId
                ? withLog(c, {
                    type: 'product.income',
                    message: `Recorded income $${Number(incomeEntry.amount).toLocaleString()} on "${product?.name || productId}"`,
                    meta: { productId, incomeId: incomeEntry.id, amount: incomeEntry.amount },
                  })
                : c,
            ),
          }
        }),
      removeCustomerProductIncome: (customerId, productId, incomeId) =>
        setState((s) => {
          const product = s.products.find((p) => p.id === productId)
          const entry = product?.income.find((i) => i.id === incomeId)
          return {
            ...s,
            products: s.products.map((p) =>
              p.id === productId ? { ...p, income: p.income.filter((i) => i.id !== incomeId) } : p,
            ),
            customers: s.customers.map((c) =>
              c.id === customerId
                ? withLog(c, {
                    type: 'product.income.delete',
                    message: `Deleted income $${Number(entry?.amount || 0).toLocaleString()} on "${product?.name || productId}"`,
                    meta: { productId, incomeId },
                  })
                : c,
            ),
          }
        }),
      addCustomerProductExpense: (customerId, productId, entry) =>
        setState((s) => {
          const product = s.products.find((p) => p.id === productId)
          const expenseEntry = {
            id: uid('e'),
            date: new Date().toISOString().slice(0, 10),
            amount: 0,
            category: 'Other',
            note: '',
            ...entry,
            customerId,
          }
          return {
            ...s,
            products: s.products.map((p) =>
              p.id === productId ? { ...p, expenses: [expenseEntry, ...p.expenses] } : p,
            ),
            customers: s.customers.map((c) =>
              c.id === customerId
                ? withLog(c, {
                    type: 'product.expense',
                    message: `Recorded expense $${Number(expenseEntry.amount).toLocaleString()} on "${product?.name || productId}"`,
                    meta: { productId, expenseId: expenseEntry.id, amount: expenseEntry.amount },
                  })
                : c,
            ),
          }
        }),
      removeCustomerProductExpense: (customerId, productId, expenseId) =>
        setState((s) => {
          const product = s.products.find((p) => p.id === productId)
          const entry = product?.expenses.find((e) => e.id === expenseId)
          return {
            ...s,
            products: s.products.map((p) =>
              p.id === productId ? { ...p, expenses: p.expenses.filter((e) => e.id !== expenseId) } : p,
            ),
            customers: s.customers.map((c) =>
              c.id === customerId
                ? withLog(c, {
                    type: 'product.expense.delete',
                    message: `Deleted expense $${Number(entry?.amount || 0).toLocaleString()} on "${product?.name || productId}"`,
                    meta: { productId, expenseId },
                  })
                : c,
            ),
          }
        }),

      // Customer task groups (with auto-log)
      addCustomerTaskGroup: (id, name) =>
        mutateCustomer(id, (c) => {
          const g = { id: uid('tg'), name }
          return withLog(
            { ...c, taskGroups: [...(c.taskGroups || []), g] },
            { type: 'group.create', message: `Created task group "${name}"`, meta: { groupId: g.id } },
          )
        }),
      renameCustomerTaskGroup: (id, groupId, name) =>
        mutateCustomer(id, (c) => {
          const before = c.taskGroups.find((g) => g.id === groupId)
          if (!before || before.name === name) return c
          return withLog(
            {
              ...c,
              taskGroups: c.taskGroups.map((g) => (g.id === groupId ? { ...g, name } : g)),
            },
            {
              type: 'group.rename',
              message: `Renamed group "${before.name}" → "${name}"`,
              meta: { groupId, before: before.name, after: name },
            },
          )
        }),
      removeCustomerTaskGroup: (id, groupId) =>
        mutateCustomer(id, (c) => {
          const removed = c.taskGroups.find((g) => g.id === groupId)
          return withLog(
            {
              ...c,
              taskGroups: c.taskGroups.filter((g) => g.id !== groupId),
              tasks: c.tasks.map((t) => (t.groupId === groupId ? { ...t, groupId: null } : t)),
            },
            { type: 'group.delete', message: `Deleted group "${removed?.name || ''}"`, meta: { groupId } },
          )
        }),

      // Customer tasks (with auto-log)
      addCustomerTask: (id, task) =>
        mutateCustomer(id, (c) => {
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
          return withLog(
            { ...c, tasks: [newTask, ...c.tasks] },
            {
              type: 'task.create',
              message: `Created task "${newTask.name}"`,
              meta: { taskId: newTask.id, status: newTask.status, assignee: newTask.assignee },
            },
          )
        }),
      updateCustomerTask: (id, taskId, patch) =>
        mutateCustomer(id, (c) => {
          const before = c.tasks.find((t) => t.id === taskId)
          if (!before) return c
          const after = { ...before, ...patch }
          const changed = Object.keys(patch).filter(
            (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
          )
          if (changed.length === 0) return c
          let type = 'task.update'
          let message
          if (changed.length === 1 && changed[0] === 'status') {
            type = 'task.status'
            message = `Task "${after.name}": ${before.status} → ${after.status}`
          } else {
            message = `Updated task "${after.name}" (${changed.join(', ')})`
          }
          return withLog(
            { ...c, tasks: c.tasks.map((t) => (t.id === taskId ? after : t)) },
            { type, message, meta: { taskId, changed } },
          )
        }),
      removeCustomerTask: (id, taskId) =>
        mutateCustomer(id, (c) => {
          const removed = c.tasks.find((t) => t.id === taskId)
          return withLog(
            { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) },
            { type: 'task.delete', message: `Deleted task "${removed?.name || 'Untitled'}"`, meta: { taskId } },
          )
        }),

      // Customer staff (with auto-log)
      addCustomerStaff: (id, staff) =>
        mutateCustomer(id, (c) => {
          const s = {
            id: uid('s'),
            name: '',
            role: '',
            department: '',
            email: '',
            phone: '',
            reportsTo: null,
            ...staff,
          }
          return withLog(
            { ...c, staff: [...(c.staff || []), s] },
            { type: 'staff.create', message: `Added staff "${s.name}"`, meta: { staffId: s.id } },
          )
        }),
      updateCustomerStaff: (id, staffId, patch) =>
        mutateCustomer(id, (c) => {
          const before = c.staff.find((s) => s.id === staffId)
          if (!before) return c
          const after = { ...before, ...patch }
          const changed = Object.keys(patch).filter(
            (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
          )
          if (changed.length === 0) return c
          return withLog(
            { ...c, staff: c.staff.map((s) => (s.id === staffId ? after : s)) },
            {
              type: 'staff.update',
              message: `Updated staff "${after.name}" (${changed.join(', ')})`,
              meta: { staffId, changed },
            },
          )
        }),
      removeCustomerStaff: (id, staffId) =>
        mutateCustomer(id, (c) => {
          const removed = c.staff.find((s) => s.id === staffId)
          return withLog(
            {
              ...c,
              staff: c.staff
                .filter((s) => s.id !== staffId)
                .map((s) => (s.reportsTo === staffId ? { ...s, reportsTo: null } : s)),
            },
            { type: 'staff.delete', message: `Removed staff "${removed?.name || ''}"`, meta: { staffId } },
          )
        }),

      // Products
      addProduct: (data) =>
        updateCollection('products', (list) => [
          { id: uid('p'), income: [], expenses: [], assets: [], type: 'Service', price: 0, ...data },
          ...list,
        ]),
      updateProduct: (id, patch) =>
        updateCollection('products', (list) =>
          list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        ),
      removeProduct: (id) =>
        updateCollection('products', (list) => list.filter((p) => p.id !== id)),
      addProductChild: (id, field, item) =>
        updateCollection('products', (list) =>
          list.map((p) =>
            p.id === id ? { ...p, [field]: [{ id: uid(field[0]), ...item }, ...(p[field] || [])] } : p,
          ),
        ),
      removeProductChild: (id, field, entryId) =>
        updateCollection('products', (list) =>
          list.map((p) =>
            p.id === id ? { ...p, [field]: (p[field] || []).filter((x) => x.id !== entryId) } : p,
          ),
        ),

      // Partners
      addPartner: (data) =>
        updateCollection('partners', (list) => [
          { id: uid('pa'), tasks: [], activities: [], ...data },
          ...list,
        ]),
      updatePartner: (id, patch) =>
        updateCollection('partners', (list) =>
          list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        ),
      removePartner: (id) =>
        updateCollection('partners', (list) => list.filter((p) => p.id !== id)),
      addPartnerChild: (id, field, item) =>
        updateCollection('partners', (list) =>
          list.map((p) =>
            p.id === id ? { ...p, [field]: [{ id: uid(field[0]), ...item }, ...(p[field] || [])] } : p,
          ),
        ),
      togglePartnerTask: (id, taskId) =>
        updateCollection('partners', (list) =>
          list.map((p) =>
            p.id === id
              ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) }
              : p,
          ),
        ),
      addPartnerTask: (id, task) =>
        updateCollection('partners', (list) =>
          list.map((p) =>
            p.id === id
              ? {
                  ...p,
                  tasks: [
                    {
                      id: uid('pt'),
                      name: '',
                      setDate: new Date().toISOString().slice(0, 10),
                      description: '',
                      expense: 0,
                      file: null,
                      due: '',
                      done: false,
                      ...task,
                    },
                    ...p.tasks,
                  ],
                }
              : p,
          ),
        ),
      updatePartnerTask: (id, taskId, patch) =>
        updateCollection('partners', (list) =>
          list.map((p) =>
            p.id === id
              ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }
              : p,
          ),
        ),
      removePartnerTask: (id, taskId) =>
        updateCollection('partners', (list) =>
          list.map((p) =>
            p.id === id ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p,
          ),
        ),

      // Assets
      addAsset: (data) =>
        updateCollection('assets', (list) => [
          { id: uid('as'), status: 'In use', ...data },
          ...list,
        ]),
      updateAsset: (id, patch) =>
        updateCollection('assets', (list) =>
          list.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        ),
      removeAsset: (id) =>
        updateCollection('assets', (list) => list.filter((a) => a.id !== id)),

      // Marketing campaigns
      addCampaign: (data) =>
        updateCollection('campaigns', (list) => [
          {
            id: uid('cm'),
            name: '',
            description: '',
            productId: null,
            startDate: '',
            endDate: '',
            status: 'Planning',
            todos: [],
            ...data,
          },
          ...(list || []),
        ]),
      updateCampaign: (id, patch) =>
        updateCollection('campaigns', (list) =>
          (list || []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
        ),
      removeCampaign: (id) =>
        updateCollection('campaigns', (list) => (list || []).filter((c) => c.id !== id)),
      addCampaignTodo: (campaignId, todo) =>
        updateCollection('campaigns', (list) =>
          (list || []).map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  todos: [
                    {
                      id: uid('cmt'),
                      postDate: '',
                      concept: '',
                      type: 'Image',
                      channel: '',
                      keyFeature: '',
                      caption: '',
                      artwork: null,
                      ...todo,
                    },
                    ...(c.todos || []),
                  ],
                }
              : c,
          ),
        ),
      replaceCampaignTodos: (campaignId, todos) =>
        updateCollection('campaigns', (list) =>
          (list || []).map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  todos: (todos || []).map((t) => ({
                    id: t.id || uid('cmt'),
                    postDate: '',
                    concept: '',
                    type: 'Image',
                    channel: '',
                    keyFeature: '',
                    caption: '',
                    artwork: null,
                    ...t,
                  })),
                }
              : c,
          ),
        ),
      updateCampaignTodo: (campaignId, todoId, patch) =>
        updateCollection('campaigns', (list) =>
          (list || []).map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  todos: (c.todos || []).map((t) =>
                    t.id === todoId ? { ...t, ...patch } : t,
                  ),
                }
              : c,
          ),
        ),
      removeCampaignTodo: (campaignId, todoId) =>
        updateCollection('campaigns', (list) =>
          (list || []).map((c) =>
            c.id === campaignId
              ? { ...c, todos: (c.todos || []).filter((t) => t.id !== todoId) }
              : c,
          ),
        ),
    }
  }, [state])

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
