'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Mail, Eye, EyeOff,
  LayoutDashboard, Users, Newspaper, FileText, Receipt,
  CalendarDays, ClipboardList, Plane, Settings, Search, Bell,
} from 'lucide-react'

const MOCK_MODULES = [
  { label: 'Dashboard',    icon: LayoutDashboard },
  { label: 'Legajos',      icon: Users },
  { label: 'Avisos',       icon: Newspaper },
  { label: 'Documentos',   icon: FileText },
  { label: 'Recibos',      icon: Receipt, badge: 3 },
  { label: 'Calendario',   icon: CalendarDays },
  { label: 'Solicitudes',  icon: ClipboardList, badge: 2 },
  { label: 'Licencias',    icon: Plane },
  { label: 'Configuración', icon: Settings },
]

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
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
        body: JSON.stringify({ identifier, password, remember }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
        setLoading(false)
        return
      }
      const next = searchParams.get('next')
      const defaultDest = data.role === 'ADMIN' ? '/admin' : '/empleado'
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
    <div className="min-h-screen bg-background">
      <div className="w-full min-h-screen bg-card overflow-hidden grid md:grid-cols-2">

        {/* LEFT: form */}
        <div className="flex flex-col p-8 md:p-12">
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-14">
            <div className="w-8 h-8 rounded-lg bg-green-700 flex items-center justify-center text-white font-bold text-sm">L</div>
            <span className="text-lg font-semibold text-foreground">LPA · Recursos Humanos</span>
          </div>

          {/* Form block, centered vertically */}
          <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
            <h1 className="text-2xl font-semibold text-foreground">Iniciá sesión en tu cuenta</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Ingresá tus credenciales para continuar</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="identifier">Usuario o email</Label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="legajo o usuario@empresa.com"
                    required
                    className="h-10 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-foreground/80 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="w-3.5 h-3.5 accent-green-700 rounded"
                  />
                  Recordarme por 30 días
                </label>
                <Link href="/olvide-password" className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
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
                {loading ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-10">
            © {new Date().getFullYear()} LPA · Sistema interno
          </p>
        </div>

        {/* RIGHT: brand panel + tablet mockup */}
        <div className="hidden md:block relative overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-green-900 text-white p-12">
          {/* Ambient blob */}
          <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-emerald-400/30 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
               style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

          {/* Header brand inside panel */}
          <div className="relative flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-lg font-bold">L</div>
            <span className="text-xl font-bold tracking-tight">LPA</span>
          </div>

          {/* Headline */}
          <h2 className="relative text-3xl lg:text-4xl font-bold leading-tight max-w-md">
            Toda la gestión<br />de tu equipo,<br />en un solo lugar.
          </h2>

          {/* Tablet mockup — tilted */}
          <div
            className="absolute -bottom-16 -right-24 w-[620px] pointer-events-none"
            style={{ transform: 'perspective(1600px) rotateY(-16deg) rotateX(8deg) rotateZ(-5deg)', transformOrigin: 'center' }}
          >
            <TabletMock />
          </div>

        </div>
      </div>
    </div>
  )
}

function TabletMock() {
  return (
    <div className="rounded-[26px] p-2 bg-neutral-900 shadow-[0_25px_60px_-10px_rgba(0,0,0,0.5)]">
      <div className="rounded-[20px] overflow-hidden bg-neutral-50 flex" style={{ height: 420, width: '100%' }}>
        {/* Sidebar */}
        <div className="w-44 shrink-0 bg-white border-r border-neutral-200 flex flex-col">
          <div className="h-11 flex items-center gap-2 px-3 border-b border-neutral-200">
            <div className="w-6 h-6 rounded-md bg-green-700 flex items-center justify-center text-white text-[10px] font-bold">L</div>
            <span className="text-xs font-semibold text-neutral-800">LPA</span>
          </div>
          <div className="p-2 space-y-0.5 overflow-hidden flex-1">
            {MOCK_MODULES.map((m, i) => {
              const active = i === 0
              return (
                <div
                  key={m.label}
                  className={
                    'flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] ' +
                    (active
                      ? 'bg-green-100 text-green-800 font-medium'
                      : 'text-neutral-600')
                  }
                >
                  <m.icon size={12} />
                  <span className="flex-1 truncate">{m.label}</span>
                  {m.badge && (
                    <span className="inline-flex items-center justify-center h-3.5 min-w-3.5 px-1 rounded-full bg-green-600 text-white text-[9px] font-bold">
                      {m.badge}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0 bg-neutral-50 flex flex-col">
          {/* Topbar */}
          <div className="h-11 flex items-center justify-between px-4 border-b border-neutral-200 bg-white">
            <div className="flex items-center gap-2 flex-1 max-w-[220px]">
              <Search size={11} className="text-neutral-400" />
              <div className="h-1.5 flex-1 bg-neutral-200 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Bell size={12} className="text-neutral-500" />
              <div className="w-5 h-5 rounded-full bg-green-700 text-white text-[9px] font-bold flex items-center justify-center">LC</div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 space-y-3 overflow-hidden">
            <div className="text-[11px] font-semibold text-neutral-700">Panel de control</div>
            {/* KPI cards */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Legajos', value: '128', color: 'bg-blue-500' },
                { label: 'Recibos', value: '92', color: 'bg-green-600' },
                { label: 'Solicitudes', value: '14', color: 'bg-amber-500' },
                { label: 'Licencias', value: '6', color: 'bg-violet-500' },
              ].map(k => (
                <div key={k.label} className="rounded-md border border-neutral-200 bg-white p-2">
                  <div className={'w-4 h-1 rounded-full mb-1.5 ' + k.color} />
                  <div className="text-sm font-bold text-neutral-800 leading-none">{k.value}</div>
                  <div className="text-[9px] text-neutral-500 mt-1 truncate">{k.label}</div>
                </div>
              ))}
            </div>
            {/* Chart placeholder */}
            <div className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="flex items-end gap-1.5 h-20">
                {[35, 55, 40, 70, 62, 88, 74, 60, 82, 50, 68, 90].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-green-600 to-green-400 rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            {/* List rows */}
            <div className="rounded-md border border-neutral-200 bg-white divide-y divide-neutral-100">
              {[
                { name: 'Martínez, Sofía', tag: 'Recibo firmado' },
                { name: 'Gómez, Ana',     tag: 'Solicitud pendiente' },
                { name: 'Pereyra, Juan',  tag: 'Licencia aprobada' },
              ].map(r => (
                <div key={r.name} className="flex items-center justify-between px-2.5 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-4 h-4 rounded-full bg-neutral-200" />
                    <span className="text-[10px] font-medium text-neutral-700 truncate">{r.name}</span>
                  </div>
                  <span className="text-[9px] text-neutral-500 shrink-0">{r.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
