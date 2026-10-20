// The app's colours — the one place to change them for a redesign.
//
// tailwind.config.js turns these into classes (bg-brand-500, text-graphite,
// bg-danger-100 …), index.css reads them through theme(), and charts drawn
// from JS (SVG fills, inline styles) import them directly.

// Brand — Wise Green; primary buttons, highlights, the Home hero.
export const brand = {
  50:  '#F4FCEA',
  100: '#E2F6D5',  // light mint
  200: '#CDFFAD',  // pastel green
  300: '#B6F390',
  400: '#A8EE7E',
  500: '#9FE870',  // signature Wise Green
  600: '#7EC25A',
  700: '#5A8C40',
  800: '#163300',  // dark green (text on green, focus rings)
  900: '#0A1F00',
}

// Surfaces, text and lines.
export const neutral = {
  white:        '#FFFFFF',
  iron:         '#F7F9F5',   // softest surface, hover tint
  'near-black': '#0E0F0C',   // primary text
  graphite:     '#454745',   // secondary text
  ash:          '#868685',   // muted text, placeholders
  shadow:       '#0E0F0C1F', // 12% near-black — hairline borders
}

// Status colours. Each names the Tailwind palette it uses, so classes read by
// meaning: bg-danger-100 text-danger-700. Swap a palette here to recolour every
// overdue / done / due-today / info badge at once.
export const status = {
  danger:  'rose',    // overdue, errors, destructive actions
  success: 'emerald', // done, completed, saved
  warning: 'amber',   // due today, follow-up, attention
  info:    'sky',     // in progress, informational
  accent:  'violet',  // prospects, groups — tags that aren't a status
  neutral: 'slate',   // blocked, inactive
}

// Colours used from JS, where a class can't reach (SVG charts, computed styles).
export const chart = {
  // Categorical slots in fixed order — validated for contrast on white.
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
  other:  '#c3c2b7',  // the "Other" slice
  bar:    brand[800], // one-series bar chart
  empty:  '#e8e8e4',  // zero-value bar stub
  line:   brand[700], // trend line + points
  area:   brand[500], // fill under the trend line
  grid:   '#0E0F0C14',
  // Sales dashboard KPI card top borders.
  kpi: {
    total:     '#0e0f0c',
    progress:  '#fab219',
    completed: '#0ca30c',
    rejected:  '#d03b3b',
  },
}
