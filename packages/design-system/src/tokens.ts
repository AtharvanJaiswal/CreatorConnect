/**
 * CreatorConnect Design Tokens
 * Single source of truth for design tokens, themes, and CSS variables across microfrontends.
 */

export const colors = {
  light: {
    background: 'hsl(40, 33%, 97%)', // Warm cream #FAF7F2
    foreground: 'hsl(0, 0%, 7%)', // Rich black #121212
    card: 'hsl(43, 44%, 98%)', // Warm white #FDFBF7
    cardForeground: 'hsl(0, 0%, 7%)',
    popover: 'hsl(43, 44%, 98%)',
    popoverForeground: 'hsl(0, 0%, 7%)',
    primary: 'hsl(45, 100%, 61%)', // CreatorConnect Signature Yellow #FFCE38
    primaryForeground: 'hsl(0, 0%, 7%)',
    secondary: 'hsl(38, 33%, 94%)', // Soft beige #F3EFE6
    secondaryForeground: 'hsl(0, 0%, 7%)',
    muted: 'hsl(38, 33%, 94%)',
    mutedForeground: 'hsl(36, 8%, 42%)', // Soft charcoal #6E685F
    accent: 'hsl(255, 77%, 94%)', // Soft lavender #EAE4FB
    accentForeground: 'hsl(260, 50%, 25%)',
    destructive: 'hsl(0, 84.2%, 60.2%)',
    destructiveForeground: 'hsl(210, 40%, 98%)',
    success: 'hsl(142.1, 76.2%, 36.3%)', // Emerald #27AE60
    successForeground: 'hsl(355.7, 100%, 97.3%)',
    warning: 'hsl(45, 100%, 61%)', // CreatorConnect Warm Amber
    warningForeground: 'hsl(0, 0%, 7%)',
    border: 'hsl(36, 21%, 89%)', // Soft border #EBE5DB
    input: 'hsl(36, 21%, 89%)',
    ring: 'hsl(45, 100%, 61%)',
  },
  dark: {
    background: 'hsl(224, 71%, 4%)', // Deep modern obsidian
    foreground: 'hsl(210, 40%, 98%)',
    card: 'hsl(224, 71%, 6%)',
    cardForeground: 'hsl(210, 40%, 98%)',
    popover: 'hsl(224, 71%, 6%)',
    popoverForeground: 'hsl(210, 40%, 98%)',
    primary: 'hsl(243, 85%, 68%)', // Electric Indigo
    primaryForeground: 'hsl(222.2, 47.4%, 1.2%)',
    secondary: 'hsl(217.2, 32.6%, 17.5%)',
    secondaryForeground: 'hsl(210, 40%, 98%)',
    muted: 'hsl(217.2, 32.6%, 17.5%)',
    mutedForeground: 'hsl(215, 20.2%, 65.1%)',
    accent: 'hsl(270, 75%, 65%)',
    accentForeground: 'hsl(210, 40%, 98%)',
    destructive: 'hsl(0, 62.8%, 30.6%)',
    destructiveForeground: 'hsl(210, 40%, 98%)',
    success: 'hsl(142.1, 70.6%, 45.3%)',
    successForeground: 'hsl(144.9, 80.4%, 10%)',
    warning: 'hsl(43, 96%, 56%)',
    warningForeground: 'hsl(26, 83%, 14%)',
    border: 'hsl(217.2, 32.6%, 17.5%)',
    input: 'hsl(217.2, 32.6%, 17.5%)',
    ring: 'hsl(243, 85%, 68%)',
  },
} as const;

export const radii = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  glow: '0 0 25px -5px hsl(243, 75%, 59% / 0.3)',
} as const;

export const typography = {
  fontFamily: {
    sans: 'var(--font-sans, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    heading: 'var(--font-heading, "Outfit", "Inter", sans-serif)',
    serif: 'var(--font-serif, "Newsreader", "Playfair Display", Georgia, serif)',
    mono: 'var(--font-mono, "JetBrains Mono", monospace)',
  },
} as const;
