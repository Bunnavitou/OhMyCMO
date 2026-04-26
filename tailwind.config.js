/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand — Wise Green primary (used for CTAs)
        brand: {
          50:  '#F4FCEA',
          100: '#E2F6D5',  // light mint
          200: '#CDFFAD',  // pastel green
          300: '#B6F390',
          400: '#A8EE7E',
          500: '#9FE870',  // signature Wise Green
          600: '#7EC25A',
          700: '#5A8C40',
          800: '#163300',  // dark green (button text on green)
          900: '#0A1F00',
        },

        // Canvas + surfaces — flipped to light Wise palette.
        // Token names are kept for source-compatibility with prior themes.
        abyss:    '#FFFFFF',  // canvas (page bg)
        iron:     '#F7F9F5',  // softest surface, hover tint
        charcoal: '#FFFFFF',  // primary card surface (white with ring)
        shadow:   '#0E0F0C1F', // 12% near-black border ring
        graphite: '#454745',  // warm-dark — secondary text
        ash:      '#868685',  // wise gray — muted text
        steel:    '#868685',  // muted text alias
        muted:    '#454745',  // alias for warm-dark
        'near-black': '#0E0F0C',
        'warm-dark':  '#454745',

        // Wise semantic accents
        mint:           '#9FE870',  // alias of brand-500 (Wise Green)
        'mint-edge':    '#163300',  // dark-green stroke on green elements
        'mint-bg':      '#E2F6D5',  // soft mint surface
        'pastel-green': '#CDFFAD',  // hover accent
        'wise-green':   '#9FE870',
        'wise-dark':    '#163300',

        // Semantic states
        positive: '#054D28',
        danger:   '#D03238',
        warning:  '#FFD11A',
        'cyan-bg': 'rgba(56,200,255,0.10)',
        'orange-warm': '#FFC091',

        // Legacy Verge tokens — remapped, kept for compatibility
        ultraviolet:   '#5200FF',
        'purple-rule': '#3D00BF',
        pulse:         '#1EAEDB',
        link:          '#163300',
        'link-hover':  '#054D28',

        // Saturated tile palette (Home workspace blocks)
        tile: {
          mint:   '#9FE870',
          green:  '#CDFFAD',
          ivory:  '#F4F1E9',
          peach:  '#FFC091',
          sky:    'rgba(56,200,255,0.18)',
          dark:   '#163300',
        },
      },

      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
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
