import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './src/components/ui/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        /* Terminal palette — alpha-modifier friendly */
        'tm-bg':      'hsl(var(--tm-bg) / <alpha-value>)',
        'tm-bg-sunk': 'hsl(var(--tm-bg-sunk) / <alpha-value>)',
        'tm-bg-el':   'hsl(var(--tm-bg-el) / <alpha-value>)',
        'tm-bd':      'hsl(var(--tm-bd) / <alpha-value>)',
        'tm-bd-st':   'hsl(var(--tm-bd-st) / <alpha-value>)',
        'tm-tx':      'hsl(var(--tm-tx) / <alpha-value>)',
        'tm-tx-dim':  'hsl(var(--tm-tx-dim) / <alpha-value>)',
        'tm-tx-mut':  'hsl(var(--tm-tx-mut) / <alpha-value>)',
        'tm-sx':      'hsl(var(--tm-sx) / <alpha-value>)',
        'tm-poly':    'hsl(var(--tm-poly) / <alpha-value>)',
        'tm-pos':     'hsl(var(--tm-pos) / <alpha-value>)',
        'tm-neg':     'hsl(var(--tm-neg) / <alpha-value>)',
        'tm-warn':    'hsl(var(--tm-warn) / <alpha-value>)',
      },
      fontFamily: {
        mono: ['var(--tm-font-mono)'],
        ui:   ['var(--tm-font-ui)'],
        sans: ['var(--tm-font-ui)'],
      },
      borderRadius: {
        lg: 'var(--tm-rad-lg)',
        md: 'var(--tm-rad)',
        sm: '2px',
      },
      animation: {
        'tm-pulse': 'tm-pulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
