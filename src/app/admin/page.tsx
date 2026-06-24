'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { KPICards } from '@/components/dashboard/KPICards'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Users } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ProximosEventos } from '@/components/calendario/ProximosEventos'

const Charts = dynamic(() => import('@/components/dashboard/Charts').then(m => m.Charts), { ssr: false })

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const load = () => fetch('/api/dashboard').then(r => r.json()).then(setData)
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return (
    <>
      <AdminHeader title="Dashboard" />
      <div className="p-6">
        {data ? (
          <>
            <KPICards data={data} />
            <Charts
              documentosPorEstado={data.documentosPorEstado}
              empleadosPorCategoria={data.empleadosPorCategoria}
            />
            <div className="mt-6">
              <ProximosEventos href="/admin/calendario" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Solicitudes pendientes recientes */}
              <div className="rounded-xl border bg-card shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-muted-foreground" />
                    <span className="text-sm font-semibold">Solicitudes pendientes</span>
                  </div>
                  <Link href="/admin/solicitudes" className="text-xs text-green-700 dark:text-green-400 hover:underline">Ver todas</Link>
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

              {/* Últimos empleados incorporados */}
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
            </div>
          </>
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
    </>
  )
}
