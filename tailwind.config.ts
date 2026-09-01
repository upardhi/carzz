import type { Config } from 'tailwindcss';

/**
 * Carzz — FleetGuard Design System tokens.
 *
 * Colors, fonts and shape tokens are defined here. Changing a value here
 * cascades through every component that uses the Tailwind class.
 *
 * Surface/text/border CSS custom properties and utility classes (glass,
 * shimmer, radial-glow-brand, etc.) live in globals.css — single source of
 * truth for the design system. Tailwind classes here reference those same
 * values so Tailwind utilities and arbitrary CSS stay in sync.
 *
 * Palette mapping (old name -> FleetGuard value):
 *   navy    -> brand  (deep navy command-center blues)
 *   gold    -> accent (amber premium highlight)
 *   success -> success (emerald, updated shades)
 *   danger  -> danger (rose, updated shades)
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand — deep navy spectrum (maps to old navy-*)
        navy: {
          50:  '#f0f5fb',
          100: '#dae7f4',
          200: '#b6cfe8',
          300: '#84adda',
          400: '#4f86c6',
          500: '#2f66ae',
          600: '#214f92',
          700: '#1b4078',
          800: '#163363',
          850: '#112848',
          900: '#0f2347',
          950: '#081429',
        },
        // Accent — amber/gold (maps to old gold-*)
        gold: {
          50:  '#fffaeb',
          100: '#fef0c7',
          200: '#fde08a',
          300: '#fbc84c',
          400: '#fab224',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Success — emerald
        success: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
        },
        // Warning — amber semantic alias
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Danger — rose
        danger: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
        },
        // Ink — content text
        ink: {
          DEFAULT: '#0f172a',
          soft:    '#475569',
          mute:    '#64748b',
          faint:   '#94a3b8',
        },
        // Surface
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#eef2f7',
          sunken:  '#f5f7fa',
          raised:  '#e2e8f0',
        },
        // Border
        line: {
          DEFAULT: '#e2e8f0',
          soft:    '#f1f5f9',
          strong:  '#cbd5e1',
        },
      },

      fontFamily: {
        sans:    ['var(--font-geist-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
        mono:    ['var(--font-geist-mono)', 'ui-monospace', 'SF Mono', 'Roboto Mono', 'Menlo', 'monospace'],
        display: ['var(--font-geist-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },

      borderRadius: {
        card: '12px',
        pill: '999px',
      },

      boxShadow: {
        card:   '0 1px 2px rgba(15,35,71,.06), 0 1px 3px rgba(15,35,71,.05)',
        raised: '0 8px 24px rgba(8,20,41,.14)',
        float:  '0 14px 40px rgba(8,20,41,.45)',
      },

      backgroundImage: {
        'navy-grid':
          'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)',
      },

      backgroundSize: {
        grid: '44px 44px',
      },

      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(16px)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition:  '400px 0' },
        },
        'pulse-ring': {
          '0%':   { boxShadow: '0 0 0 0 rgba(16,185,129,0.55)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(16,185,129,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0)' },
        },
      },

      animation: {
        'fade-up':    'fade-up 220ms ease-out both',
        'slide-in':   'slide-in-right 220ms ease-out both',
        shimmer:      'shimmer 1.6s linear infinite',
        'pulse-ring': 'pulse-ring 2s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
