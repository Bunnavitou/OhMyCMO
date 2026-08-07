import { useId } from 'react'
import { useT } from '../i18n/LanguageContext.jsx'
import { TASK_PROGRESS_STEP, clampProgress } from '../utils/tasks.js'

// Shared completion-percentage slider used by every task / post form
// (Tasks board, partner tasks, marketing posts). Reports the value back as a
// plain number so callers can drop it straight into the stored task JSON.
//
// The filled part of the track is drawn from the `--pct` custom property —
// see the `.range` rules in index.css.
export default function ProgressField({ value, onChange, disabled = false }) {
  const { t } = useT()
  const id = useId()
  const pct = clampProgress(value)

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label" htmlFor={id}>{t('tasks.field.progress')}</label>
        <span className="text-sm font-bold text-near-black tabular-nums">{pct}%</span>
      </div>
      <input
        id={id}
        className="range"
        type="range"
        min="0"
        max="100"
        step={TASK_PROGRESS_STEP}
        disabled={disabled}
        value={pct}
        style={{ '--pct': `${pct}%` }}
        onChange={(e) => onChange(clampProgress(e.target.value))}
      />
      <div className="flex justify-between text-[11px] text-graphite">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
