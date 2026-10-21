/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          950: '#082F49',
        },
        slate: {
          850: '#151F32',
          950: '#090D16',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft-sm': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'soft': '0 2px 8px -2px rgba(15, 23, 42, 0.06), 0 1px 4px -1px rgba(15, 23, 42, 0.04)',
        'soft-lg': '0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03)',
        'soft-xl': '0 16px 36px -6px rgba(15, 23, 42, 0.12), 0 8px 16px -4px rgba(15, 23, 42, 0.06)',
      }
    },
  },
  plugins: [],
}
