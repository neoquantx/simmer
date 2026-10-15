/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FFF8F0',
          50: '#FFFAF5',
          100: '#FFF8F0',
          200: '#FCECDA',
          300: '#F9DEC2',
        },
        tomato: {
          DEFAULT: '#E4572E',
          dark: '#C7411B',
          light: '#F56E47',
          soft: '#FDEEE9',
        },
        basil: {
          DEFAULT: '#4C956C',
          dark: '#387352',
          light: '#65B188',
          soft: '#EEF6F1',
        },
        charcoal: {
          DEFAULT: '#2B2B2B',
          muted: '#635F5B',
          light: '#8E8883',
          border: '#EADFD5',
        },
        amber: {
          DEFAULT: '#E09F3E',
          soft: '#FCF5E9',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', '-apple-system', 'sans-serif'],
        nunito: ['Nunito', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(43, 43, 43, 0.07), 0 2px 6px -1px rgba(43, 43, 43, 0.04)',
        hover: '0 8px 30px -4px rgba(43, 43, 43, 0.12), 0 4px 10px -2px rgba(43, 43, 43, 0.06)',
        lift: '0 12px 36px -6px rgba(228, 87, 46, 0.2)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
