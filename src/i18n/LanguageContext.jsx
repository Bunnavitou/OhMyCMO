import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { messages, SUPPORTED_LANGUAGES } from './messages.js'

const STORAGE_KEY = 'ohmycmo:lang'
const FALLBACK = 'en'

const LanguageContext = createContext(null)

function detectInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && messages[saved]) return saved
  } catch {
    // localStorage may be unavailable in some sandboxed contexts
  }
  // Match the first 2 chars of the browser language against supported list.
  const browser = (typeof navigator !== 'undefined' && navigator.language) || ''
  const code = browser.slice(0, 2).toLowerCase()
  return messages[code] ? code : FALLBACK
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitial)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang) } catch {
      // ignore — translation still works in memory
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  const setLang = useCallback((next) => {
    if (messages[next]) setLangState(next)
  }, [])

  // t(key) → translated string.
  // t(key, vars) → with {placeholder} substitution.
  // For pluralization, pass `count` and append `_one`/`_other` to your key:
  //   t('customer.openTasks', { count: 3 })  -> uses key 'customer.openTasks_other'
  const t = useCallback(
    (key, vars) => {
      const dict = messages[lang] || messages[FALLBACK]
      const fb = messages[FALLBACK]
      let lookup = key
      if (vars && typeof vars.count === 'number') {
        const suffix = vars.count === 1 ? '_one' : '_other'
        if ((key + suffix) in dict || (key + suffix) in fb) lookup = key + suffix
      }
      let str = lookup in dict ? dict[lookup] : (fb[lookup] ?? key)
      if (vars) {
        if (typeof vars.count === 'number' && !('n' in vars)) vars = { ...vars, n: vars.count }
        str = str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`))
      }
      return str
    },
    [lang],
  )

  const value = useMemo(
    () => ({ lang, setLang, t, languages: SUPPORTED_LANGUAGES }),
    [lang, setLang, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useT() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useT must be used within LanguageProvider')
  return ctx
}
