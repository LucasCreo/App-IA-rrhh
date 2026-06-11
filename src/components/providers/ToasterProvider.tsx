'use client'
import { Toaster } from 'sonner'
import { useTheme } from './ThemeProvider'
export function ToasterProvider() {
  const { theme } = useTheme()
  return <Toaster richColors theme={theme} position="top-right" />
}
