import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { StickyNote } from 'lucide-react'

// A small note icon; hover, focus or tap shows the note in a tooltip. The
// tooltip is portalled and fixed-positioned so scrolling tables can't clip
// it, and opens above the icon when there's no room below.
export default function NoteTip({ note, label }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  const show = () => {
    const r = ref.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.left - 8, window.innerWidth - 296))
    setPos(window.innerHeight - r.bottom < 160
      ? { left, bottom: window.innerHeight - r.top + 6 }
      : { left, top: r.bottom + 6 })
  }
  const hide = () => setPos(null)

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className="inline-flex align-middle ml-1 p-0.5 text-graphite hover:text-near-black"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        // Rows open the sale on click; a tap here only toggles the note.
        onClick={(e) => { e.stopPropagation(); if (pos) hide(); else show() }}
      >
        <StickyNote className="w-3.5 h-3.5" />
      </button>
      {pos && createPortal(
        <div role="tooltip" style={pos}
          className="fixed z-[100] w-72 rounded-xl border border-shadow bg-white shadow-lg p-3 text-xs font-medium text-near-black whitespace-pre-wrap">
          {note}
        </div>,
        document.body,
      )}
    </>
  )
}
