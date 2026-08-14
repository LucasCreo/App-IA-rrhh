'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'No se pudo restablecer la contraseña')
      return
    }
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">Link inválido.</p>
        <Link href="/login" className="text-sm text-green-700 dark:text-green-400 hover:underline">Volver al login</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm">
        {done ? (
          <div className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-green-700 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Contraseña actualizada</h2>
            <p className="text-sm text-muted-foreground">Te vamos a redirigir al login…</p>
          </div>
        ) : (
          <>
            <Link href="/login" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ArrowLeft size={13} /> Volver al login
            </Link>
            <h2 className="text-2xl font-bold text-foreground mb-2">Nueva contraseña</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Elegí una nueva contraseña para tu cuenta.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="h-10"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 border border-red-200 dark:border-red-900">
                  <span>⚠</span> {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-10 bg-green-700 hover:bg-green-800 text-white"
                disabled={loading}
              >
                {loading ? 'Guardando…' : 'Restablecer contraseña'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
