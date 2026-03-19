import { create } from 'zustand'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  isDark: boolean
  setMode: (mode: ThemeMode) => void
}

function getSystemDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function computeIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') return getSystemDark()
  return mode === 'dark'
}

function applyTheme(isDark: boolean) {
  const root = document.documentElement
  if (isDark) {
    root.classList.add('dark')
    root.setAttribute('data-theme', 'dark')
  } else {
    root.classList.remove('dark')
    root.setAttribute('data-theme', 'light')
  }
}

const savedMode = (localStorage.getItem('theme') as ThemeMode) || 'light'
const initialIsDark = computeIsDark(savedMode)
applyTheme(initialIsDark)

export const useThemeStore = create<ThemeState>((set) => ({
  mode: savedMode,
  isDark: initialIsDark,
  setMode: (mode: ThemeMode) => {
    const isDark = computeIsDark(mode)
    localStorage.setItem('theme', mode)
    applyTheme(isDark)
    set({ mode, isDark })
  },
}))

// 监听系统主题变化（仅在 system 模式下生效）
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = useThemeStore.getState()
    if (state.mode === 'system') {
      const isDark = getSystemDark()
      applyTheme(isDark)
      useThemeStore.setState({ isDark })
    }
  })
}
