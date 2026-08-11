/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Karix brand colors — must match DESIGN.md §1 exactly (single source
        // of truth). EL-caught gap (2026-08-07 audit): this config still had
        // the RETIRED navy (#160E7A, replaced by #11225F 2026-08-05) and the
        // wrong pink (#E73590 instead of #D6468F Karix Cranberry), and
        // brand-purple didn't exist as a Tailwind class at all despite
        // DESIGN.md documenting it and code already trying to reference it
        // (`ring-brand-purple/40`, `text-brand-purple`) — those classes were
        // silently no-ops. This is why the "retired navy" problem wasn't
        // just a stale --primary CSS variable; the underlying color itself
        // was never corrected.
        brand: {
          navy:   '#11225F',
          pink:   '#D6468F',
          purple: '#6B4EE6',
          green:  '#1EBA5D',
          dark:   '#1F1F1F',
        },
        // DESIGN.md V2 "Modern Minimal" tokens (2026-08-11 nav rebrand,
        // slice 1) — added ADDITIVELY alongside `brand.*` above, which stays
        // live until every one of its ~25 remaining call sites migrates
        // (tracked: grep for `brand-navy\|brand-pink` must hit zero before
        // those keys are ever removed). See DESIGN.md §2.
        ink: '#0A0A0A',
        'accent-teal': '#0D9488',
        'accent-teal-solid': '#0F766E',
        // WhatsApp UI constants — used ONLY to mimic real WhatsApp chrome in previews
        whatsapp: {
          header: '#075E54',
          canvas: '#ECE5DD',
          bubble: '#DCF8C6',
          ink:    '#111B21',
        },
        // Shadcn CSS variable tokens
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
        warning: 'hsl(var(--warning))',
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
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
}

