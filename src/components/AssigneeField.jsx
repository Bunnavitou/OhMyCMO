import { memberName } from '../utils/tasks.js'

// Shared "person in charge" picker used by task forms (customers, partners).
// Lets the user pick a roster member or type a free-text name.
export default function AssigneeField({ team, assigneeId, assignee, onChange }) {
  const isCustom = !assigneeId && !!assignee
  const selectValue = assigneeId || (isCustom ? '__custom' : '')

  const onSelect = (v) => {
    if (v === '') onChange({ assigneeId: '', assignee: '' })
    else if (v === '__custom') onChange({ assigneeId: '', assignee: assignee || '' })
    else {
      const m = team.find((x) => x.id === v)
      onChange({ assigneeId: v, assignee: m ? memberName(m) : '' })
    }
  }

  return (
    <div>
      <label className="label">Person in charge</label>
      <select className="input" value={selectValue} onChange={(e) => onSelect(e.target.value)}>
        <option value="">Unassigned</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>
            {memberName(m)}{m.role === 'ADMIN' ? ' (Admin)' : ''}
          </option>
        ))}
        <option value="__custom">Other (type a name)…</option>
      </select>
      {selectValue === '__custom' && (
        <input
          className="input mt-2"
          value={assignee}
          onChange={(e) => onChange({ assignee: e.target.value, assigneeId: '' })}
          placeholder="Sara Lim"
          autoFocus
        />
      )}
    </div>
  )
}
