import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Wraps an inline element; hover or focus shows `tip` in a small tooltip right
// away (a native title waits a second and is easy to miss). Portalled and
// fixed-positioned like NoteTip, so scrolling tables can't clip it.
export default function HoverTip({ tip, children }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  if (!tip) return children

  const show = () => {
    const r = ref.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 248))
    setPos(window.innerHeight - r.bottom < 80
      ? { left, bottom: window.innerHeight - r.top + 6 }
      : { left, top: r.bottom + 6 })
  }
  const hide = () => setPos(null)

  return (
    <>
      <span ref={ref} tabIndex={0} aria-label={tip} className="inline-flex cursor-default"
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
        {children}
      </span>
      {pos && createPortal(
        <div role="tooltip" style={pos}
          className="fixed z-[100] max-w-[240px] rounded-lg border border-shadow bg-white shadow-lg px-2.5 py-1.5 text-xs font-semibold text-near-black whitespace-nowrap">
          {tip}
        </div>,
        document.body,
      )}
    </>
  )
}
