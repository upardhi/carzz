import type { Config } from 'tailwindcss';

/**
 * Carz Management design tokens.
 *
 * The palette is taken from the FleetGuard reference screens (deep navy shell,
 * gold accent) blended with the car-wash prototype (teal as the primary action
 * colour). Everything in the UI is expressed with these semantic names so a
 * rebrand is a change to this file, not a sweep through components.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Shell / chrome
        navy: {
          950: '#08171f',
          900: '#0f1e2a',
          850: '#12202c',
          800: '#16293a',
          700: '#1b2f3f',
          600: '#2b4759',
          500: '#41606f',
        },
        // Primary action colour
        teal: {
          50: '#f0fbfb',
          100: '#d5f2f0',
          200: '#b8e5e5',
          300: '#4fd1d1',
          400: '#2cc0c0',
          500: '#00aaaa',
          600: '#0a8f8f',
          700: '#08706e',
        },
        // Accent — highlights, active nav, brand marks
        gold: {
          50: '#fffaf0',
          100: '#fbe9cf',
          200: '#f0dcb4',
          300: '#e3b063',
          400: '#f0b429',
          500: '#e9a825',
          600: '#a9720f',
          700: '#8a5410',
        },
        danger: {
          50: '#fff5f5',
          100: '#fadcdc',
          300: '#e08d8d',
          500: '#b53b3b',
          600: '#962626',
        },
        success: {
          50: '#eefaf4',
          100: '#cdeee0',
          500: '#0b6b4f',
          600: '#085840',
        },
        // Content surfaces
        ink: {
          DEFAULT: '#12202c',
          soft: '#5d7684',
          mute: '#6b8492',
          faint: '#8ba5b6',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f2f6f8',
          sunken: '#eef3f5',
          raised: '#e5edf1',
        },
        line: {
          DEFAULT: '#dde7ec',
          soft: '#eef3f5',
          strong: '#cfdbe1',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '12px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(18,32,44,.06), 0 1px 3px rgba(18,32,44,.05)',
        raised: '0 8px 24px rgba(8,23,31,.12)',
        float: '0 14px 40px rgba(0,0,0,.45)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'fade-up': 'fade-up .22s ease-out both' },
    },
  },
  plugins: [],
};

export default config;
