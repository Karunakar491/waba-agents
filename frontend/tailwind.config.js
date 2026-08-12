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
        // of truth). brand.navy/brand.pink REMOVED 2026-08-12 (V2 rebrand
        // slice 8, final sweep) — grep for brand-navy/brand-pink across src/
        // returned zero real usages (only comment mentions), so the tracked
        // removal condition from slice 1 was met. brand.purple/green/dark
        // still have real call sites (--primary CSS var role, ClientCommandBar
        // risk dots, IconChip 'green' tone) and are out of scope for this sweep.
        brand: {
          purple: '#6B4EE6',
          green:  '#1EBA5D',
          dark:   '#1F1F1F',
        },
        // DESIGN.md V2 "Modern Minimal" tokens (2026-08-11 nav rebrand, slice 1).
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

