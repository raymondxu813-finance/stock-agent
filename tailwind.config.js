/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          page: 'var(--color-bg-page)',
          card: 'var(--color-bg-card)',
          bubble: 'var(--color-bg-bubble)',
          input: 'var(--color-bg-input)',
          hover: 'var(--color-bg-hover)',
          empty: 'var(--color-bg-empty)',
        },
        content: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          placeholder: 'var(--color-text-placeholder)',
          icon: 'var(--color-text-icon)',
          heading: 'var(--color-text-heading)',
        },
        line: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
          dashed: 'var(--color-border-dashed)',
        },
      },
      keyframes: {
        fadeSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-slide-in': 'fadeSlideIn 0.35s ease-out both',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
