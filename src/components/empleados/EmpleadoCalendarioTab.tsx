'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Evento {
  id: number
  titulo: string
  descripcion?: string | null
  fechaInicio: string
  fechaFin?: string | null
  todoElDia: boolean
  tipo: string
  subtipo?: string | null
  color?: string | null
  virtual?: boolean
  asignados: Array<{ employeeId: number }>
  creadoPor?: { email: string } | null
  creadoPorId?: number
}

function tipoLabel(e: { tipo: string; subtipo?: string | null; virtual?: boolean }) {
  if (e.virtual && e.tipo.startsWith('__ausencia__:')) return e.subtipo ?? 'Ausencia'
  return e.tipo
}

function tipoColor(e: Evento, colorPorTipo: Map<string, string>) {
  if (e.color) return e.color
  return colorPorTipo.get(e.tipo) ?? '#64748b'
}

interface TipoEvento {
  id: number
  nombre: string
  color: string
}

interface Props {
  employeeId: number
  userId?: number | null
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function EmpleadoCalendarioTab({ employeeId, userId }: Props) {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [eventos, setEventos] = useState<Evento[]>([])
  const [tipos, setTipos] = useState<TipoEvento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/eventos?mes=${mes}&anio=${anio}`).then(r => r.json()),
      fetch('/api/configuracion/tipos-evento').then(r => r.ok ? r.json() : []),
    ]).then(([evs, tps]) => {
      const filtered: Evento[] = (Array.isArray(evs) ? evs : []).filter((e: Evento) => {
        const asignado = e.asignados?.some(a => a.employeeId === employeeId)
        const creador = userId != null && e.creadoPorId === userId
        return asignado || creador
      })
      setEventos(filtered)
      setTipos(Array.isArray(tps) ? tps : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [employeeId, userId, mes, anio])

  const colorPorTipo = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tipos) m.set(t.nombre, t.color)
    return m
  }, [tipos])

  const eventosPorDia = useMemo(() => {
    const m = new Map<string, Evento[]>()
    for (const e of eventos) {
      const inicio = new Date(e.fechaInicio)
      const fin = e.fechaFin ? new Date(e.fechaFin) : inicio
      const cur = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
      const end = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate())
      while (cur <= end) {
        const key = ymd(cur)
        const arr = m.get(key) ?? []
        arr.push(e)
        m.set(key, arr)
        cur.setDate(cur.getDate() + 1)
      }
    }
    return m
  }, [eventos])

  const primerDia = new Date(anio, mes - 1, 1).getDay()
  const diasEnMes = new Date(anio, mes, 0).getDate()
  const hoy = ymd(new Date())

  const celdas: Array<{ key: string; dia: number | null; fecha?: string }> = []
  for (let i = 0; i < primerDia; i++) celdas.push({ key: `pad-${i}`, dia: null })
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = ymd(new Date(anio, mes - 1, d))
    celdas.push({ key: fecha, dia: d, fecha })
  }

  function cambiarMes(delta: number) {
    let m = mes + delta
    let a = anio
    if (m < 1) { m = 12; a-- }
    if (m > 12) { m = 1; a++ }
    setMes(m)
    setAnio(a)
  }

  const eventosOrdenados = [...eventos].sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime())

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-muted-foreground" />
            <h3 className="font-semibold text-sm">{MESES[mes - 1]} {anio}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => cambiarMes(-1)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => { setMes(now.getMonth() + 1); setAnio(now.getFullYear()) }}
              className="text-xs px-2 py-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={() => cambiarMes(1)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b bg-muted/40">
          {DIAS.map(d => (
            <div key={d} className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground text-center uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {celdas.map(c => {
            if (c.dia === null) return <div key={c.key} className="min-h-[80px] border-b border-r bg-muted/20" />
            const evs = c.fecha ? eventosPorDia.get(c.fecha) ?? [] : []
            const esHoy = c.fecha === hoy
            return (
              <div
                key={c.key}
                className={cn(
                  'min-h-[80px] border-b border-r p-1.5 text-xs space-y-0.5 overflow-hidden',
                  esHoy && 'bg-green-50 dark:bg-green-950/20'
                )}
              >
                <div className={cn('text-[11px] font-medium', esHoy ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground')}>
                  {c.dia}
                </div>
                {evs.slice(0, 3).map(e => (
                  <div
                    key={`${c.key}-${e.id}`}
                    title={e.titulo}
                    className="truncate rounded px-1 py-0.5 text-white text-[10px] font-medium"
                    style={{ backgroundColor: tipoColor(e, colorPorTipo) }}
                  >
                    {e.titulo}
                  </div>
                ))}
                {evs.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{evs.length - 3} más</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h3 className="font-semibold text-sm">Eventos del mes</h3>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Cargando…</p>
        ) : eventosOrdenados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin eventos este mes.</p>
        ) : (
          <ul className="divide-y">
            {eventosOrdenados.map(e => {
              const ini = new Date(e.fechaInicio)
              const fin = e.fechaFin ? new Date(e.fechaFin) : null
              return (
                <li key={e.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tipoColor(e, colorPorTipo) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.titulo}</p>
                    {e.descripcion && <p className="text-xs text-muted-foreground truncate">{e.descripcion}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ini.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                      {fin && ymd(ini) !== ymd(fin) && ` – ${fin.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`}
                      {' · '}
                      <span className="capitalize">{tipoLabel(e).toLowerCase()}</span>
                      {e.virtual && e.subtipo ? '' : (e.subtipo ? ` · ${e.subtipo}` : '')}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
