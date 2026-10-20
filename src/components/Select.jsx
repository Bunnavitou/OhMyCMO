import { useState, useEffect, useRef, Children, isValidElement } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Drop-in replacement for a native <select> with a solid white menu — native
 * menus on macOS render with a translucent, blurred background we can't style.
 *
 * Use it exactly like <select>: <option> children (value / disabled), a
 * `value`, and an `onChange(e)` that reads `e.target.value` (always a string,
 * as with the native element). Other props (className, id, aria-label,
 * disabled, title, style…) go to the trigger button.
 */
export default function Select({ value, onChange, children, className = '', disabled, ...rest }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const options = Children.toArray(children)
    .filter((c) => isValidElement(c) && c.type === 'option')
    .map((c) => ({
      value: String(c.props.value ?? textOf(c.props.children)),
      label: c.props.children,
      disabled: !!c.props.disabled,
    }))
  // Like the native element, fall back to the first option when nothing matches.
  const selIndex = Math.max(0, options.findIndex((o) => o.value === String(value ?? '')))
  const selected = options[selIndex]

  useEffect(() => {
    if (!open) return
    const inside = (t) => btnRef.current?.contains(t) || menuRef.current?.contains(t)
    const onDown = (e) => { if (!inside(e.target)) setOpen(false) }
    // The menu is fixed-positioned, so close it rather than let it drift when the page scrolls.
    const onScroll = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false) }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  // Keep the highlighted option visible in long, scrolling lists.
  useEffect(() => {
    if (open) menuRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const show = () => {
    const rect = btnRef.current.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom - 8
    const above = rect.top - 8
    const wanted = Math.min(options.length * 36 + 8, 320)
    // Fixed + portal escapes overflow-clipping and transformed parents (scroll cards, modals).
    // Open upward only when it doesn't fit below and there's more room above.
    const dropUp = below < wanted && above > below
    setPos({
      left: rect.left,
      minWidth: rect.width,
      maxHeight: Math.min(320, dropUp ? above : below),
      ...(dropUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    })
    setActive(selIndex)
    setOpen(true)
  }

  const choose = (o) => {
    if (o.disabled) return
    setOpen(false)
    btnRef.current?.focus()
    if (o.value !== selected?.value) {
      const target = { value: o.value, id: rest.id, name: rest.name }
      onChange?.({ target, currentTarget: target })
    }
  }

  const step = (from, dir) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i
    return from
  }

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
      return
    }
    // Stop Escape here so it only closes the menu, not an enclosing modal.
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => step(i, 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => step(i, -1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(options[active]) }
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1) {
      // Type-ahead: jump to the next option starting with the typed letter.
      const k = e.key.toLowerCase()
      const n = options.length
      for (let j = 1; j <= n; j++) {
        const i = (active + j) % n
        if (!options[i].disabled && textOf(options[i].label).trim().toLowerCase().startsWith(k)) { setActive(i); break }
      }
    }
  }

  return (
    <>
      <button
        {...rest}
        ref={btnRef}
        type="button"
        disabled={disabled}
        className={`inline-flex items-center justify-between gap-2 text-left ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
      </button>
      {open && createPortal(
        <ul
          ref={menuRef}
          role="listbox"
          style={pos}
          className="fixed z-[100] py-1 overflow-y-auto bg-white text-near-black text-sm font-medium border border-shadow rounded-xl shadow-lg"
        >
          {options.map((o, i) => (
            <li
              key={o.value + i}
              role="option"
              aria-selected={i === selIndex}
              aria-disabled={o.disabled || undefined}
              className={`px-3 h-9 flex items-center gap-2 whitespace-nowrap ${o.disabled ? 'text-graphite opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${i === active && !o.disabled ? 'bg-iron' : ''}`}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
            >
              <Check className={`w-4 h-4 shrink-0 ${i === selIndex ? '' : 'invisible'}`} />
              <span>{o.label}</span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  )
}

// Plain text of an option's children, for value fallback and type-ahead.
function textOf(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return isValidElement(node) ? textOf(node.props.children) : ''
}
