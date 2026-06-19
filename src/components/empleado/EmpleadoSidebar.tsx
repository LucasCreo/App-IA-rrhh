'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, FileText, FolderOpen, ChevronLeft, ChevronRight, LogOut, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { AvatarUpload } from '@/components/shared/AvatarUpload'

const nav = [
  { href: '/empleado', label: 'Inicio', icon: LayoutDashboard },
  { href: '/empleado/recibos', label: 'Recibos', icon: FileText },
  { href: '/empleado/documentos', label: 'Documentos', icon: FolderOpen },
]

interface Props {
  appName?: string
  logoUrl?: string | null
  initials: string
  fullName: string
  avatarUrl?: string | null
}

export function EmpleadoSidebar({ appName = 'RRHH', logoUrl, initials, fullName, avatarUrl }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  const perfilActive = pathname === '/empleado/perfil'

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className={cn(
      'h-screen sticky top-0 bg-background border-r border-border flex flex-col transition-all duration-200 shrink-0 overflow-hidden',
      collapsed ? 'w-16' : 'w-60'
    )}>
      <div className={cn(
        'flex items-center border-b border-border py-5',
        collapsed ? 'justify-center px-2' : 'justify-between px-4'
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
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/empleado' ? pathname === '/empleado' : pathname.startsWith(href)
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
      </nav>

      <div className={cn(
        'border-t border-border py-3 mt-auto',
        collapsed ? 'px-2 flex flex-col items-center gap-2' : 'px-3 flex items-center gap-2'
      )}>
        <Link
          href="/empleado/perfil"
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
        <button
          onClick={logout}
          title="Cerrar sesión"
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  )
}
