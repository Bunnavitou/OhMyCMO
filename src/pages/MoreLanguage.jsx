import { Check, Globe } from 'lucide-react'
import { useT } from '../i18n/LanguageContext.jsx'

export default function MoreLanguage() {
  const { lang, setLang, languages, t } = useT()

  return (
    <div className="space-y-3">
      <section className="card flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
          <Globe className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{t('language.title')}</p>
          <p className="text-xs text-graphite">{t('language.choose')}</p>
        </div>
      </section>

      <ul className="card divide-y divide-shadow p-0">
        {languages.map((l) => {
          const selected = l.code === lang
          return (
            <li key={l.code}>
              <button
                onClick={() => setLang(l.code)}
                className={`w-full flex items-center gap-3 p-3 md:p-4 text-left active:bg-iron hover:bg-iron ${
                  selected ? 'bg-mint-bg' : ''
                }`}
                aria-pressed={selected}
              >
                <span className="w-9 h-9 rounded-full bg-iron text-near-black flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                  {l.code}
                </span>
                <span className="flex-1 min-w-0">
                  <p className="text-sm md:text-base font-semibold text-near-black">
                    {l.native}
                  </p>
                  {l.native !== l.label && (
                    <p className="text-[11px] text-graphite">{l.label}</p>
                  )}
                </span>
                {selected && <Check className="w-5 h-5 text-wise-dark" />}
              </button>
            </li>
          )
        })}
      </ul>

      <p className="text-[11px] text-graphite text-center pt-1">
        {t('language.changedNote')}
      </p>
      <p className="text-[11px] text-graphite text-center">
        {t('language.disclaimer')}
      </p>
    </div>
  )
}
