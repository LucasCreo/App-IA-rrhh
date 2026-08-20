'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { KPICards } from '@/components/dashboard/KPICards'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Users, SlidersHorizontal, Eye, EyeOff, GripVertical, CalendarOff, UserPen, ArrowRight, BellRing, RotateCcw } from 'lucide-react'
import { AvatarDisplay } from '@/components/shared/AvatarDisplay'
import dynamic from 'next/dynamic'
import { ProximosEventos } from '@/components/calendario/ProximosEventos'
import { UltimosPostsWidget } from '@/components/portal/UltimosPostsWidget'
import { WelcomeAdmin } from '@/components/admin/WelcomeAdmin'
import { WelcomeCard } from '@/components/admin/WelcomeCard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const Charts = dynamic(() => import('@/components/dashboard/Charts').then(m => m.Charts), { ssr: false })

const WIDGETS = [
  { id: 'kpis', label: 'Tarjetas KPI' },
  { id: 'graficos', label: 'Gráficos' },
  { id: 'eventos', label: 'Próximos eventos' },
  { id: 'portal', label: 'Últimas publicaciones' },
  { id: 'pendientes', label: 'Pendientes de revisión' },
  { id: 'incorporados', label: 'Últimos incorporados' },
]

const TIPO_META: Record<string, { icon: typeof CalendarOff; color: string; label: string }> = {
  ausencia: { icon: CalendarOff, color: 'text-blue-600 dark:text-blue-400', label: 'Ausencia' },
  documento: { icon: FileText, color: 'text-purple-600 dark:text-purple-400', label: 'Documento' },
  modificacion: { icon: UserPen, color: 'text-amber-600 dark:text-amber-400', label: 'Modificación' },
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return WIDGETS.map(w => w.id)
    try {
      const saved = localStorage.getItem('dashboard-widget-order')
      if (!saved) return WIDGETS.map(w => w.id)
      const parsed = JSON.parse(saved) as string[]
      const current = WIDGETS.map(w => w.id)
      const nuevos = current.filter(id => !parsed.includes(id))
      return [...nuevos, ...parsed.filter(id => current.includes(id))]
    } catch { return WIDGETS.map(w => w.id) }
  })
  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>()
    try {
      const saved = localStorage.getItem('dashboard-hidden-widgets')
      if (!saved) return new Set<string>()
      return new Set(JSON.parse(saved) as string[])
    } catch { return new Set<string>() }
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  useEffect(() => {
    const load = () => fetch('/api/dashboard').then(async r => {
      if (!r.ok) { setData({ unauthorized: true }); return }
      setData(await r.json())
    })
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  function resetPersonalizacion() {
    localStorage.removeItem('dashboard-widget-order')
    localStorage.removeItem('dashboard-hidden-widgets')
    setWidgetOrder(WIDGETS.map(w => w.id))
    setHidden(new Set())
  }

  function toggleWidget(id: string) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('dashboard-hidden-widgets', JSON.stringify([...next]))
      return next
    })
  }

  function handleDrop() {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null); setDragOverIdx(null); return
    }
    const newOrder = [...widgetOrder]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(dragOverIdx, 0, moved)
    setWidgetOrder(newOrder)
    localStorage.setItem('dashboard-widget-order', JSON.stringify(newOrder))
    setDragIdx(null); setDragOverIdx(null)
  }

  return (
    <>
      <WelcomeAdmin />
      <AdminHeader title="Dashboard" actions={
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setSettingsOpen(true)}>
          <SlidersHorizontal size={13} />
          Personalizar
        </Button>
      } />
      <div className="p-4 sm:p-6">

        {data?.unauthorized ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No tenés permisos para ver el dashboard. Contactá a un administrador para solicitar acceso.</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {data.me && <WelcomeCard me={data.me} />}
            {widgetOrder.map(id => {
              if (hidden.has(id)) return null
              if (id === 'kpis') return <KPICards key={id} data={data} />
              if (id === 'graficos') return (
                <Charts
                  key={id}
                  solicitudesPorEstado={data.solicitudesPorEstado}
                  recibosPorEstado={data.recibosPorEstado}
                  empleadosPorArea={data.empleadosPorArea}
                />
              )
              if (id === 'eventos') return (
                <ProximosEventos key={id} href="/admin/calendario?from=dashboard" />
              )
              if (id === 'portal') return (
                <UltimosPostsWidget key={id} baseHref="/admin/portal?from=dashboard" />
              )
              if (id === 'pendientes') return (
                <div key={id} className="rounded-xl border bg-card shadow-sm">
                  <div className="flex items-center justify-between px-5 py-4 border-b">
                    <div className="flex items-center gap-2">
                      <BellRing size={14} className="text-muted-foreground" />
                      <span className="text-sm font-semibold">Pendientes de revisión</span>
                    </div>
                  </div>
                  {(!data.pendientesRevision || data.pendientesRevision.length === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No hay nada pendiente por revisar</p>
                  ) : (
                    <ul className="divide-y">
                      {data.pendientesRevision.map((p: any) => {
                        const meta = TIPO_META[p.tipo] ?? TIPO_META.documento
                        const Icon = meta.icon
                        return (
                          <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-muted/40 transition-colors">
                            <Icon size={16} className={cn('shrink-0', meta.color)} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{p.empleado}</p>
                              <p className="text-xs text-muted-foreground truncate">{p.descripcion}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                              {new Date(p.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                            </span>
                            <Link
                              href={p.href}
                              className="shrink-0 inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 hover:underline"
                            >
                              Ir <ArrowRight size={12} />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
              if (id === 'incorporados') return (
                <div key={id} className="rounded-xl border bg-card shadow-sm">
                  <div className="flex items-center justify-between px-5 py-4 border-b">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-muted-foreground" />
                      <span className="text-sm font-semibold">Últimos incorporados</span>
                    </div>
                    <Link href="/admin/empleados?from=dashboard" className="text-xs text-green-700 dark:text-green-400 hover:underline">Ver todos</Link>
                  </div>
                  {(!data.recentEmpleados || data.recentEmpleados.length === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sin empleados registrados</p>
                  ) : (
                    <ul className="divide-y">
                      {data.recentEmpleados.map((e: any) => (
                        <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                          <AvatarDisplay
                            iniciales={e.iniciales}
                            avatarUrl={e.avatarUrl}
                            bgColor={e.avatarBgColor}
                            textColor={e.avatarTextColor}
                            size={32}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{e.nombre}</p>
                            <p className="text-xs text-muted-foreground truncate">{e.categoria} · {e.legajo}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(e.createdAt).toLocaleDateString('es-AR')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
              return null
            })}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <div className="flex items-center justify-center h-[200px]">
                    <Skeleton className="h-40 w-40 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Personalizar dashboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <p className="text-xs text-muted-foreground mb-3">Arrastrá para reordenar · Clic en el ojo para mostrar u ocultar</p>
            {widgetOrder.map((id, idx) => {
              const widget = WIDGETS.find(w => w.id === id)
              if (!widget) return null
              const isHidden = hidden.has(id)
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(idx) }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverIdx !== idx) setDragOverIdx(idx) }}
                  onDrop={e => { e.preventDefault(); handleDrop() }}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md transition-all',
                    dragOverIdx === idx && dragIdx !== idx && 'ring-1 ring-green-400',
                    dragIdx === idx ? 'opacity-40' : 'hover:bg-muted'
                  )}
                >
                  <GripVertical size={14} className="text-muted-foreground/40 shrink-0 cursor-grab" />
                  <span className={cn('flex-1 text-sm', isHidden && 'text-muted-foreground line-through')}>{widget.label}</span>
                  <button onClick={() => toggleWidget(id)} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="pt-2 border-t">
            <Button size="sm" variant="ghost" className="w-full gap-1.5 text-xs" onClick={resetPersonalizacion}>
              <RotateCcw size={13} /> Restaurar por defecto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
