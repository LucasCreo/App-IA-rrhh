'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, FileText, PenLine, ShieldCheck } from 'lucide-react'

const FEATURES = [
  { icon: Users,       title: 'Gestión de empleados',  desc: 'Legajos, categorías y campos personalizados.' },
  { icon: FileText,    title: 'Recibos digitales',      desc: 'Carga masiva y entrega automática.' },
  { icon: PenLine,     title: 'Firma electrónica',      desc: 'Conformidad sin papel, con trazabilidad.' },
  { icon: ShieldCheck, title: 'Auditoría completa',     desc: 'Registro de cada acción en el sistema.' },
]

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
        setLoading(false)
        return
      }
      const next = searchParams.get('next')
      const defaultDest = data.role === 'ADMIN' ? '/admin' : '/empleado'
      // Validar que el next sea del rol correcto para evitar loop de redirección
      const target = next && next.startsWith('/') &&
        !(data.role === 'ADMIN' && next.startsWith('/empleado')) &&
        !(data.role === 'EMPLOYEE' && next.startsWith('/admin'))
        ? next
        : defaultDest
      router.push(target)
    } catch {
      setError('No se pudo conectar con el servidor')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div
        className="hidden md:flex md:w-1/2 flex-col justify-between p-12 text-white relative overflow-hidden animate-[gradient-shift_18s_ease_infinite]"
        style={{
          background: 'linear-gradient(135deg, #14532d 0%, #166534 30%, #15803d 55%, #166534 80%, #14532d 100%)',
          backgroundSize: '300% 300%',
        }}>

        {/* Ambient blobs */}
        <div className="absolute w-72 h-72 rounded-full bg-green-400 opacity-30 blur-3xl pointer-events-none animate-[blob-drift_14s_ease-in-out_infinite]"
          style={{ top: '-40px', left: '-60px' }} />
        <div className="absolute w-96 h-96 rounded-full bg-emerald-500 opacity-30 blur-3xl pointer-events-none animate-[blob-drift_14s_ease-in-out_infinite]"
          style={{ bottom: '-80px', right: '-100px', animationDelay: '-7s' }} />

        {/* Dot grid texture */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* Top: brand */}
        <div className="relative fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-lg font-bold tracking-tight">
              L
            </div>
            <span className="text-2xl font-bold tracking-wide">LPA</span>
          </div>
          <p className="text-green-300 text-sm">Recursos Humanos</p>
        </div>

        {/* Center: headline + features */}
        <div className="relative space-y-8">
          <div className="fade-in-up" style={{ animationDelay: '120ms' }}>
            <h2 className="text-4xl font-bold leading-tight mb-3">
              Toda la gestión<br />de tu equipo,<br />en un solo lugar.
            </h2>
            <p className="text-green-300 text-base max-w-xs leading-relaxed">
              Simplificá la administración de personal con firma digital y documentación centralizada.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <li
                key={title}
                className="flex items-start gap-3 fade-in-up group"
                style={{ animationDelay: `${260 + i * 100}ms` }}
              >
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 transition-all duration-300 group-hover:bg-white/20 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(134,239,172,0.35)]">
                  <Icon size={15} className="text-green-300 transition-colors group-hover:text-green-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{title}</p>
                  <p className="text-xs text-green-400 leading-snug mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: tagline */}
        <p className="relative text-xs text-green-500 fade-in-up" style={{ animationDelay: '700ms' }}>© {new Date().getFullYear()} LPA · Sistema interno</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950 p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="md:hidden flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-green-700 flex items-center justify-center text-white font-bold text-sm">L</div>
              <span className="text-lg font-bold text-green-800 dark:text-green-400">LPA</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bienvenido</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ingresá tus credenciales para continuar</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Usuario o email</Label>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="legajo o usuario@empresa.com"
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
              <div className="flex justify-end">
                <Link href="/olvide-password" className="text-xs text-green-700 dark:text-green-400 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
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
        </div>
      </div>
    </div>
  )
}
