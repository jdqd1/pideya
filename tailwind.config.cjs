/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#F5F9F8',
          100: '#EBF3F1',
          200: '#DDEBE7',
          300: '#C8E0D9',
          400: '#AFC8BF', // Principal
          500: '#AFC8BF', // Main color
          600: '#8FA69F', // Hover
          700: '#6E8C83',
          800: '#517368',
          900: '#38524A',
        },
        primary: {
          DEFAULT: '#AFC8BF',
          50: '#F5F9F8',
          100: '#EBF3F1',
          200: '#DDEBE7',
          300: '#C8E0D9',
          400: '#AFC8BF',
          500: '#AFC8BF', // Main button color
          600: '#8FA69F',
          700: '#6E8C83',
          800: '#517368',
          900: '#38524A',
        },
        secondary: {
          DEFAULT: '#6A3A30',
          50: '#FFFBEA',
          100: '#FFFBEA',
          200: '#EADBC8',
          300: '#D4BBA6', // Base
          400: '#986B5A',
          500: '#6A3A30',
          600: '#5A3129',
          700: '#4A2822',
          800: '#3A1F1A',
          900: '#2A1613',
        },
        tertiary: '#F7F581',
        gold: '#F7DD81',
        slate: {
          brand: '#8B8DA2',
          ...require('tailwindcss/colors').slate,
        },
        cocoa: '#120a07',
      },
      boxShadow: {
        card: '0 12px 35px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}
