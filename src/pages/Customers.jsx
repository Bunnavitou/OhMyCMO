import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Users, Building2, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import DateFilterButton from '../components/DateFilterButton.jsx'
import { useT } from '../i18n/LanguageContext.jsx'

const customerInRange = (c, range) => {
  if (!range) return true
  const startMs = range.start.getTime()
  const endMs = range.end.getTime()
  return (c.logs || []).some((l) => {
    if (!l.ts) return false
    const t = new Date(l.ts).getTime()
    return t >= startMs && t <= endMs
  })
}

const STAGES = [
  { value: 'Prospect', tKey: 'customer.stage.prospect' },
  { value: 'Active',   tKey: 'customer.stage.active' },
  { value: 'On hold',  tKey: 'customer.stage.onHold' },
  { value: 'Churned',  tKey: 'customer.stage.churned' },
]

function stageLabel(value, t) {
  const found = STAGES.find((s) => s.value === value)
  return found ? t(found.tKey) : value
}

export default function Customers() {
  const {
    state,
    addCustomer,
    addCustomerGroup,
    updateCustomerGroup,
    removeCustomerGroup,
  } = useStore()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [groupModal, setGroupModal] = useState({ open: false, editing: null })
  const [q, setQ] = useState('')
  const [dateRange, setDateRange] = useState(null)
  // 'all' | '<groupId>' | 'none' (= ungrouped)
  const [groupFilter, setGroupFilter] = useState('all')

  const groups = state.customerGroups || []

  const filtered = useMemo(
    () =>
      state.customers
        .filter((c) =>
          [c.name, c.industry, c.contact].join(' ').toLowerCase().includes(q.toLowerCase()),
        )
        .filter((c) => customerInRange(c, dateRange))
        .filter((c) => {
          if (groupFilter === 'all') return true
          if (groupFilter === 'none') return !c.groupId
          return c.groupId === groupFilter
        }),
    [state.customers, q, dateRange, groupFilter],
  )

  const closeGroupModal = () => setGroupModal({ open: false, editing: null })

  const handleGroupSave = async (data) => {
    if (groupModal.editing) {
      await updateCustomerGroup(groupModal.editing.id, data)
    } else {
      await addCustomerGroup(data)
    }
    closeGroupModal()
  }

  const handleGroupDelete = async () => {
    if (!groupModal.editing) return
    if (!confirm(t('customer.groups.delete.confirm'))) return
    await removeCustomerGroup(groupModal.editing.id)
    if (groupFilter === groupModal.editing.id) setGroupFilter('all')
    closeGroupModal()
  }

  return (
    <>
      <PageHeader title={t('customer.title')} />
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('customer.search')}
              className="input pl-9"
            />
          </div>
          <DateFilterButton
            value={dateRange}
            onChange={setDateRange}
            storageKey="ohmycmo:filter:customers"
          />
        </div>

        {/* Group filter strip + add group */}
        <GroupFilterRow
          groups={groups}
          selected={groupFilter}
          onSelect={setGroupFilter}
          onAddGroup={() => setGroupModal({ open: true, editing: null })}
          onEditGroup={(g) => setGroupModal({ open: true, editing: g })}
        />

        {state.customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('customer.empty.title')}
            description={t('customer.empty.body')}
            action={
              <button onClick={() => setOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> {t('customer.addNew')}
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-graphite py-6">
            {groupFilter === 'all'
              ? t('customer.noFilterMatch')
              : t('customer.noGroupMatch')}
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => {
              const openTasks = c.tasks.filter((t) => t.status !== 'Done').length
              const group = groups.find((g) => g.id === c.groupId)
              return (
                <li key={c.id}>
                  <Link to={`/customers/${c.id}`} className="card flex gap-3 active:scale-[0.99]">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{c.name}</p>
                        <span className={`pill ${
                          c.stage === 'Active' ? 'bg-emerald-100 text-emerald-700'
                          : c.stage === 'Prospect' ? 'bg-amber-100 text-amber-700'
                          : 'bg-iron text-graphite'
                        }`}>{stageLabel(c.stage, t)}</span>
                        {group && (
                          <span className="pill bg-violet-100 text-violet-700">{group.name}</span>
                        )}
                      </div>
                      <p className="text-xs text-graphite flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" /> {c.industry || '—'}
                      </p>
                      <div className="flex gap-3 mt-2 text-xs text-graphite">
                        <span>{t('customer.openTasks', { count: openTasks })}</span>
                        <span>{t('customer.fileCount', { n: c.files?.length || 0 })}</span>
                        <span>{t('customer.eventCount', { n: c.logs?.length || 0 })}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <NewCustomerModal
        open={open}
        groups={groups}
        defaultGroupId={groupFilter !== 'all' && groupFilter !== 'none' ? groupFilter : ''}
        onClose={() => setOpen(false)}
        onSubmit={(data) => { addCustomer(data); setOpen(false) }}
      />

      <CustomerGroupModal
        open={groupModal.open}
        editing={groupModal.editing}
        onClose={closeGroupModal}
        onSubmit={handleGroupSave}
        onDelete={groupModal.editing ? handleGroupDelete : null}
      />

      <button
        onClick={() => setOpen(true)}
        className="btn-primary fixed z-40 right-4 md:right-8 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-8 shadow-xl"
        aria-label={t('customer.addNew')}
      >
        <Plus className="w-5 h-5" /> {t('common.new')}
      </button>
    </>
  )
}

function GroupFilterRow({ groups, selected, onSelect, onAddGroup, onEditGroup }) {
  const { t } = useT()
  return (
    <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
      <PillButton active={selected === 'all'} onClick={() => onSelect('all')}>
        {t('customer.groups.all')}
      </PillButton>
      {groups.map((g) => (
        <PillButton
          key={g.id}
          active={selected === g.id}
          onClick={() => onSelect(g.id)}
          onDoubleClick={() => onEditGroup(g)}
          title={g.name}
        >
          <span className="truncate max-w-[140px] inline-block align-middle">{g.name}</span>
        </PillButton>
      ))}
      {groups.length > 0 && (
        <PillButton
          active={selected === 'none'}
          onClick={() => onSelect('none')}
          variant="muted"
        >
          {t('customer.field.groupNone')}
        </PillButton>
      )}
      <button
        onClick={onAddGroup}
        className="pill border border-dashed border-graphite text-graphite hover:bg-iron flex items-center gap-1 shrink-0"
      >
        <FolderPlus className="w-3 h-3" /> {t('customer.groups.add')}
      </button>
      {/* Selected group's edit shortcut (only when an actual group is picked) */}
      {selected !== 'all' && selected !== 'none' && (
        <button
          onClick={() => {
            const g = groups.find((x) => x.id === selected)
            if (g) onEditGroup(g)
          }}
          className="pill border border-shadow text-graphite hover:bg-iron flex items-center gap-1 shrink-0"
          aria-label={t('customer.groups.modal.edit')}
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

function PillButton({ active, onClick, onDoubleClick, variant, title, children }) {
  const base = 'pill border shrink-0'
  const cls = active
    ? 'bg-brand-600 border-brand-600 text-white'
    : variant === 'muted'
      ? 'bg-iron border-shadow text-graphite hover:bg-graphite/10'
      : 'bg-charcoal border-shadow text-graphite hover:bg-iron'
  return (
    <button onClick={onClick} onDoubleClick={onDoubleClick} title={title} className={`${base} ${cls}`}>
      {children}
    </button>
  )
}

const EMPTY_CUSTOMER = {
  name: '',
  industry: '',
  contact: '',
  email: '',
  phone: '',
  address: '',
  vatTin: '',
  stage: 'Prospect',
  groupId: '',
}

function NewCustomerModal({ open, groups, defaultGroupId, onClose, onSubmit }) {
  const { t } = useT()
  const [form, setForm] = useState({ ...EMPTY_CUSTOMER, groupId: defaultGroupId || '' })

  // Reset (and pick up defaultGroupId) every time the modal opens.
  const change = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit({ ...form, groupId: form.groupId || null })
    setForm({ ...EMPTY_CUSTOMER, groupId: defaultGroupId || '' })
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('customer.modal.new')}
      key={open ? `new-${defaultGroupId || ''}` : 'closed'}
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">{t('field.companyName')} *</label>
          <input className="input" value={form.name} onChange={change('name')} placeholder="Acme Holdings" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('field.industry')}</label>
            <input className="input" value={form.industry} onChange={change('industry')} placeholder="FMCG" />
          </div>
          <div>
            <label className="label">{t('field.stage')}</label>
            <select className="input" value={form.stage} onChange={change('stage')}>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>{t(s.tKey)}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t('customer.field.group')}</label>
          <select className="input" value={form.groupId} onChange={change('groupId')}>
            <option value="">{t('customer.field.groupNone')}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('field.email')}</label>
            <input className="input" type="email" value={form.email} onChange={change('email')} placeholder="sara@acme.co" />
          </div>
          <div>
            <label className="label">{t('field.tel')}</label>
            <input className="input" value={form.phone} onChange={change('phone')} placeholder="+855..." />
          </div>
        </div>
        <div>
          <label className="label">{t('field.address')}</label>
          <textarea
            className="input min-h-[60px]"
            value={form.address}
            onChange={change('address')}
            placeholder="Building, street, city"
          />
        </div>
        <div>
          <label className="label">{t('field.vatTin')}</label>
          <input className="input" value={form.vatTin} onChange={change('vatTin')} placeholder="K001-..." />
        </div>
        <button type="submit" className="btn-primary w-full mt-2">{t('customer.save')}</button>
      </form>
    </Modal>
  )
}

function CustomerGroupModal({ open, editing, onClose, onSubmit, onDelete }) {
  const { t } = useT()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('customer.groups.modal.edit') : t('customer.groups.modal.new')}
      // Force the inner form to remount (and reset its `name` state) every
      // time the modal opens or switches between create / edit a different row.
      key={open ? `group-${editing?.id || 'new'}` : 'closed'}
    >
      <CustomerGroupForm
        initial={editing}
        onSubmit={onSubmit}
        onDelete={onDelete}
      />
    </Modal>
  )
}

function CustomerGroupForm({ initial, onSubmit, onDelete }) {
  const { t } = useT()
  const [name, setName] = useState(initial?.name || '')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim() })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">{t('customer.groups.field.name')} *</label>
        <input
          className="input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('customer.groups.field.namePh')}
        />
      </div>
      <div className="flex gap-2 pt-1">
        {onDelete && (
          <button
            type="button"
            disabled={submitting}
            onClick={onDelete}
            className="px-4 py-2.5 rounded-full text-rose-600 hover:bg-rose-50 text-sm font-semibold disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" /> {t('common.delete')}
            </span>
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary flex-1 disabled:opacity-60"
        >
          {submitting ? t('common.saving') : (initial ? t('common.saveChanges') : t('customer.groups.save'))}
        </button>
      </div>
    </form>
  )
}
