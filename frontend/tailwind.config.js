/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#08090d',
          900: '#0b0d13',
          850: '#0e1016',
          800: '#12141c',
          750: '#161922',
          700: '#1b1f2a',
          600: '#252a39',
          500: '#323849',
          400: '#444c61',
          300: '#5d6781',
          200: '#828ca8',
          100: '#aab2c8',
          50: '#d6dbe8',
        },
        brand: {
          50: '#ecfdf6',
          100: '#d1fae8',
          200: '#a6f3d4',
          300: '#6ee8bb',
          400: '#34d59c',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        accent: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        warn: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        err: {
          400: '#f87171',
          500: '#ef4444',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(16,185,129,0.18), 0 8px 30px -8px rgba(16,185,129,0.35)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 2px 0 rgba(0,0,0,0.6), 0 8px 24px -12px rgba(0,0,0,0.8)',
        pop: '0 20px 50px -20px rgba(0,0,0,0.9)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
        'radial-fade':
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.12), transparent 60%)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
