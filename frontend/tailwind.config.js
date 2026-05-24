/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // GitHub-dark inspired neutral palette
        canvas: {
          DEFAULT: '#0D1117',
          subtle: '#161B22',
          inset: '#010409',
        },
        border: {
          DEFAULT: '#30363D',
          muted: '#21262D',
          subtle: '#1C2128',
        },
        fg: {
          DEFAULT: '#F0F6FC',
          muted: '#9CA3AF',
          subtle: '#6B7280',
          onEmphasis: '#ffffff',
        },
        accent: {
          DEFAULT: '#58A6FF',
          emphasis: '#1F6FEB',
          muted: 'rgba(88,166,255,0.12)',
          subtle: 'rgba(88,166,255,0.06)',
        },
        success: {
          DEFAULT: '#3FB950',
          emphasis: '#238636',
          muted: 'rgba(63,185,80,0.12)',
          subtle: 'rgba(63,185,80,0.06)',
        },
        warning: {
          DEFAULT: '#D29922',
          emphasis: '#9E6A03',
          muted: 'rgba(210,153,34,0.12)',
          subtle: 'rgba(210,153,34,0.06)',
        },
        danger: {
          DEFAULT: '#F85149',
          emphasis: '#DA3633',
          muted: 'rgba(248,81,73,0.12)',
          subtle: 'rgba(248,81,73,0.06)',
        },
        // Keep legacy names for backward compat with existing components
        primary: {
          50: '#f0f6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#7cacf8',
          500: '#58A6FF',
          600: '#1F6FEB',
          700: '#1a5ccc',
          800: '#1e4499',
          900: '#1e3a7a',
          950: '#0d1f45',
        },
        dark: {
          900: '#0D1117',
          800: '#161B22',
          700: '#1C2128',
          600: '#21262D',
          500: '#30363D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'wave': 'wave 1.2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.5)' },
          '50%': { transform: 'scaleY(1.4)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'overlay': '0 8px 24px rgba(1,4,9,0.8)',
        'panel': '0 0 0 1px #30363D',
        'focus': '0 0 0 3px rgba(88,166,255,0.3)',
        'accent-sm': '0 0 0 1px rgba(88,166,255,0.4)',
        'inset': 'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      backgroundImage: {
        'grid-subtle': 'linear-gradient(rgba(48,54,61,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(48,54,61,0.3) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '32px 32px',
      },
    },
  },
  plugins: [],
};
