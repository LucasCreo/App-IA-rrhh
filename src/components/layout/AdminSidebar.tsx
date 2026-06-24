'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, FileText, Settings, ClipboardList, ChevronLeft, ChevronRight, Receipt, CalendarDays, LogOut, Sun, Moon, Star, Menu, X, ClipboardCheck } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, permiso: 'VER_DASHBOARD' },
  { href: '/admin/empleados', label: 'Legajos', icon: Users, permiso: 'GESTIONAR_EMPLEADOS' },
  { href: '/admin/documentos', label: 'Documentos', icon: FileText, permiso: 'GESTIONAR_DOCUMENTOS' },
  { href: '/admin/recibos', label: 'Recibos', icon: Receipt, permiso: 'GESTIONAR_LOTES' },
  { href: '/admin/calendario', label: 'Calendario', icon: CalendarDays, permiso: 'GESTIONAR_CALENDARIO' },
  { href: '/admin/evaluaciones', label: 'Evaluaciones', icon: Star, permiso: 'GESTIONAR_EVALUACIONES' },
  { href: '/admin/formularios', label: 'Formularios', icon: ClipboardCheck, permiso: 'GESTIONAR_FORMULARIOS' },
  { href: '/admin/auditoria', label: 'Auditoría', icon: ClipboardList, permiso: 'VER_AUDITORIA' },
]

const navBottom = [
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings, permiso: 'GESTIONAR_CONFIGURACION' },
]

interface Props {
  appName?: string
  logoUrl?: string | null
  userEmail?: string
  avatarUrl?: string | null
  pendingModificaciones?: number
  pendingSolicitudes?: number
  permisos?: string[] | null // null = full access
}

export function AdminSidebar({ appName = 'RRHH', logoUrl, userEmail, avatarUrl, pendingModificaciones = 0, pendingSolicitudes = 0, permisos = null }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const visibleNav = permisos === null ? nav : nav.filter(item => permisos.includes(item.permiso))
  const visibleNavBottom = permisos === null ? navBottom : navBottom.filter(item => permisos.includes(item.permiso))

  useEffect(() => { setMobileOpen(false) }, [pathname])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-30 bg-background border-b border-border flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Menu size={20} />
        </button>
        {logoUrl && <img src={logoUrl} alt="" className="h-6 w-auto object-contain" />}
        <span className="font-bold text-sm text-foreground">{appName}</span>
      </div>

      {/* Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

    <aside className={cn(
      'fixed inset-y-0 left-0 z-50 flex flex-col bg-background border-r border-border overflow-hidden',
      'transition-all duration-200 shrink-0',
      'md:sticky md:top-0 md:h-screen md:z-auto md:translate-x-0',
      mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      collapsed ? 'w-60 md:w-16' : 'w-60',
    )}>
        <div className={cn('flex items-center border-b border-border py-5', collapsed ? 'md:justify-center px-2 md:px-2' : 'justify-between px-4')}>
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              {logoUrl && <img src={logoUrl} alt="" className="h-6 w-auto object-contain shrink-0" />}
              <span className="text-base font-bold tracking-tight truncate text-foreground">{appName}</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden md:block p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  collapsed && 'justify-center',
                  active
                ? 'bg-green-100 text-green-700 font-medium dark:bg-green-950/40 dark:text-green-400'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && label}
                {!collapsed && href === '/admin/empleados' && pendingModificaciones > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 text-yellow-900 text-xs font-bold px-1">
                    {pendingModificaciones}
                  </span>
                )}
                {collapsed && href === '/admin/empleados' && pendingModificaciones > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-yellow-400" />
                )}
                {!collapsed && href === '/admin/documentos' && pendingSolicitudes > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 text-yellow-900 text-xs font-bold px-1">
                    {pendingSolicitudes}
                  </span>
                )}
                {collapsed && href === '/admin/documentos' && pendingSolicitudes > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-yellow-400" />
                )}
              </Link>
            )
          })}
        </nav>
        {visibleNavBottom.length > 0 && (
          <div className="px-2 pb-2 space-y-1">
            {visibleNavBottom.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    collapsed && 'justify-center',
                    active
                      ? 'bg-green-100 text-green-700 font-medium dark:bg-green-950/40 dark:text-green-400'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && label}
                </Link>
              )
            })}
          </div>
        )}
        {/* User profile section */}
        <div className={cn(
          'border-t border-border py-3 mt-auto',
          collapsed ? 'px-2 flex flex-col items-center gap-2' : 'px-3 flex items-center gap-2'
        )}>
          <Link
            href="/admin/perfil"
            title={collapsed ? 'Mi perfil' : undefined}
            className={cn('flex items-center gap-2 min-w-0 flex-1 rounded-md hover:bg-muted transition-colors', collapsed ? 'justify-center p-1.5' : 'px-1.5 py-1')}
          >
            <div className="h-8 w-8 rounded-full overflow-hidden bg-green-100 dark:bg-green-950/40 flex items-center justify-center font-bold text-xs text-green-700 dark:text-green-400 uppercase select-none shrink-0">
              {avatarUrl
                ? <img src={`/api/auth/avatar?file=${avatarUrl}`} alt="" className="w-full h-full object-cover" />
                : (userEmail ? userEmail.slice(0, 2).toUpperCase() : 'U')}
            </div>
            {!collapsed && (
              <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">{userEmail}</p>
            )}
          </Link>
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  )
}
