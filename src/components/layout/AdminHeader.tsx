'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface Props { title: string }

export function AdminHeader({ title }: Props) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6 shadow-sm">
      <h1 className="font-semibold text-green-900">{title}</h1>
      <Button variant="ghost" size="sm" onClick={logout} className="text-green-700">
        <LogOut size={16} className="mr-1" /> Salir
      </Button>
    </header>
  )
}
