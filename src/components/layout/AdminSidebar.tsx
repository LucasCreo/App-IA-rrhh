'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, FileText, Settings, ClipboardList, ChevronLeft, ChevronRight, Receipt, CalendarDays, LogOut, Sun, Moon, Star, Menu, X, GripVertical, UserCircle, Newspaper } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { AvatarDisplay } from '@/components/shared/AvatarDisplay'
import { EVALUACIONES_ENABLED } from '@/lib/features'

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, permiso: 'VER_DASHBOARD' },
  { href: '/admin/empleados', label: 'Legajos', icon: Users, permiso: 'GESTIONAR_EMPLEADOS' },
  { href: '/admin/portal', label: 'Avisos', icon: Newspaper, permiso: 'VER_DASHBOARD' },
  { href: '/admin/documentos', label: 'Documentos', icon: FileText, permiso: 'GESTIONAR_DOCUMENTOS' },
  { href: '/admin/recibos', label: 'Recibos', icon: Receipt, permiso: 'GESTIONAR_LOTES' },
  { href: '/admin/calendario', label: 'Calendario', icon: CalendarDays, permiso: 'GESTIONAR_CALENDARIO' },
  ...(EVALUACIONES_ENABLED ? [{ href: '/admin/evaluaciones', label: 'Evaluaciones', icon: Star, permiso: 'GESTIONAR_EVALUACIONES' }] : []),
  { href: '/admin/solicitudes', label: 'Solicitudes', icon: ClipboardList, permiso: 'GESTIONAR_SOLICITUDES' },
]
const NAV_DASHBOARD = nav[0]
const NAV_DRAGGABLE = nav.slice(1)

const navBottom = [
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings, permiso: 'GESTIONAR_CONFIGURACION' },
]

interface Props {
  appName?: string
  logoUrl?: string | null
  userEmail?: string
  avatarUrl?: string | null
  avatarBgColor?: string | null
  avatarTextColor?: string | null
  pendingModificaciones?: number
  pendingSolicitudes?: number
  permisos?: string[] | null // null = full access
  hasEmployeeId?: boolean
}

export function AdminSidebar({ appName = 'RRHH', logoUrl, userEmail, avatarUrl, avatarBgColor, avatarTextColor, pendingModificaciones = 0, pendingSolicitudes = 0, permisos = null, hasEmployeeId = false }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navOrder, setNavOrder] = useState<string[]>(() => NAV_DRAGGABLE.map(n => n.href))
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin-nav-order')
      if (!saved) return
      const parsed = JSON.parse(saved) as string[]
      const current = NAV_DRAGGABLE.map(n => n.href)
      setNavOrder([...parsed.filter(h => current.includes(h)), ...current.filter(h => !parsed.includes(h))])
    } catch {}
  }, [])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const visibleDashboard = permisos === null || permisos.includes(NAV_DASHBOARD.permiso) ? NAV_DASHBOARD : null
  const orderedDraggable = navOrder
    .map(href => NAV_DRAGGABLE.find(n => n.href === href)!)
    .filter(Boolean)
    .filter(item => permisos === null || permisos.includes(item.permiso))
  const visibleNavBottom = permisos === null ? navBottom : navBottom.filter(item => permisos.includes(item.permiso))

  function handleDrop() {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null); setDragOverIdx(null); return
    }
    const reordered = [...orderedDraggable]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(dragOverIdx, 0, moved)
    const visibleHrefs = reordered.map(n => n.href)
    const hiddenHrefs = navOrder.filter(h => !visibleHrefs.includes(h))
    const newOrder = [...visibleHrefs, ...hiddenHrefs]
    setNavOrder(newOrder)
    localStorage.setItem('admin-nav-order', JSON.stringify(newOrder))
    setDragIdx(null); setDragOverIdx(null)
  }

  useEffect(() => { setMobileOpen(false) }, [pathname])

  const [avisosUnread, setAvisosUnread] = useState(0)
  const [badges, setBadges] = useState<{ recibos?: number; documentos?: number }>({})
  useEffect(() => {
    let cancel = false
    const load = () => {
      fetch('/api/portal/posts/unread-count')
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => { if (!cancel) setAvisosUnread(d.count ?? 0) })
        .catch(() => {})
      fetch('/api/badges')
        .then(r => r.ok ? r.json() : {})
        .then(d => { if (!cancel) setBadges(d ?? {}) })
        .catch(() => {})
    }
    load()
    const int = setInterval(load, 60_000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { cancel = true; clearInterval(int); window.removeEventListener('focus', onFocus) }
  }, [pathname])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="print:hidden md:hidden fixed top-0 left-0 right-0 h-14 z-30 bg-background border-b border-border flex items-center px-4 gap-3">
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
      'print:hidden fixed inset-y-0 left-0 z-50 flex flex-col bg-background border-r border-border overflow-hidden',
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
          {/* Dashboard — fixed, not draggable */}
          {visibleDashboard && (() => {
            const { href, label, icon: Icon } = visibleDashboard
            const active = pathname === '/admin'
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  collapsed && 'justify-center',
                  active ? 'bg-green-100 text-green-700 font-medium dark:bg-green-500/15 dark:text-green-300' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && label}
              </Link>
            )
          })()}
          {/* Draggable nav items */}
          {orderedDraggable.map(({ href, label, icon: Icon }, idx) => {
            const active = pathname.startsWith(href)
            return (
              <div
                key={href}
                draggable={!collapsed}
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(idx) }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverIdx !== idx) setDragOverIdx(idx) }}
                onDrop={e => { e.preventDefault(); handleDrop() }}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                className={cn('rounded-md transition-all', dragOverIdx === idx && dragIdx !== idx && 'ring-1 ring-green-400')}
                style={{ opacity: dragIdx === idx ? 0.4 : 1 }}
              >
                <Link
                  href={href}
                  draggable={false}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group',
                    collapsed && 'justify-center',
                    active ? 'bg-green-100 text-green-700 font-medium dark:bg-green-500/15 dark:text-green-300' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && <span className="flex-1">{label}</span>}
                  {!collapsed && href === '/admin/empleados' && pendingModificaciones > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 text-yellow-900 text-xs font-bold px-1">
                      {pendingModificaciones}
                    </span>
                  )}
                  {collapsed && href === '/admin/empleados' && pendingModificaciones > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-yellow-400" />
                  )}
                  {!collapsed && href === '/admin/solicitudes' && pendingSolicitudes > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 text-yellow-900 text-xs font-bold px-1">
                      {pendingSolicitudes}
                    </span>
                  )}
                  {collapsed && href === '/admin/solicitudes' && pendingSolicitudes > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-yellow-400" />
                  )}
                  {!collapsed && href === '/admin/portal' && avisosUnread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold px-1.5">
                      {avisosUnread > 99 ? '99+' : avisosUnread}
                    </span>
                  )}
                  {collapsed && href === '/admin/portal' && avisosUnread > 0 && (
                    <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {avisosUnread > 9 ? '9+' : avisosUnread}
                    </span>
                  )}
                  {!collapsed && href === '/admin/documentos' && (badges.documentos ?? 0) > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1.5" title="Documentos con error o rechazados">
                      {badges.documentos! > 99 ? '99+' : badges.documentos}
                    </span>
                  )}
                  {collapsed && href === '/admin/documentos' && (badges.documentos ?? 0) > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                  {!collapsed && href === '/admin/recibos' && (badges.recibos ?? 0) > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1.5" title="Lotes con documentos en error">
                      {badges.recibos! > 99 ? '99+' : badges.recibos}
                    </span>
                  )}
                  {collapsed && href === '/admin/recibos' && (badges.recibos ?? 0) > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                  {!collapsed && (
                    <GripVertical size={14} className="opacity-0 group-hover:opacity-30 shrink-0 cursor-grab active:cursor-grabbing" />
                  )}
                </Link>
              </div>
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
                      ? 'bg-green-100 text-green-700 font-medium dark:bg-green-500/15 dark:text-green-300'
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
            <AvatarDisplay
              iniciales={userEmail ? userEmail.slice(0, 2).toUpperCase() : 'U'}
              avatarUrl={avatarUrl}
              bgColor={avatarBgColor}
              textColor={avatarTextColor}
              size={32}
            />
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
          {hasEmployeeId && (
            <Link
              href="/empleado"
              title="Ir a mi portal de empleado"
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            >
              <UserCircle size={14} />
            </Link>
          )}
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
