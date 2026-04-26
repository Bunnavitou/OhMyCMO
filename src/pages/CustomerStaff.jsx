import { useState, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Mail, Phone, Users, Briefcase, Crown,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function CustomerStaff() {
  const { id } = useParams()
  const {
    state,
    addCustomerStaff,
    updateCustomerStaff,
    removeCustomerStaff,
  } = useStore()

  const customer = state.customers.find((c) => c.id === id)
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState(null)

  if (!customer) return <Navigate to="/customers" replace />

  const staff = customer.staff || []

  // Build tree structure: only include reportsTo edges that point to staff in this list,
  // otherwise treat as root.
  const idSet = useMemo(() => new Set(staff.map((s) => s.id)), [staff])
  const childrenOf = useMemo(() => {
    const map = new Map()
    for (const s of staff) {
      const parent = s.reportsTo && idSet.has(s.reportsTo) ? s.reportsTo : null
      const arr = map.get(parent) || []
      arr.push(s)
      map.set(parent, arr)
    }
    return map
  }, [staff, idSet])

  const departments = useMemo(() => {
    const set = new Set()
    for (const s of staff) if (s.department) set.add(s.department)
    return Array.from(set)
  }, [staff])

  return (
    <>
      <PageHeader
        title="Company structure"
        subtitle={`${customer.name} · ${staff.length} staff${staff.length === 1 ? '' : ''}`}
        back
        action={
          <button onClick={() => { setEditing(null); setOpenModal(true) }} className="btn-primary !px-3 !py-2">
            <Plus className="w-4 h-4" /> Add
          </button>
        }
      />

      <div className="space-y-4">
        {staff.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No staff yet"
            description="Add team members and link who reports to whom to build the org chart."
            action={
              <button onClick={() => { setEditing(null); setOpenModal(true) }} className="btn-primary">
                <Plus className="w-4 h-4" /> Add staff
              </button>
            }
          />
        ) : (
          <>
            {departments.length > 0 && (
              <section className="card !p-3">
                <p className="text-xs font-semibold text-steel uppercase tracking-wider mb-2">
                  Departments
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {departments.map((d) => (
                    <span key={d} className="pill bg-brand-50 text-brand-700">
                      <Briefcase className="w-3 h-3 mr-1" /> {d}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section>
              <p className="text-xs font-semibold text-steel uppercase tracking-wider mb-2 px-1">
                Org chart
              </p>
              <ul className="card divide-y divide-shadow p-0">
                <Tree
                  childrenOf={childrenOf}
                  parentId={null}
                  depth={0}
                  onEdit={(s) => { setEditing(s); setOpenModal(true) }}
                  onDelete={(s) => {
                    if (confirm(`Remove ${s.name}? Direct reports will be promoted to top level.`)) {
                      removeCustomerStaff(customer.id, s.id)
                    }
                  }}
                />
              </ul>
            </section>
          </>
        )}
      </div>

      <Modal
        open={openModal}
        onClose={() => { setOpenModal(false); setEditing(null) }}
        title={editing ? 'Edit staff' : 'Add staff'}
      >
        <StaffForm
          key={editing?.id || 'new-staff'}
          initial={editing}
          allStaff={staff}
          onDelete={editing ? () => {
            if (confirm(`Remove ${editing.name}?`)) {
              removeCustomerStaff(customer.id, editing.id)
              setOpenModal(false); setEditing(null)
            }
          } : null}
          onSubmit={(data) => {
            if (editing) updateCustomerStaff(customer.id, editing.id, data)
            else addCustomerStaff(customer.id, data)
            setOpenModal(false); setEditing(null)
          }}
        />
      </Modal>
    </>
  )
}

function Tree({ childrenOf, parentId, depth, onEdit, onDelete }) {
  const items = childrenOf.get(parentId) || []
  if (items.length === 0) return null
  return items.map((s) => (
    <StaffRow
      key={s.id}
      staff={s}
      depth={depth}
      hasChildren={(childrenOf.get(s.id) || []).length > 0}
      onEdit={onEdit}
      onDelete={onDelete}
    >
      <Tree
        childrenOf={childrenOf}
        parentId={s.id}
        depth={depth + 1}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </StaffRow>
  ))
}

function StaffRow({ staff, depth, hasChildren, onEdit, onDelete, children }) {
  return (
    <>
      <li
        className="flex items-center gap-3 p-3"
        style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
      >
        {depth > 0 && (
          <span
            className="absolute -ml-3 w-3 border-t-2 border-shadow"
            aria-hidden
          />
        )}
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
            depth === 0 ? 'bg-brand-100 text-brand-700' : 'bg-iron text-white/75'
          }`}
        >
          {depth === 0 && hasChildren ? <Crown className="w-4 h-4" /> : (staff.name?.charAt(0) || '?')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{staff.name || 'Unnamed'}</p>
            {staff.department && (
              <span className="pill bg-iron text-white/75">{staff.department}</span>
            )}
          </div>
          {staff.role && (
            <p className="text-xs text-steel truncate">{staff.role}</p>
          )}
          {(staff.email || staff.phone) && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-steel">
              {staff.email && (
                <a href={`mailto:${staff.email}`} className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {staff.email}
                </a>
              )}
              {staff.phone && (
                <a href={`tel:${staff.phone}`} className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {staff.phone}
                </a>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => onEdit(staff)}
          className="p-1.5 rounded-full hover:bg-iron text-steel"
          aria-label="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(staff)}
          className="p-1.5 rounded-full hover:bg-rose-50 text-rose-500"
          aria-label="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </li>
      {children}
    </>
  )
}

function StaffForm({ initial, allStaff, onSubmit, onDelete }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    role: initial?.role || '',
    department: initial?.department || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    reportsTo: initial?.reportsTo || '',
  })

  // Reports-to options exclude self and self's descendants to avoid cycles
  const descendantIds = useMemo(() => {
    if (!initial) return new Set()
    const ids = new Set([initial.id])
    let added = true
    while (added) {
      added = false
      for (const s of allStaff) {
        if (s.reportsTo && ids.has(s.reportsTo) && !ids.has(s.id)) {
          ids.add(s.id)
          added = true
        }
      }
    }
    return ids
  }, [allStaff, initial])

  const managerOptions = allStaff.filter((s) => !descendantIds.has(s.id))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!form.name.trim()) return
        onSubmit({ ...form, reportsTo: form.reportsTo || null })
      }}
      className="space-y-3"
    >
      <div>
        <label className="label">Full name *</label>
        <input
          className="input"
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Sara Lim"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Role / title</label>
          <input
            className="input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            placeholder="CEO"
          />
        </div>
        <div>
          <label className="label">Department</label>
          <input
            className="input"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            placeholder="Executive"
          />
        </div>
      </div>
      <div>
        <label className="label">Reports to</label>
        <select
          className="input"
          value={form.reportsTo}
          onChange={(e) => setForm({ ...form, reportsTo: e.target.value })}
        >
          <option value="">Top of org chart</option>
          {managerOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || 'Unnamed'}{s.role ? ` — ${s.role}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 text-sm font-semibold"
          >
            Remove
          </button>
        )}
        <button type="submit" className="btn-primary flex-1">
          {initial ? 'Save changes' : 'Add staff'}
        </button>
      </div>
    </form>
  )
}
