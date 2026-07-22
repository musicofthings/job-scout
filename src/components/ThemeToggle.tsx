import type { Theme } from '../lib/theme'

interface Props {
  theme: Theme
  onChange: (theme: Theme) => void
}

export function ThemeToggle({ theme, onChange }: Props) {
  const next: Theme = theme === 'light' ? 'dark' : 'light'
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => onChange(next)}
      title={`Switch to ${next} theme`}
      aria-label={`Switch to ${next} theme`}
      aria-pressed={theme === 'dark'}
    >
      <span className="theme-toggle-icon" aria-hidden>
        {theme === 'light' ? '☀' : '☾'}
      </span>
      <span className="theme-toggle-label">{theme === 'light' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
