import { useEffect } from 'react'
import { X } from 'lucide-react'

const SIZE_CLASS = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
}

export default function Modal({ open, onClose, title, size = 'md', children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${sizeClass} bg-charcoal text-white border border-white/15 rounded-t-3xl sm:rounded-3xl shadow-xl mx-auto p-5 max-h-[92vh] overflow-y-auto animate-[slideUp_0.18s_ease-out]`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="font-display text-xl md:text-2xl text-white"
            style={{ letterSpacing: '0.01em' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 text-white rounded-full"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  )
}
