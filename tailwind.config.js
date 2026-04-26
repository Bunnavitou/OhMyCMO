/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand — Jelly Mint (Verge primary hazard accent)
        brand: {
          50:  '#E0FFF7',
          100: '#C2FFEC',
          200: '#94FFE2',
          300: '#5EFFD8',
          400: '#3CFFD0',
          500: '#3CFFD0',  // jelly mint signature
          600: '#2BD9B0',
          700: '#309875',  // console mint border
          800: '#1F6B51',
          900: '#0F3D2D',
        },
        // Surfaces
        abyss: '#131313',     // Canvas Black (default page surface)
        iron: '#1B1B1B',      // slightly elevated dark
        charcoal: '#2D2D2D',  // Surface Slate (secondary card)
        shadow: '#313131',    // Image-frame border
        // Neutrals
        graphite: '#494949',
        ash: '#8C8C8C',       // dim gray
        steel: '#949494',     // secondary text per spec
        muted: '#E9E9E9',     // button text on dark slate
        // Hazards & accents
        mint:        '#3CFFD0',
        'mint-edge': '#309875',
        ultraviolet: '#5200FF',
        'purple-rule': '#3D00BF',
        pulse:       '#1EAEDB',  // focus cyan
        link:        '#3860BE',
        'link-hover': '#3860BE',
        // Saturated story-tile fills (Verge's color-block palette)
        tile: {
          mint:   '#3CFFD0',
          purple: '#5200FF',
          yellow: '#FFE500',
          pink:   '#FF8AD8',
          orange: '#FF7A1A',
          blue:   '#4D6BFF',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Anton', '"Bebas Neue"', 'Impact', 'Helvetica', 'sans-serif'],
        mono: ['"Space Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-.04em',
        tighter: '-.02em',
        wider: '.05em',
        widest: '.15em',
        verge: '.18em',
      },
      borderRadius: {
        badge: '2px',
        toggle: '20px',
        pill: '24px',
        'pill-lg': '40px',
      },
      boxShadow: {
        // Verge's signature 1px inset underline (used on active tab/nav)
        'mint-underline':   'inset 0 -1px 0 0 #3CFFD0',
        'white-underline':  'inset 0 -1px 0 0 #FFFFFF',
        'purple-underline': 'inset 0 -1px 0 0 #5200FF',
        // The single atmospheric ring per spec
        'ring-soft': '0 0 0 1px rgba(0, 0, 0, 0.33)',
      },
    },
  },
  plugins: [],
}
