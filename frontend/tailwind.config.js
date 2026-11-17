/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['Poppins', 'Inter', 'sans-serif'] },
      colors: {
        // Theme-aware colours: their values come from CSS variables that change with light / dark mode.
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface2) / <alpha-value>)',
        navy: 'rgb(var(--navy) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        side: '#0D0B3F',
        brand: { 50: 'rgb(var(--brand-50) / <alpha-value>)', 100: 'rgb(var(--brand-100) / <alpha-value>)', 200: 'rgb(var(--brand-200) / <alpha-value>)', 400: '#5B82EC', 500: '#3566E0', 600: '#2456D6', 700: '#1B43AD', 800: '#16337F' },
        sun: { 50: 'rgb(var(--sun-50) / <alpha-value>)', 500: '#F27A21', 600: '#D9640F' },
        leaf: { 50: 'rgb(var(--leaf-50) / <alpha-value>)', 500: '#17965C', 600: '#127A4A' },
        rose: { 50: 'rgb(var(--rose-50) / <alpha-value>)', 600: '#C8322B' },
      },
      boxShadow: { soft: '0 10px 30px -12px rgba(36,86,214,0.18)', lift: '0 18px 40px -14px rgba(36,86,214,0.32)' },
      keyframes: {
        blob: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '33%': { transform: 'translate(30px,-40px) scale(1.08)' }, '66%': { transform: 'translate(-25px,20px) scale(0.94)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        marquee: { '100%': { transform: 'translateX(-50%)' } },
      },
      animation: { blob: 'blob 14s ease-in-out infinite', shimmer: 'shimmer 1.6s infinite', floaty: 'floaty 6s ease-in-out infinite', marquee: 'marquee 28s linear infinite' },
    },
  },
  plugins: [],
}
