export type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'danger'

export interface DesignTokens {
  color: Record<
    Tone | 'bg' | 'card' | 'cardStrong' | 'border' | 'text' | 'muted',
    string
  >
  radius: Record<'sm' | 'md' | 'lg' | 'pill', string>
  spacing: Record<'xs' | 'sm' | 'md' | 'lg', string>
  shadow: Record<'soft' | 'hard', string>
  font: {
    base: string
    display: string
  }
  motion: {
    quick: string
    base: string
    easing: string
  }
}

export const designTokens: DesignTokens = {
  color: {
    primary: '#f59e0b',
    accent: '#22d3ee',
    success: '#22c55e',
    warning: '#facc15',
    danger: '#ef4444',
    bg: '#0f172a',
    card: '#111827',
    cardStrong: '#0c1324',
    border: '#1f2937',
    text: '#f8fafc',
    muted: '#cbd5e1',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '18px',
    pill: '999px',
  },
  spacing: {
    xs: '6px',
    sm: '10px',
    md: '14px',
    lg: '18px',
  },
  shadow: {
    soft: '0 10px 30px rgba(0, 0, 0, 0.22)',
    hard: '0 20px 60px rgba(0, 0, 0, 0.35)',
  },
  font: {
    base: "'Inter', 'Space Grotesk', system-ui, -apple-system, sans-serif",
    display: "'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif",
  },
  motion: {
    quick: '120ms',
    base: '220ms',
    easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  },
}
