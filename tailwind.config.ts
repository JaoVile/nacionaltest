import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        serif:   ['var(--font-display)', 'Georgia', 'serif'],
      },
      fontSize: {
        'display':   ['clamp(2.5rem, 4vw + 1rem, 4.25rem)', { lineHeight: '1',    letterSpacing: '-0.02em'  }],
        'h-page':    ['clamp(1.75rem, 2vw + 1rem, 2.5rem)', { lineHeight: '1.1',  letterSpacing: '-0.015em' }],
        'h-section': ['1.125rem',                            { lineHeight: '1.35', letterSpacing: '-0.005em' }],
      },
      colors: {
        // Light: branco com subtom azul claro + acentos vivos.
        // Dark : deep blue + marfim suavizado + accent caridoso (trabalho noturno).
        accent: {
          DEFAULT:     '#2563EB', // blue-600 — vivo (light)
          soft:        '#3B82F6', // blue-500 — hover (light)
          glow:        '#60A5FA', // blue-400 — glow base
          deep:        '#3B5BDB', // suavizado (era blue-700) — não machuca olhos no dark
          'deep-soft': '#5571E5', // hover dark
        },
        // Subtom azul claro pra surfaces/hovers no light. Tailwind sky default cobre o resto.
        mist: {
          50:  '#F7FAFE', // bg ultra sutil
          100: '#EEF4FB', // hover/seleção
          200: '#DCE8F6', // border tinted
        },
        ivory: {
          50:  '#FBF8EF',
          100: '#F5ECD3',
          200: '#EDE4D3',
          300: '#E0D3B4', // novo padrão de body text no dark (mais carinhoso que ivory-200)
          400: '#CBBE99',
          500: '#A79B78',
        },
        deep: {
          50:  '#1F2A3F',
          100: '#17203A',
          200: '#121A31',
          300: '#0C1427',
          400: '#070D1C',
        },
      },
      transitionTimingFunction: {
        'out-expo':   'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-back':   'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out-smooth': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      boxShadow: {
        'elev-1': '0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.02)',
        'elev-2': '0 4px 12px -2px rgba(15,23,42,0.06), 0 2px 4px -1px rgba(15,23,42,0.04)',
        'elev-3': '0 12px 32px -8px rgba(15,23,42,0.12), 0 4px 10px -2px rgba(15,23,42,0.05)',
        // Light: glow azul mais saturado (vivacidade)
        'glow-accent':      '0 0 0 1px rgba(37,99,235,0.40), 0 12px 32px -8px rgba(37,99,235,0.50)',
        'glow-accent-soft': '0 0 0 1px rgba(37,99,235,0.20), 0 6px 18px -6px rgba(37,99,235,0.30)',
        // Dark: glow mais comportado, opacidade reduzida pra não cansar a vista
        'glow-deep':        '0 0 0 1px rgba(59,91,219,0.28), 0 10px 28px -10px rgba(59,91,219,0.38)',
      },
      keyframes: {
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.55' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
        'shimmer': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'float':      'float 3.2s ease-in-out infinite',
        'shimmer':    'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
