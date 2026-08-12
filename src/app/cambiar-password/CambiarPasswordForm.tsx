'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CambiarPasswordForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (newPassword !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d?.error ?? 'No se pudo cambiar la contraseña')
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cur">Contraseña temporal</Label>
        <Input id="cur" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new">Nueva contraseña</Label>
        <Input id="new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cnf">Confirmar nueva contraseña</Label>
        <Input id="cnf" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} className="h-10" />
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 border border-red-200 dark:border-red-900">
          <span>⚠</span> {error}
        </div>
      )}
      <Button type="submit" className="w-full h-10 bg-green-700 hover:bg-green-800 text-white" disabled={loading}>
        {loading ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  )
}
