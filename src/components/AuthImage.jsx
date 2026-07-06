// Renders an image from an image reference (see utils/imageRef.js).
//
// - { dataUrl }  → rendered directly (legacy rows / fresh in-form previews).
// - { fileId }   → bytes fetched lazily from /api/files/:id/content with the
//                  Bearer token (an <img src> can't carry the auth header), then
//                  shown via an object URL. Fetches only when scrolled into view
//                  and are cached per fileId so a list of thumbnails doesn't pull
//                  every image at once or re-fetch on re-render.
//
// Props: value (the ref), plus any <img> attributes (className, alt, ...).
// Renders nothing when there is no image.

import { useEffect, useRef, useState } from 'react'
import { getBlob } from '../api/client.js'
import { fileContentPath } from '../utils/imageRef.js'

// fileId -> Promise<objectURL>. Module-scoped so it survives re-mounts and is
// shared across every AuthImage in the session.
const cache = new Map()

function loadFile(fileId) {
  if (!cache.has(fileId)) {
    cache.set(
      fileId,
      getBlob(fileContentPath(fileId)).then((blob) => URL.createObjectURL(blob)),
    )
  }
  return cache.get(fileId)
}

export default function AuthImage({ value, alt = '', ...imgProps }) {
  const dataUrl = value?.dataUrl || null
  const fileId = value?.fileId || null

  const [src, setSrc] = useState(dataUrl)
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  // Defer fetching file-backed images until they scroll into view.
  useEffect(() => {
    if (!fileId || dataUrl) return
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [fileId, dataUrl])

  useEffect(() => {
    if (dataUrl) { setSrc(dataUrl); return }
    if (!fileId || !visible) return
    let cancelled = false
    loadFile(fileId)
      .then((url) => { if (!cancelled) setSrc(url) })
      .catch(() => { if (!cancelled) setSrc(null) })
    return () => { cancelled = true }
  }, [fileId, dataUrl, visible])

  if (!fileId && !dataUrl) return null

  // Keep a mountable node (for the observer) even before the src resolves.
  if (!src) {
    return <span ref={ref} aria-hidden className={imgProps.className} />
  }
  return <img ref={ref} src={src} alt={alt} {...imgProps} />
}
