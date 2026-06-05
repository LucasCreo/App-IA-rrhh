'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { KPICards } from '@/components/dashboard/KPICards'
import dynamic from 'next/dynamic'

const Charts = dynamic(() => import('@/components/dashboard/Charts').then(m => m.Charts), { ssr: false })

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData)
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
          <p className="text-muted-foreground">Cargando...</p>
        )}
      </div>
    </>
  )
}
