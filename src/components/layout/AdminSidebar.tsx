'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, FileText, Settings, ClipboardList, Inbox, ChevronLeft, ChevronRight, KeyRound, Layers } from 'lucide-react'
import { CambiarPasswordDialog } from '@/components/shared/CambiarPasswordDialog'
import { AvatarUpload } from '@/components/shared/AvatarUpload'

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/empleados', label: 'Empleados', icon: Users },
  { href: '/admin/documentos', label: 'Documentos', icon: FileText },
  { href: '/admin/lotes', label: 'Lotes', icon: Layers },
  { href: '/admin/solicitudes', label: 'Solicitudes', icon: Inbox },
  { href: '/admin/auditoria', label: 'Auditoría', icon: ClipboardList },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

interface Props {
  appName?: string
  logoUrl?: string | null
  userEmail?: string
  avatarUrl?: string | null
  pendingModificaciones?: number
  pendingSolicitudes?: number
}

export function AdminSidebar({ appName = 'RRHH', logoUrl, userEmail, avatarUrl, pendingModificaciones = 0, pendingSolicitudes = 0 }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)

  return (
    <>
      <aside className={cn('h-screen sticky top-0 bg-background border-r border-border flex flex-col transition-all duration-200 shrink-0 overflow-hidden', collapsed ? 'w-16' : 'w-60')}>
        <div className={cn('flex items-center border-b border-border py-5', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              {logoUrl && <img src={logoUrl} alt="" className="h-6 w-auto object-contain shrink-0" />}
              <span className="text-base font-bold tracking-tight truncate text-foreground">{appName}</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
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
                {!collapsed && href === '/admin/solicitudes' && pendingSolicitudes > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 text-yellow-900 text-xs font-bold px-1">
                    {pendingSolicitudes}
                  </span>
                )}
                {collapsed && href === '/admin/solicitudes' && pendingSolicitudes > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-yellow-400" />
                )}
              </Link>
            )
          })}
        </nav>
        {/* User profile section */}
        <div className={cn(
          'border-t border-border py-3 mt-auto',
          collapsed ? 'px-2 flex flex-col items-center gap-2' : 'px-3 flex items-center gap-2'
        )}>
          <AvatarUpload
            initials={userEmail ? userEmail.slice(0, 2).toUpperCase() : 'U'}
            initialAvatar={avatarUrl}
            size="sm"
          />
          {!collapsed && (
            <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">{userEmail}</p>
          )}
          <button
            onClick={() => setPwOpen(true)}
            title="Cambiar contraseña"
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <KeyRound size={14} />
          </button>
        </div>
      </aside>

      <CambiarPasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  )
}
