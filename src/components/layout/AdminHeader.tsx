'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props { title: string }

export function AdminHeader({ title }: Props) {
  const router = useRouter()
  const { theme, toggle } = useTheme()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6">
      <h1 className="font-semibold text-green-900 dark:text-green-400">{title}</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggle} className="text-green-700 dark:text-green-400">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
        <Button variant="ghost" size="sm" onClick={logout} className="text-green-700 dark:text-green-400">
          <LogOut size={16} className="mr-1" /> Salir
        </Button>
      </div>
    </header>
  )
}
