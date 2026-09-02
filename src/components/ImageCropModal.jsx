import { useEffect, useRef, useState, useCallback } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import Modal from './Modal.jsx'
import { useT } from '../i18n/LanguageContext.jsx'

const VIEWPORT_SIZE = 280 // on-screen crop circle, px
const OUTPUT_SIZE = 480   // exported square image, px

// Circular avatar cropper: drag to pan, slider to zoom. Always exports a
// square JPEG at OUTPUT_SIZE regardless of the source image's aspect ratio.
export default function ImageCropModal({ file, onCancel, onSave }) {
  const { t } = useT()
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const dragRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      setReady(true)
    }
    img.onerror = () => setError(t('profile.avatarError'))
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file, t])

  const baseScale = useCallback(() => {
    const img = imgRef.current
    if (!img) return 1
    return Math.max(VIEWPORT_SIZE / img.width, VIEWPORT_SIZE / img.height)
  }, [])

  // Keep the image covering the full circle — offset can't drag past the
  // point where a blank edge would show.
  const clampOffset = useCallback((next, z) => {
    const img = imgRef.current
    if (!img) return { x: 0, y: 0 }
    const scale = baseScale() * z
    const maxX = Math.max(0, (img.width * scale - VIEWPORT_SIZE) / 2)
    const maxY = Math.max(0, (img.height * scale - VIEWPORT_SIZE) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }, [baseScale])

  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !ready) return
    const ctx = canvas.getContext('2d')
    const scale = baseScale() * zoom
    ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE)
    ctx.save()
    ctx.translate(VIEWPORT_SIZE / 2 + offset.x, VIEWPORT_SIZE / 2 + offset.y)
    ctx.scale(scale, scale)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()
  }, [zoom, offset, ready, baseScale])

  function onZoomChange(e) {
    const z = Number(e.target.value)
    setZoom(z)
    setOffset((o) => clampOffset(o, z))
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: offset }
  }
  function onPointerMove(e) {
    if (!dragRef.current) return
    const { startX, startY, origin } = dragRef.current
    setOffset(clampOffset({ x: origin.x + (e.clientX - startX), y: origin.y + (e.clientY - startY) }, zoom))
  }
  function onPointerUp(e) {
    dragRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* already released */ }
  }

  async function handleSave() {
    const img = imgRef.current
    if (!img) return
    setSaving(true)
    setError('')
    try {
      const out = document.createElement('canvas')
      out.width = OUTPUT_SIZE
      out.height = OUTPUT_SIZE
      const ctx = out.getContext('2d')
      const ratio = OUTPUT_SIZE / VIEWPORT_SIZE
      const scale = baseScale() * zoom * ratio
      ctx.save()
      ctx.translate(OUTPUT_SIZE / 2 + offset.x * ratio, OUTPUT_SIZE / 2 + offset.y * ratio)
      ctx.scale(scale, scale)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()
      const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('export failed')
      await onSave(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
    } catch {
      setError(t('profile.avatarError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onCancel} title={t('profile.cropTitle')}>
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative rounded-full overflow-hidden border border-shadow bg-iron touch-none cursor-grab active:cursor-grabbing"
          style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <canvas ref={canvasRef} width={VIEWPORT_SIZE} height={VIEWPORT_SIZE} />
        </div>

        <div className="flex items-center gap-3 w-full">
          <ZoomOut className="w-4 h-4 text-graphite shrink-0" />
          <input
            className="range flex-1"
            type="range"
            min="1" max="3" step="0.01"
            value={zoom}
            style={{ '--pct': `${((zoom - 1) / 2) * 100}%` }}
            onChange={onZoomChange}
            disabled={!ready}
            aria-label={t('profile.zoom')}
          />
          <ZoomIn className="w-4 h-4 text-graphite shrink-0" />
        </div>

        <p className="text-xs text-graphite text-center">{t('profile.cropHint')}</p>
        {error && <p className="text-xs text-rose-600 text-center">{error}</p>}

        <div className="flex gap-2 w-full pt-1">
          <button
            type="button" onClick={handleSave} disabled={!ready || saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-near-black text-white font-semibold py-2.5 text-sm disabled:opacity-60"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button
            type="button" onClick={onCancel}
            className="rounded-full border border-shadow font-semibold py-2.5 px-4 text-sm"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
