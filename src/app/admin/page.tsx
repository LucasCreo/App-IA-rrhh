'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { KPICards } from '@/components/dashboard/KPICards'
import { Skeleton } from '@/components/ui/skeleton'
import dynamic from 'next/dynamic'

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
          </>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-border shadow-sm p-4 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
