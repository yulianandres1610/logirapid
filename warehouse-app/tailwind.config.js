/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './index.js',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff4eb',
          100: '#ffe4cc',
          200: '#ffc999',
          300: '#ffab66',
          400: '#fb923c',
          500: '#eb5b0c',
          600: '#d14f09',
          700: '#b34308',
          800: '#9a3412',
          900: '#7c2d12',
        },
        dark: {
          50: '#f5f5f4',
          100: '#e7e5e4',
          200: '#d6d3d1',
          300: '#a8a29e',
          400: '#78716c',
          500: '#57534e',
          600: '#3f3b39',
          700: '#2d2a28',
          800: '#1c1917',
          900: '#0c0a09',
        },
      },
    },
  },
  plugins: [],
};
