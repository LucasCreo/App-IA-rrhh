'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'

interface InvitationInfo {
  email: string
  nombre: string
  apellido: string
  expiresAt: string
}

export default function AceptarInvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [invalid, setInvalid] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/invitaciones/${token}`)
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          setInvalid(d?.error ?? 'Invitación inválida o expirada')
          return
        }
        setInfo(await r.json())
      })
      .finally(() => setChecking(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const res = await fetch(`/api/invitaciones/${token}/aceptar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim() || undefined, password }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.error ?? 'No se pudo aceptar la invitación')
      return
    }
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm">
        {checking ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : invalid ? (
          <div className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
              <XCircle size={26} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Invitación inválida</h2>
            <p className="text-sm text-muted-foreground">{invalid}</p>
            <Link href="/login" className="inline-block text-sm text-green-700 dark:text-green-400 hover:underline">Ir al login</Link>
          </div>
        ) : done ? (
          <div className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
              <CheckCircle2 size={26} className="text-green-700 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">¡Cuenta creada!</h2>
            <p className="text-sm text-muted-foreground">Te vamos a redirigir al login…</p>
          </div>
        ) : info && (
          <>
            <Link href="/login" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ArrowLeft size={13} /> Ir al login
            </Link>
            <h2 className="text-2xl font-bold text-foreground mb-2">Hola, {info.nombre}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Elegí un nombre de usuario y una contraseña para acceder al portal.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={info.email} disabled className="h-10 bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username">Usuario <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Ej: jperez"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
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
              <Button type="submit" className="w-full h-10 bg-green-700 hover:bg-green-800 text-white" disabled={loading}>
                {loading ? 'Creando cuenta…' : 'Crear mi cuenta'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
