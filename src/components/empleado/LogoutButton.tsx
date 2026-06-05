'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }
  return (
    <Button variant="ghost" size="sm" onClick={logout} className="text-white hover:text-white hover:bg-green-800">
      <LogOut size={16} className="mr-1" /> Salir
    </Button>
  )
}
