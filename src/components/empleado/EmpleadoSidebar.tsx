'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, FileText, FolderOpen, CalendarDays, ChevronLeft, ChevronRight, LogOut, Sun, Moon, Menu, X, Shield, Newspaper, ClipboardList, GripVertical, IdCard } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { AvatarUpload } from '@/components/shared/AvatarUpload'

const NAV_INICIO = { href: '/empleado', label: 'Inicio', icon: LayoutDashboard }
const NAV_DRAGGABLE = [
  { href: '/empleado/mi-legajo', label: 'Mi Legajo', icon: IdCard },
  { href: '/empleado/portal', label: 'Avisos', icon: Newspaper },
  { href: '/empleado/recibos', label: 'Recibos', icon: FileText },
  { href: '/empleado/documentos', label: 'Documentos', icon: FolderOpen },
  { href: '/empleado/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/empleado/solicitudes', label: 'Solicitudes', icon: ClipboardList },
]

interface Props {
  appName?: string
  logoUrl?: string | null
  initials: string
  fullName: string
  avatarUrl?: string | null
  avatarBgColor?: string | null
  avatarTextColor?: string | null
  isAdmin?: boolean
}

export function EmpleadoSidebar({ appName = 'RRHH', logoUrl, initials, fullName, avatarUrl, avatarBgColor, avatarTextColor, isAdmin = false }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navOrder, setNavOrder] = useState<string[]>(() => NAV_DRAGGABLE.map(n => n.href))
  useEffect(() => {
    try {
      const saved = localStorage.getItem('empleado-nav-order')
      if (!saved) return
      const parsed = JSON.parse(saved) as string[]
      const current = NAV_DRAGGABLE.map(n => n.href)
      setNavOrder([...parsed.filter(h => current.includes(h)), ...current.filter(h => !parsed.includes(h))])
    } catch {}
  }, [])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const orderedDraggable = navOrder.map(href => NAV_DRAGGABLE.find(n => n.href === href)!).filter(Boolean)

  function handleDrop() {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null); setDragOverIdx(null); return
    }
    const reordered = [...orderedDraggable]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(dragOverIdx, 0, moved)
    const newOrder = reordered.map(n => n.href)
    setNavOrder(newOrder)
    localStorage.setItem('empleado-nav-order', JSON.stringify(newOrder))
    setDragIdx(null); setDragOverIdx(null)
  }

  useEffect(() => { setMobileOpen(false) }, [pathname])

  const [avisosUnread, setAvisosUnread] = useState(0)
  const [badges, setBadges] = useState<{ recibos?: number; documentos?: number; solicitudes?: number }>({})
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

  const perfilActive = pathname === '/empleado/perfil'

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
      <div className={cn(
        'flex items-center border-b border-border py-5',
        collapsed ? 'md:justify-center px-2' : 'justify-between px-4'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl && <img src={logoUrl} alt="" className="h-6 w-auto object-contain shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight truncate text-foreground">{appName}</p>
              <p className="text-xs text-muted-foreground">Portal del empleado</p>
            </div>
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
        {/* Inicio — fijo, no draggable */}
        {(() => {
          const { href, label, icon: Icon } = NAV_INICIO
          const active = pathname === '/empleado'
          return (
            <Link
              key={href}
              href={href}
              data-tour="inicio"
              title={collapsed ? label : undefined}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
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
        })()}
        {/* Draggable */}
        {orderedDraggable.map(({ href, label, icon: Icon }, idx) => {
          const active = pathname.startsWith(href)
          const tourKey = href.replace('/empleado', '').replace('/', '') || 'inicio'
          let badge = 0
          let badgeColor = 'bg-blue-500'
          if (href === '/empleado/portal') badge = avisosUnread
          else if (href === '/empleado/documentos') { badge = badges.documentos ?? 0; badgeColor = 'bg-yellow-500' }
          else if (href === '/empleado/recibos') { badge = badges.recibos ?? 0; badgeColor = 'bg-yellow-500' }
          else if (href === '/empleado/solicitudes') { badge = badges.solicitudes ?? 0; badgeColor = 'bg-blue-500' }
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
                data-tour={tourKey}
                title={collapsed ? `${label}${badge ? ` (${badge})` : ''}` : undefined}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group',
                  collapsed && 'justify-center',
                  active
                    ? 'bg-green-100 text-green-700 font-medium dark:bg-green-500/15 dark:text-green-300'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span className="flex-1">{label}</span>}
                {badge > 0 && (
                  collapsed ? (
                    <span className={cn('absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center', badgeColor)}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  ) : (
                    <span className={cn('min-w-5 h-5 px-1.5 rounded-full text-white text-[10px] font-bold flex items-center justify-center', badgeColor)}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )
                )}
                {!collapsed && (
                  <GripVertical size={14} className="opacity-0 group-hover:opacity-30 shrink-0 cursor-grab active:cursor-grabbing" />
                )}
              </Link>
            </div>
          )
        })}
      </nav>

      <div className={cn(
        'border-t border-border py-3 mt-auto',
        collapsed ? 'px-2 flex flex-col items-center gap-2' : 'px-3 flex items-center gap-2'
      )}>
        <Link
          href="/empleado/perfil"
          data-tour="perfil"
          title={collapsed ? 'Mi Perfil' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-md transition-colors min-w-0',
            collapsed ? 'p-1' : 'flex-1 px-1 py-1 hover:bg-muted',
            perfilActive && !collapsed && 'bg-muted'
          )}
        >
          <AvatarUpload
            initials={initials}
            initialAvatar={avatarUrl}
            initialBgColor={avatarBgColor}
            initialTextColor={avatarTextColor}
            size="sm"
            className={cn(perfilActive && 'ring-2 ring-green-400/60 rounded-full')}
          />
          {!collapsed && (
            <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">{fullName}</p>
          )}
        </Link>
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        {isAdmin && (
          <Link
            href="/admin"
            title="Ir al panel de administración"
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <Shield size={14} />
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
