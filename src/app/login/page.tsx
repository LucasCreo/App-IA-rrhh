'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }
    router.push(data.role === 'ADMIN' ? '/admin' : '/empleado')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-green-800 to-green-950 flex-col items-center justify-center p-12 text-white">
        <div className="text-6xl mb-6 select-none">📋</div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">RRHH</h1>
        <p className="text-green-200 text-center text-lg max-w-xs leading-relaxed">
          Gestión de Recursos Humanos.<br />
          Firma digital y documentación simplificada.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-3 w-full max-w-xs">
          {['Empleados', 'Documentos', 'Firma Digital', 'Auditoría'].map(f => (
            <div key={f} className="bg-white/10 rounded-lg p-3 text-center text-sm text-green-200">{f}</div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950 p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="text-4xl md:hidden mb-3 select-none">📋</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bienvenido</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ingresá tus credenciales para continuar</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
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
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
          <p className="mt-6 text-xs text-center text-muted-foreground">
            Demo: admin@empresa.com / admin123
          </p>
        </div>
      </div>
    </div>
  )
}
