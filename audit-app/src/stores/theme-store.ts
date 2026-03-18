import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

type ThemeMode = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  isDark: boolean
  toggle: () => void
  setMode: (mode: ThemeMode) => void
  init: () => Promise<void>
  colors: {
    bg: string
    bgSecondary: string
    card: string
    cardBorder: string
    text: string
    textSecondary: string
    textMuted: string
    tabBar: string
    statusBar: string
    statusText: string
    statusTextMuted: string
    inputBg: string
    inputBorder: string
    separator: string
  }
}

const LIGHT_COLORS = {
  bg: '#f5f5f4',
  bgSecondary: '#fff',
  card: '#fff',
  cardBorder: '#e7e5e4',
  text: '#1c1917',
  textSecondary: '#78716c',
  textMuted: '#a8a29e',
  tabBar: '#ffffff',
  statusBar: '#ffffff',
  statusText: '#1c1917',
  statusTextMuted: '#78716c',
  inputBg: '#f5f5f4',
  inputBorder: '#d6d3d1',
  separator: '#e7e5e4',
}

const DARK_COLORS = {
  bg: '#1c1917',
  bgSecondary: '#2d2a28',
  card: '#2d2a28',
  cardBorder: '#3f3b39',
  text: '#f5f5f4',
  textSecondary: '#a8a29e',
  textMuted: '#78716c',
  tabBar: '#0c0a09',
  statusBar: '#1c1917',
  statusText: '#ffffff',
  statusTextMuted: 'rgba(255,255,255,0.5)',
  inputBg: '#3f3b39',
  inputBorder: '#57534e',
  separator: '#3f3b39',
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  isDark: false,
  colors: LIGHT_COLORS,

  toggle: () => {
    const newMode = get().mode === 'light' ? 'dark' : 'light'
    const colors = newMode === 'dark' ? DARK_COLORS : LIGHT_COLORS
    AsyncStorage.setItem('theme-mode', newMode)
    set({ mode: newMode, isDark: newMode === 'dark', colors })
  },

  setMode: (mode: ThemeMode) => {
    const colors = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS
    AsyncStorage.setItem('theme-mode', mode)
    set({ mode, isDark: mode === 'dark', colors })
  },

  init: async () => {
    try {
      const saved = await AsyncStorage.getItem('theme-mode')
      if (saved === 'dark' || saved === 'light') {
        const colors = saved === 'dark' ? DARK_COLORS : LIGHT_COLORS
        set({ mode: saved, isDark: saved === 'dark', colors })
      }
    } catch {
      // Default light
    }
  },
}))
