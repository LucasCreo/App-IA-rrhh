'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { Users } from 'lucide-react'

interface Nodo {
  id: number
  nombre: string
  apellido: string
  legajo: string
  managerId: number | null
  categoria: { nombre: string } | null
  hijos: Nodo[]
}

function EmpleadoCard({ nodo }: { nodo: Nodo }) {
  return (
    <Link
      href={`/admin/empleados/${nodo.id}`}
      className="inline-block bg-card border border-border rounded-xl px-4 py-3 shadow-sm hover:shadow-md hover:border-green-500 dark:hover:border-green-600 transition-all min-w-[180px]"
    >
      <p className="text-sm font-semibold text-foreground leading-tight">{nodo.apellido}, {nodo.nombre}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {nodo.categoria?.nombre ?? '—'} · Legajo {nodo.legajo}
      </p>
    </Link>
  )
}

function Rama({ nodo }: { nodo: Nodo }) {
  const tieneHijos = nodo.hijos.length > 0
  return (
    <div className="flex flex-col items-center">
      <EmpleadoCard nodo={nodo} />
      {tieneHijos && (
        <>
          {/* Línea vertical hacia hijos */}
          <div className="w-px h-6 bg-border" />
          {/* Contenedor de hijos con conexión horizontal */}
          <div className="relative flex gap-6 pt-6">
            {/* Línea horizontal que conecta los hijos */}
            {nodo.hijos.length > 1 && (
              <div
                className="absolute top-0 h-px bg-border"
                style={{ left: '20%', right: '20%' }}
              />
            )}
            {nodo.hijos.map(h => (
              <div key={h.id} className="relative flex flex-col items-center">
                {/* Línea vertical desde la horizontal hacia el hijo */}
                <div className="absolute -top-6 w-px h-6 bg-border" />
                <Rama nodo={h} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function OrganigramaPage() {
  const [empleados, setEmpleados] = useState<Nodo[] | null>(null)

  useEffect(() => {
    fetch('/api/organigrama')
      .then(r => r.json())
      .then((data: Omit<Nodo, 'hijos'>[]) => {
        const map = new Map<number, Nodo>()
        data.forEach(e => map.set(e.id, { ...e, hijos: [] }))
        const roots: Nodo[] = []
        map.forEach(n => {
          if (n.managerId && map.has(n.managerId)) {
            map.get(n.managerId)!.hijos.push(n)
          } else {
            roots.push(n)
          }
        })
        setEmpleados(roots)
      })
  }, [])

  return (
    <>
      <AdminHeader title="Organigrama" />
      <div className="p-6">
        {empleados === null ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : empleados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
            <Users size={32} strokeWidth={1.2} />
            <p className="text-sm">No hay empleados activos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-6">
            <div className="flex gap-12 justify-center min-w-max px-6">
              {empleados.map(root => (
                <Rama key={root.id} nodo={root} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
