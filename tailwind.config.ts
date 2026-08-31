import type { Config } from 'tailwindcss';

/**
 * Carz Management design tokens, taken from the supplied reference screens.
 *
 * The system is deep blue navy + gold, not navy + teal:
 *   - navy   is the shell AND the primary action colour (the "Sign in" button
 *            and the action cards in the reference are solid navy blue)
 *   - gold   is the accent — the active sidebar item, the highlight line in
 *            the hero copy, the brand mark
 *   - green  marks positive state (the "Exited" pill), orange marks an exit
 *            or outbound action, red marks a problem
 *
 * Everything in the UI is expressed with these semantic names, so a rebrand is
 * a change to this file rather than a sweep through components.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Shell, chrome and primary actions
        navy: {
          50: '#f1f6fb',
          100: '#e1ebf5',
          200: '#c3d8ec',
          300: '#8fb3d9',
          400: '#5b8cbe',
          500: '#3a6ea5',
          600: '#22558a',
          700: '#17456f',
          800: '#123a63',
          850: '#0e2748',
          900: '#0a1f3d',
          950: '#061529',
        },
        // Accent — active nav, brand highlight, "needs a decision"
        gold: {
          50: '#fff9ec',
          100: '#fcefd2',
          200: '#f7e3b5',
          300: '#fad98a',
          400: '#f5c453',
          500: '#e8a317',
          600: '#b87a0f',
          700: '#8a5a0b',
        },
        // Positive state
        success: {
          50: '#eef8f3',
          100: '#dcf2e4',
          200: '#b6e3ce',
          500: '#0f8560',
          600: '#0b6b4f',
          700: '#07553d',
        },
        // Outbound / exit actions
        orange: {
          50: '#fdf3ea',
          100: '#fae2cd',
          500: '#c85e0d',
          600: '#b4530a',
          700: '#8d4108',
        },
        danger: {
          50: '#fef3f2',
          100: '#f8dad8',
          300: '#e39a95',
          500: '#b3261e',
          600: '#8f1d18',
        },
        // Content
        ink: {
          DEFAULT: '#10233d',
          soft: '#4a5f7a',
          mute: '#64788f',
          faint: '#8fa3b8',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f4f7fa',
          sunken: '#eef3f8',
          raised: '#e3eaf2',
        },
        line: {
          DEFAULT: '#dce5ef',
          soft: '#edf2f7',
          strong: '#c8d5e3',
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
        card: '0 1px 2px rgba(16,35,61,.06), 0 1px 3px rgba(16,35,61,.05)',
        raised: '0 8px 24px rgba(6,21,41,.14)',
        float: '0 14px 40px rgba(6,21,41,.45)',
      },
      backgroundImage: {
        // The faint grid the reference screens carry over their navy panels.
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
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'fade-up': 'fade-up .22s ease-out both' },
    },
  },
  plugins: [],
};

export default config;
