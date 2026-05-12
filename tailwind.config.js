/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI Variable',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Cascadia Mono',
          'Consolas',
          'Liberation Mono',
          'Menlo',
          'monospace',
        ],
      },
      colors: {
        brand: {
          DEFAULT: '#FF3E00',
          50: '#FFEAE0',
          100: '#FFD1BD',
          500: '#FF3E00',
          600: '#E03500',
          700: '#B82B00',
        },
        ink: {
          950: '#050505',
          900: '#0A0A0B',
          800: '#0F0F11',
          700: '#15151A',
          600: '#1C1C22',
          500: '#26262E',
          400: '#3A3A45',
        },
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
