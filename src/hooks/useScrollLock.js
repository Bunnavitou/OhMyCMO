import { useEffect } from 'react'

// How many open popups want the page held still. A dialog opened from another
// (e.g. Mark as won inside the sale form) must not unlock the page when it closes.
let locks = 0
let saved = null

// Stops the page behind a popup from scrolling while `active`. The scrollbar's
// width is padded back so the page doesn't shift sideways when it disappears.
export default function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    if (locks++ === 0) {
      const html = document.documentElement
      const gap = window.innerWidth - html.clientWidth
      saved = { overflow: html.style.overflow, paddingRight: document.body.style.paddingRight }
      html.style.overflow = 'hidden'
      if (gap > 0) document.body.style.paddingRight = `${gap}px`
    }
    return () => {
      if (--locks === 0) {
        document.documentElement.style.overflow = saved.overflow
        document.body.style.paddingRight = saved.paddingRight
        saved = null
      }
    }
  }, [active])
}
