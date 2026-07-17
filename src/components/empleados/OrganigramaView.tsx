'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Shield } from 'lucide-react'

interface Nodo {
  id: number
  email: string
  role: string
  managerUserId: number | null
  empleado: {
    id: number
    nombre: string
    apellido: string
    legajo: string
    categoria: string | null
  } | null
  hijos: Nodo[]
}

function Card({ nodo }: { nodo: Nodo }) {
  const inner = (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm hover:shadow-md hover:border-green-500 dark:hover:border-green-600 transition-all min-w-[200px]">
      {nodo.empleado ? (
        <>
          <p className="text-sm font-semibold text-foreground leading-tight">
            {nodo.empleado.apellido}, {nodo.empleado.nombre}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {nodo.empleado.categoria ?? '—'} · Legajo {nodo.empleado.legajo}
          </p>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-green-700 dark:text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{nodo.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Admin sin legajo</p>
          </div>
        </div>
      )}
    </div>
  )
  return nodo.empleado
    ? <Link href={`/admin/empleados/${nodo.empleado.id}`} className="inline-block">{inner}</Link>
    : <div className="inline-block">{inner}</div>
}

function Rama({ nodo }: { nodo: Nodo }) {
  const tieneHijos = nodo.hijos.length > 0
  return (
    <div className="flex flex-col items-center">
      <Card nodo={nodo} />
      {tieneHijos && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="relative flex gap-6 pt-6">
            {nodo.hijos.length > 1 && (
              <div className="absolute top-0 h-px bg-border" style={{ left: '20%', right: '20%' }} />
            )}
            {nodo.hijos.map(h => (
              <div key={h.id} className="relative flex flex-col items-center">
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

export function OrganigramaView() {
  const [roots, setRoots] = useState<Nodo[] | null>(null)

  useEffect(() => {
    fetch('/api/organigrama')
      .then(r => r.json())
      .then((data: Omit<Nodo, 'hijos'>[]) => {
        const map = new Map<number, Nodo>()
        data.forEach(u => map.set(u.id, { ...u, hijos: [] }))
        const rs: Nodo[] = []
        map.forEach(n => {
          if (n.managerUserId && map.has(n.managerUserId)) {
            map.get(n.managerUserId)!.hijos.push(n)
          } else {
            rs.push(n)
          }
        })
        setRoots(rs)
      })
  }, [])

  if (roots === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    )
  }
  if (roots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
        <Users size={32} strokeWidth={1.2} />
        <p className="text-sm">No hay usuarios activos.</p>
        <p className="text-xs">Configurá quién reporta a quién desde Configuración → Usuarios.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto pb-6">
      <div className="flex gap-12 justify-center min-w-max px-6">
        {roots.map(r => <Rama key={r.id} nodo={r} />)}
      </div>
    </div>
  )
}
