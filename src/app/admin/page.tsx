'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { KPICards } from '@/components/dashboard/KPICards'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Users, SlidersHorizontal, Eye, EyeOff, GripVertical } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ProximosEventos } from '@/components/calendario/ProximosEventos'
import { UltimosPostsWidget } from '@/components/portal/UltimosPostsWidget'
import { WelcomeAdmin } from '@/components/admin/WelcomeAdmin'
import { WelcomeCard } from '@/components/admin/WelcomeCard'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const Charts = dynamic(() => import('@/components/dashboard/Charts').then(m => m.Charts), { ssr: false })

const TOP_WIDGETS = [
  { id: 'bienvenida', label: 'Bienvenida' },
  { id: 'kpis', label: 'Tarjetas KPI' },
  { id: 'graficos', label: 'Gráficos' },
  { id: 'eventos', label: 'Próximos eventos' },
  { id: 'portal', label: 'Últimas publicaciones' },
]
const BOTTOM_WIDGETS = [
  { id: 'solicitudes', label: 'Solicitudes pendientes' },
  { id: 'incorporados', label: 'Últimos incorporados' },
]

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return TOP_WIDGETS.map(w => w.id)
    try {
      const saved = localStorage.getItem('dashboard-widget-order')
      if (!saved) return TOP_WIDGETS.map(w => w.id)
      const parsed = JSON.parse(saved) as string[]
      const current = TOP_WIDGETS.map(w => w.id)
      const nuevos = current.filter(id => !parsed.includes(id))
      return [...nuevos, ...parsed.filter(id => current.includes(id))]
    } catch { return TOP_WIDGETS.map(w => w.id) }
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
    const load = () => fetch('/api/dashboard').then(r => r.json()).then(setData)
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

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

  const showSolicitudes = !hidden.has('solicitudes')
  const showIncorporados = !hidden.has('incorporados')

  return (
    <>
      <WelcomeAdmin />
      <AdminHeader title="Dashboard" actions={
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setSettingsOpen(true)}>
          <SlidersHorizontal size={13} />
          Personalizar
        </Button>
      } />
      <div className="p-6">

        {data ? (
          <div className="space-y-6">
            {widgetOrder.map(id => {
              if (hidden.has(id)) return null
              if (id === 'bienvenida' && data.me) return (
                <WelcomeCard
                  key={id}
                  me={data.me}
                  pendingSolicitudesDoc={data.pendingSolicitudesDoc}
                  pendingSolicitudesMod={data.pendingSolicitudesMod}
                  pendingAusencias={data.pendingAusencias ?? 0}
                />
              )
              if (id === 'kpis') return <KPICards key={id} data={data} />
              if (id === 'graficos') return (
                <Charts
                  key={id}
                  documentosPorEstado={data.documentosPorEstado}
                  empleadosPorCategoria={data.empleadosPorCategoria}
                />
              )
              if (id === 'eventos') return (
                <ProximosEventos key={id} href="/admin/calendario" />
              )
              if (id === 'portal') return (
                <UltimosPostsWidget key={id} baseHref="/admin/portal" />
              )
              return null
            })}

            {(showSolicitudes || showIncorporados) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {showSolicitudes && (
                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between px-5 py-4 border-b">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-muted-foreground" />
                        <span className="text-sm font-semibold">Solicitudes pendientes</span>
                      </div>
                      <Link href="/admin/documentos?tab=solicitudes" className="text-xs text-green-700 dark:text-green-400 hover:underline">Ver todas</Link>
                    </div>
                    {data.recentSolicitudes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Sin solicitudes pendientes</p>
                    ) : (
                      <ul className="divide-y">
                        {data.recentSolicitudes.map((s: any) => (
                          <li key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{s.empleado}</p>
                              <p className="text-xs text-muted-foreground">{s.tipo}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 ml-4">
                              {new Date(s.createdAt).toLocaleDateString('es-AR')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {showIncorporados && (
                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between px-5 py-4 border-b">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-muted-foreground" />
                        <span className="text-sm font-semibold">Últimos incorporados</span>
                      </div>
                      <Link href="/admin/empleados" className="text-xs text-green-700 dark:text-green-400 hover:underline">Ver todos</Link>
                    </div>
                    {data.recentEmpleados.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Sin empleados registrados</p>
                    ) : (
                      <ul className="divide-y">
                        {data.recentEmpleados.map((e: any) => (
                          <li key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{e.nombre}</p>
                              <p className="text-xs text-muted-foreground">{e.categoria} · {e.legajo}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 ml-4">
                              {new Date(e.createdAt).toLocaleDateString('es-AR')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-border shadow-sm p-4 space-y-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-36" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-border p-5 space-y-3">
                  <Skeleton className="h-4 w-40" />
                  {i < 2 ? (
                    <div className="flex items-center justify-center h-[240px]">
                      <Skeleton className="h-44 w-44 rounded-full" />
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-10 w-full rounded-md" />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
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
              const widget = TOP_WIDGETS.find(w => w.id === id)!
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
            <div className="border-t border-border mt-2 pt-2 space-y-1">
              <p className="text-xs text-muted-foreground px-3 pb-1">Siempre al final</p>
              {BOTTOM_WIDGETS.map(widget => {
                const isHidden = hidden.has(widget.id)
                return (
                  <div key={widget.id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted">
                    <GripVertical size={14} className="text-muted-foreground/20 shrink-0" />
                    <span className={cn('flex-1 text-sm', isHidden && 'text-muted-foreground line-through')}>{widget.label}</span>
                    <button onClick={() => toggleWidget(widget.id)} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                      {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
