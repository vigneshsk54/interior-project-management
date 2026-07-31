export const theme = {
  brand: '#7C5CFF',
  brandSecondary: '#8B6CFF',
  brandLight: '#9B8CFF',
  app: '#0B1020',
  subtle: '#111827',
  panel: '#171F33',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  textMuted: 'rgba(255, 255, 255, 0.50)',
} as const

export const chartColors = [
  theme.brand,
  theme.brandSecondary,
  theme.brandLight,
  'rgba(124, 92, 255, 0.78)',
  'rgba(139, 108, 255, 0.68)',
  'rgba(155, 140, 255, 0.58)',
] as const

export const chartTooltipStyle = {
  backgroundColor: theme.panel,
  border: `1px solid ${theme.border}`,
  borderRadius: 12,
  color: theme.text,
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.28)',
} as const
