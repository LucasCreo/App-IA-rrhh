'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/apiErrors'
import { useRouter } from 'next/navigation'

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
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function NuevoEventoDialog({
  open, onClose, employeeId, tipos, onCreated, router,
}: {
  open: boolean; onClose: () => void; employeeId: number
  tipos: TipoEvento[]
  onCreated: () => void
  router: ReturnType<typeof useRouter>
}) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [todoElDia, setTodoElDia] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitulo(''); setDescripcion(''); setTipo('')
    setFechaInicio(ymd(new Date())); setFechaFin('')
    setTodoElDia(true); setSaving(false)
  }, [open])

  async function guardar() {
    if (!titulo.trim()) { toast.error('Título requerido'); return }
    if (!fechaInicio) { toast.error('Fecha requerida'); return }
    if (!tipo) { toast.error('Elegí un tipo de evento'); return }
    setSaving(true)
    const res = await fetch('/api/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo, descripcion: descripcion || undefined, tipo,
        fechaInicio, fechaFin: fechaFin || undefined, todoElDia,
        employeeIds: [employeeId],
      }),
    })
    setSaving(false)
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success('Evento creado')
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo evento</DialogTitle>
          <p className="text-xs text-muted-foreground">Se asignará automáticamente a este empleado.</p>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div>
            <Label className="mb-1.5">Título <span className="text-red-500">*</span></Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus />
          </div>
          <div>
            <Label className="mb-1.5">Tipo <span className="text-red-500">*</span></Label>
            <Select value={tipo} onValueChange={v => v && setTipo(v)}>
              <SelectTrigger><SelectValue placeholder="Elegir…" /></SelectTrigger>
              <SelectContent>
                {tipos.map(t => (
                  <SelectItem key={t.id} value={t.nombre}>{t.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1.5">Fecha inicio <span className="text-red-500">*</span></Label>
              <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">Fecha fin</Label>
              <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={todoElDia} onCheckedChange={v => setTodoElDia(!!v)} />
            Todo el día
          </label>
          <div>
            <Label className="mb-1.5">Descripción</Label>
            <Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={guardar} disabled={saving}>
            {saving ? 'Creando…' : 'Crear evento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EmpleadoCalendarioTab({ employeeId }: Props) {
  const now = new Date()
  const router = useRouter()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [eventos, setEventos] = useState<Evento[]>([])
  const [tipos, setTipos] = useState<TipoEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevoOpen, setNuevoOpen] = useState(false)

  const cargar = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/eventos?mes=${mes}&anio=${anio}&employeeId=${employeeId}`).then(r => r.json()),
      fetch('/api/configuracion/tipos-evento').then(r => r.ok ? r.json() : []),
    ]).then(([evs, tps]) => {
      setEventos(Array.isArray(evs) ? evs : [])
      setTipos(Array.isArray(tps) ? tps : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, mes, anio])

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
            <Button
              size="sm"
              className="ml-2 h-7 text-xs bg-green-700 hover:bg-green-800"
              onClick={() => setNuevoOpen(true)}
            >
              <Plus size={13} className="mr-1" /> Nuevo evento
            </Button>
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

      <NuevoEventoDialog
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        employeeId={employeeId}
        tipos={tipos}
        onCreated={() => { setNuevoOpen(false); cargar() }}
        router={router}
      />

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h3 className="font-semibold text-sm">Eventos del mes</h3>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
          </div>
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
