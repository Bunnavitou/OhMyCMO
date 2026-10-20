import twColors from 'tailwindcss/colors'
import { brand, neutral, status } from './src/theme/colors.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Values come from src/theme/colors.js — change colours there.
        brand,

        // Canvas + surfaces. Token names are kept for source-compatibility
        // with prior themes, so several are aliases of the same value.
        abyss:        neutral.white,   // canvas (page bg)
        iron:         neutral.iron,    // softest surface, hover tint
        charcoal:     neutral.white,   // primary card surface (white with ring)
        shadow:       neutral.shadow,  // 12% near-black border ring
        graphite:     neutral.graphite, // secondary text
        ash:          neutral.ash,     // muted text
        steel:        neutral.ash,
        muted:        neutral.graphite,
        'near-black': neutral['near-black'],
        'warm-dark':  neutral.graphite,

        // Wise accents — aliases of the brand scale
        mint:           brand[500],
        'mint-edge':    brand[800],
        'mint-bg':      brand[100],
        'pastel-green': brand[200],
        'wise-green':   brand[500],
        'wise-dark':    brand[800],

        // Status scales (bg-danger-100, text-success-700 …), each a Tailwind
        // palette picked in theme/colors.js. danger / warning keep their
        // original single-shade DEFAULT for text-danger / bg-warning.
        danger:  { DEFAULT: '#D03238', ...twColors[status.danger] },
        success: twColors[status.success],
        warning: { DEFAULT: '#FFD11A', ...twColors[status.warning] },
        info:    twColors[status.info],
        accent:  twColors[status.accent],
        neutral: twColors[status.neutral],
        positive: '#054D28',
        'cyan-bg': 'rgba(56,200,255,0.10)',
        'orange-warm': '#FFC091',

        // Legacy Verge tokens — remapped, kept for compatibility
        ultraviolet:   '#5200FF',
        'purple-rule': '#3D00BF',
        pulse:         '#1EAEDB',
        link:          brand[800],
        'link-hover':  '#054D28',

        // Saturated tile palette (Home workspace blocks)
        tile: {
          mint:   brand[500],
          green:  brand[200],
          ivory:  '#F4F1E9',
          peach:  '#FFC091',
          sky:    'rgba(56,200,255,0.18)',
          dark:   brand[800],
        },
      },

      fontFamily: {
        // Inter handles Latin; Noto Sans KR fills in Korean glyphs even on
        // English screens. The :lang(ko) rule in index.css promotes Noto
        // to the front of the stack when the UI is in Korean.
        sans:    ['Inter', '"Noto Sans KR"', 'ui-sans-serif', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Inter', '"Noto Sans KR"', 'ui-sans-serif', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        mono:    ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      letterSpacing: {
        tightest: '-.04em',
        tighter:  '-.02em',
        wider:    '.05em',
        widest:   '.15em',
      },

      borderRadius: {
        badge:    '2px',
        toggle:   '20px',
        card:     '16px',
        feature:  '30px',
        section:  '40px',
        pill:     '9999px',
      },

      boxShadow: {
        ring:        '0 0 0 1px rgba(14, 15, 12, 0.12)',
        'ring-soft': '0 0 0 1px rgba(14, 15, 12, 0.08)',
        'ring-mint': '0 0 0 1px #9FE870',
        'inset-focus': 'inset 0 0 0 1px rgba(134, 134, 133, 1)',
      },
    },
  },
  plugins: [],
}
