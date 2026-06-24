'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronRight } from 'lucide-react'

interface Evento {
  id: number
  titulo: string
  fechaInicio: string
  tipo: string
  todoElDia: boolean
}

interface TipoEvento {
  nombre: string
  color: string
}

interface Props {
  href: string
}

export function ProximosEventos({ href }: Props) {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [tipoColors, setTipoColors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/configuracion/tipos-evento')
      .then(r => r.json())
      .then((tipos: TipoEvento[]) => {
        const map: Record<string, string> = {}
        tipos.forEach(t => { map[t.nombre] = t.color })
        setTipoColors(map)
      })
  }, [])

  useEffect(() => {
    const now = new Date()
    const mes = now.getMonth() + 1
    const anio = now.getFullYear()
    const nextMes = mes === 12 ? 1 : mes + 1
    const nextAnio = mes === 12 ? anio + 1 : anio

    Promise.all([
      fetch(`/api/eventos?mes=${mes}&anio=${anio}`).then(r => r.json()),
      fetch(`/api/eventos?mes=${nextMes}&anio=${nextAnio}`).then(r => r.json()),
    ]).then(([a, b]) => {
      const todayStr = now.toISOString().slice(0, 10)
      const combined: Evento[] = [...a, ...b]
        .filter((e: Evento) => e.fechaInicio.slice(0, 10) >= todayStr)
        .sort((a: Evento, b: Evento) => a.fechaInicio.localeCompare(b.fechaInicio))
        .slice(0, 5)
      setEventos(combined)
    })
  }, [])

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold">Próximos eventos</span>
        </div>
        <Link href={href} className="text-xs text-green-700 dark:text-green-400 hover:underline flex items-center gap-0.5">
          Ver calendario <ChevronRight size={12} />
        </Link>
      </div>
      {eventos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin eventos próximos</p>
      ) : (
        <ul className="divide-y">
          {eventos.map(e => {
            const fecha = new Date(e.fechaInicio.slice(0, 10) + 'T00:00:00')
            const color = tipoColors[e.tipo] ?? '#6b7280'
            return (
              <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="flex-1 truncate font-medium">{e.titulo}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {!e.todoElDia && e.fechaInicio.length > 10 && (
                    <span className="mr-1">{e.fechaInicio.slice(11, 16)}</span>
                  )}
                  {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
