/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#0B1020',
        subtle: '#111827',
        panel: '#171F33',
        brand: {
          DEFAULT: '#7C5CFF',
          secondary: '#8B6CFF',
          light: '#9B8CFF',
        },
        content: {
          DEFAULT: '#FFFFFF',
          secondary: 'rgba(255, 255, 255, 0.72)',
          muted: 'rgba(255, 255, 255, 0.50)',
        },
        line: 'rgba(255, 255, 255, 0.08)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.18), 0 16px 40px rgba(0,0,0,.18)',
        elevated: '0 24px 64px rgba(0,0,0,.32)',
        glow: '0 0 0 1px rgba(124,92,255,.12), 0 18px 48px rgba(124,92,255,.10)',
      },
      borderRadius: {
        card: '18px',
      },
      transitionDuration: {
        220: '220ms',
      },
    },
  },
  plugins: [],
}
