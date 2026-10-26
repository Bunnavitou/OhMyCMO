import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useT } from '../i18n/LanguageContext.jsx'
import useScrollLock from '../hooks/useScrollLock.js'

const SIZE_CLASS = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
}

export default function Modal({ open, onClose, title, size = 'md', children }) {
  const { t } = useT()
  useScrollLock(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md
  // Portal to <body> so the page's layout (e.g. a space-y-* parent's margin) can't offset the overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-near-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${sizeClass} bg-white text-near-black border border-shadow mx-auto p-5 max-h-[92vh] overflow-y-auto overscroll-contain rounded-feature shadow-ring animate-[slideUp_0.18s_ease-out]`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="display text-xl md:text-2xl text-near-black">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-iron text-near-black rounded-full transition-transform hover:scale-105 active:scale-95"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>,
    document.body,
  )
}
