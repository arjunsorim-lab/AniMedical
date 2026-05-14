/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    screens: {
      xs:  '360px',   /* small phones (Galaxy S, iPhone SE) */
      sm:  '640px',
      md:  '768px',
      lg:  '1024px',
      xl:  '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        gold: {
          DEFAULT: '#3B82F6',
          dark:    '#1D4ED8',
          light:   '#BFDBFE',
          muted:   '#60A5FA',
        },
        background: {
          DEFAULT:   '#0B0B0F',
          secondary: '#101015',
        },
        surface: {
          DEFAULT:  '#1A1A1F',
          hover:    '#222228',
          elevated: '#252530',
        },
        danger: {
          DEFAULT: '#EF4444',
          glow:    'rgba(239,68,68,0.3)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInScale: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        gradientShift: {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        typingDot: {
          '0%, 60%, 100%': { transform: 'translateY(0)',   opacity: '0.4' },
          '30%':            { transform: 'translateY(-6px)', opacity: '1'   },
        },
        pulseBeat: {
          '0%, 100%': { transform: 'scale(1)',    opacity: '1'   },
          '50%':       { transform: 'scale(1.05)', opacity: '0.8' },
        },
        ripple: {
          '0%':   { transform: 'scale(0.8)', opacity: '0.6' },
          '100%': { transform: 'scale(2.2)', opacity: '0'   },
        },
      },
      animation: {
        'fade-in':       'fadeIn 0.25s ease-out',
        'fade-in-up':    'fadeInUp 0.4s ease-out',
        'fade-in-scale': 'fadeInScale 0.2s cubic-bezier(0.16,1,0.3,1) forwards',
        'gradient-shift':'gradientShift 3s ease infinite',
        'typing-dot':    'typingDot 1.2s infinite',
        'pulse-beat':    'pulseBeat 1.5s infinite',
        'spin-slow':     'spin 1s linear infinite',
      },
      backgroundSize: {
        '200': '200% 200%',
      },
    },
  },
  plugins: [],
};
