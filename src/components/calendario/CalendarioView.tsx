'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Search, SlidersHorizontal, CalendarDays, List, LayoutGrid, Users } from 'lucide-react'
import { Popover } from '@base-ui/react/popover'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { handleApiError } from '@/lib/apiErrors'

interface TipoEvento {
  id: number
  nombre: string
  color: string
  permiteAdmin: boolean
  permiteEmpleado: boolean
  protegido: boolean
}

interface Empleado { id: number; nombre: string; apellido: string; legajo: string }
interface Asignado { employeeId: number; employee?: Empleado }
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
  comentarioAdmin?: string | null
  creadoPorId: number
  creadoPor?: { email: string; role: string } | null
  asignados: Asignado[]
  virtual?: boolean
  solicitudAusenciaId?: number
}

interface Props {
  isAdmin?: boolean
  empleados?: Empleado[]
  currentUserId?: number
  currentEmployeeId?: number
  googleConnected?: boolean
}

type DialogMode = 'create' | 'edit' | 'view' | 'view-employee' | 'day'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTipoLabel(nombre: string) {
  return nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase()
}

function extractTime(isoStr: string): string {
  if (isoStr.length <= 10) return '08:00'
  const d = new Date(isoStr)
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
}

type Vista = 'mes' | 'semana' | 'lista'

function inicioSemana(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() - r.getDay())
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function CalendarioView({ isAdmin = false, empleados = [], currentUserId, currentEmployeeId, googleConnected }: Props) {
  const router = useRouter()
  const now = new Date()
  const [vista, setVista] = useState<Vista>('mes')
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [semanaRef, setSemanaRef] = useState<Date>(() => inicioSemana(now))
  const [tiposOcultos, setTiposOcultos] = useState<Set<string>>(new Set())
  const [empleadosOcultos, setEmpleadosOcultos] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = localStorage.getItem('calendario-empleados-ocultos')
      if (!raw) return new Set()
      return new Set(JSON.parse(raw) as number[])
    } catch { return new Set() }
  })
  const [empleadosSearch, setEmpleadosSearch] = useState('')
  const [dragEvento, setDragEvento] = useState<Evento | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [tipos, setTipos] = useState<TipoEvento[]>([])
  const [tiposAusencia, setTiposAusencia] = useState<{ id: number; nombre: string }[]>([])
  const [dialog, setDialog] = useState<{ mode: DialogMode; evento?: Evento; fecha?: string } | null>(null)
  const [form, setForm] = useState({
    titulo: '', descripcion: '',
    fechaInicio: '', horaInicio: '08:00',
    fechaFin: '', horaFin: '',
    todoElDia: true,
    tipo: '',
    subtipo: '',
    employeeIds: [] as number[],
  })
  const [comentarioAdmin, setComentarioAdmin] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingComment, setSavingComment] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterEmpleadoId, setFilterEmpleadoId] = useState<number | ''>('')
  const [deleteEventId, setDeleteEventId] = useState<number | null>(null)

  const load = useCallback(() => {
    const targets: Array<{ m: number; a: number }> = []
    if (vista === 'semana') {
      const fin = addDays(semanaRef, 6)
      targets.push({ m: semanaRef.getMonth() + 1, a: semanaRef.getFullYear() })
      if (fin.getMonth() !== semanaRef.getMonth() || fin.getFullYear() !== semanaRef.getFullYear()) {
        targets.push({ m: fin.getMonth() + 1, a: fin.getFullYear() })
      }
    } else {
      targets.push({ m: mes, a: anio })
    }
    Promise.all(targets.map(t => fetch(`/api/eventos?mes=${t.m}&anio=${t.a}`).then(r => r.json())))
      .then(res => {
        const seen = new Set<number>()
        const merged: Evento[] = []
        for (const list of res as Evento[][]) {
          for (const ev of list) {
            if (seen.has(ev.id)) continue
            seen.add(ev.id)
            merged.push(ev)
          }
        }
        setEventos(merged)
      })
  }, [mes, anio, vista, semanaRef])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/configuracion/tipos-evento').then(r => r.json()).then(setTipos)
    fetch('/api/ausencias/tipos').then(r => r.json()).then((ts: { id: number; nombre: string; activo: boolean }[]) =>
      setTiposAusencia(ts.filter(t => t.activo))
    )
  }, [])

  useEffect(() => {
    if (!googleConnected) return
    fetch('/api/calendario/google/sync', { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) load() })
  }, [googleConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  function prevMes() { if (mes === 1) { setMes(12); setAnio(a => a - 1) } else setMes(m => m - 1) }
  function nextMes() { if (mes === 12) { setMes(1); setAnio(a => a + 1) } else setMes(m => m + 1) }
  function prevSemana() { setSemanaRef(d => addDays(d, -7)) }
  function nextSemana() { setSemanaRef(d => addDays(d, 7)) }
  function irHoy() {
    const t = new Date()
    setMes(t.getMonth() + 1)
    setAnio(t.getFullYear())
    setSemanaRef(inicioSemana(t))
  }
  function canDrag(e: Evento) {
    if (e.virtual) return false
    return isAdmin || e.creadoPorId === currentUserId
  }

  function shiftIsoDate(iso: string, deltaDays: number): string {
    // Preserva hora si la tiene; para 'YYYY-MM-DD' mantiene el mismo formato.
    if (iso.length <= 10) {
      const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
      const dt = new Date(y, m - 1, d + deltaDays)
      return toLocalDateStr(dt)
    }
    const dt = new Date(iso)
    dt.setDate(dt.getDate() + deltaDays)
    return dt.toISOString()
  }

  async function handleDropOn(targetDate: string) {
    const ev = dragEvento
    setDragEvento(null)
    setDragOverDate(null)
    if (!ev) return
    const origInicio = ev.fechaInicio.slice(0, 10)
    if (origInicio === targetDate) return
    const [yA, mA, dA] = origInicio.split('-').map(Number)
    const [yB, mB, dB] = targetDate.split('-').map(Number)
    const delta = Math.round((new Date(yB, mB - 1, dB).getTime() - new Date(yA, mA - 1, dA).getTime()) / 86400000)
    if (!delta) return
    const nuevaInicio = shiftIsoDate(ev.fechaInicio, delta)
    const nuevaFin = ev.fechaFin ? shiftIsoDate(ev.fechaFin, delta) : null
    const res = await fetch(`/api/eventos/${ev.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moveOnly: true, fechaInicio: nuevaInicio, fechaFin: nuevaFin }),
    })
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success('Evento movido')
    load()
  }

  function toggleTipoOculto(nombre: string) {
    setTiposOcultos(prev => {
      const s = new Set(prev)
      if (s.has(nombre)) s.delete(nombre)
      else s.add(nombre)
      return s
    })
  }

  function toggleEmpleadoOculto(id: number) {
    setEmpleadosOcultos(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      try { localStorage.setItem('calendario-empleados-ocultos', JSON.stringify([...s])) } catch {}
      return s
    })
  }

  function setAllEmpleadosOcultos(ocultos: number[]) {
    const s = new Set(ocultos)
    setEmpleadosOcultos(s)
    try { localStorage.setItem('calendario-empleados-ocultos', JSON.stringify([...s])) } catch {}
  }

  function getTipoColor(tipoNombre: string) {
    return tipos.find(t => t.nombre === tipoNombre)?.color ?? '#6b7280'
  }

  function getEventColor(e: Evento): string {
    return e.color ?? getTipoColor(e.tipo)
  }

  const tiposDisponibles = tipos.filter(t => isAdmin ? t.permiteAdmin : t.permiteEmpleado)

  function defaultTipo() {
    return tiposDisponibles[0]?.nombre ?? ''
  }

  function openDay(fecha: string) {
    setDialog({ mode: 'day', fecha })
  }

  function openCreate(fecha: string) {
    const tipo = defaultTipo()
    setForm({
      titulo: '', descripcion: '',
      fechaInicio: fecha, horaInicio: '08:00',
      fechaFin: '', horaFin: '',
      todoElDia: true, tipo, subtipo: '',
      employeeIds: currentEmployeeId ? [currentEmployeeId] : [],
    })
    setDialog({ mode: 'create', fecha })
  }

  function openEvent(e: Evento) {
    // Ausencias (virtuales) son solo lectura
    if (e.virtual) {
      setDialog({ mode: 'view', evento: e })
      return
    }
    // Admin viewing an event created by an employee
    if (isAdmin && e.creadoPor?.role === 'EMPLOYEE') {
      setComentarioAdmin(e.comentarioAdmin ?? '')
      setDialog({ mode: 'view-employee', evento: e })
      return
    }
    const canEdit = isAdmin || e.creadoPorId === currentUserId
    if (canEdit) {
      const datePart = e.fechaInicio.slice(0, 10)
      const timePart = e.todoElDia ? '08:00' : extractTime(e.fechaInicio)
      const dateFin = e.fechaFin ? e.fechaFin.slice(0, 10) : ''
      const timeFin = e.fechaFin && !e.todoElDia ? extractTime(e.fechaFin) : ''
      setForm({
        titulo: e.titulo,
        descripcion: e.descripcion ?? '',
        fechaInicio: datePart, horaInicio: timePart,
        fechaFin: dateFin, horaFin: timeFin,
        todoElDia: e.todoElDia,
        tipo: e.tipo,
        subtipo: e.subtipo ?? '',
        employeeIds: e.asignados.map(a => a.employeeId),
      })
      setDialog({ mode: 'edit', evento: e })
    } else {
      setDialog({ mode: 'view', evento: e })
    }
  }

  function buildFechaISO(date: string, hora: string, todoElDia: boolean) {
    if (!date) return date
    if (todoElDia) return date
    return new Date(`${date}T${hora || '00:00'}:00`).toISOString()
  }

  async function handleSave() {
    if (!form.titulo.trim()) return
    setSaving(true)
    const fechaInicio = buildFechaISO(form.fechaInicio, form.horaInicio, form.todoElDia)
    const endDate = form.fechaFin || (!form.todoElDia && form.horaFin ? form.fechaInicio : '')
    const fechaFin = endDate ? buildFechaISO(endDate, form.horaFin, form.todoElDia) : null
    const body = { ...form, fechaInicio, fechaFin }
    const isEdit = dialog?.mode === 'edit' && dialog.evento
    const url = isEdit ? `/api/eventos/${dialog.evento!.id}` : '/api/eventos'
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success(isEdit ? 'Evento actualizado' : 'Evento creado')
    setDialog(null)
    load()
  }

  async function handleSaveComment() {
    if (!dialog?.evento) return
    setSavingComment(true)
    const res = await fetch(`/api/eventos/${dialog.evento.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comentarioAdminOnly: true, comentarioAdmin }),
    })
    setSavingComment(false)
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success('Comentario guardado')
    load()
  }

  async function doDeleteEvento() {
    if (!deleteEventId) return
    const res = await fetch(`/api/eventos/${deleteEventId}`, { method: 'DELETE' })
    setDeleteEventId(null)
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success('Evento eliminado')
    setDialog(null)
    load()
  }

  // Filter eventos
  const eventosFiltrados = eventos.filter(e => {
    if (tiposOcultos.has(e.tipo)) return false
    if (isAdmin && empleadosOcultos.size > 0 && e.asignados.length > 0) {
      const algunoVisible = e.asignados.some(a => !empleadosOcultos.has(a.employeeId))
      if (!algunoVisible) return false
    }
    if (filterText) {
      const q = filterText.toLowerCase()
      if (!e.titulo.toLowerCase().includes(q) && !(e.descripcion?.toLowerCase().includes(q))) return false
    }
    if (filterTipo && e.tipo !== filterTipo) return false
    if (filterEmpleadoId !== '' && !e.asignados.some(a => a.employeeId === filterEmpleadoId)) return false
    return true
  })

  const filtrosActivos = (filterText ? 1 : 0) + (filterTipo ? 1 : 0) + (filterEmpleadoId !== '' ? 1 : 0)

  // Build calendar grid
  const firstDay = new Date(anio, mes - 1, 1).getDay()
  const daysInMonth = new Date(anio, mes, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  function eventosDelDia(day: number) {
    const str = `${anio}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return eventosFiltrados.filter(e => {
      const inicio = e.fechaInicio.slice(0, 10)
      const fin = (e.fechaFin ?? e.fechaInicio).slice(0, 10)
      return str >= inicio && str <= fin
    })
  }

  const todayStr = toLocalDateStr(now)

  // Show employee assignment only for tipos that don't allow employee creation (corporate/group types)
  const selectedTipoInfo = tipos.find(t => t.nombre === form.tipo)
  const showAssignment = isAdmin && selectedTipoInfo && !selectedTipoInfo.permiteEmpleado

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={vista === 'semana' ? prevSemana : prevMes}
            title={vista === 'semana' ? 'Semana anterior' : 'Mes anterior'}
          >
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-lg font-semibold min-w-56 text-center">
            {vista === 'semana' ? (() => {
              const fin = addDays(semanaRef, 6)
              const mesmo = semanaRef.getMonth() === fin.getMonth()
              return mesmo
                ? `${semanaRef.getDate()} – ${fin.getDate()} ${MESES[semanaRef.getMonth()]} ${semanaRef.getFullYear()}`
                : `${semanaRef.getDate()} ${MESES[semanaRef.getMonth()]} – ${fin.getDate()} ${MESES[fin.getMonth()]} ${fin.getFullYear()}`
            })() : `${MESES[mes - 1]} ${anio}`}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={vista === 'semana' ? nextSemana : nextMes}
            title={vista === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}
          >
            <ChevronRight size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={irHoy} className="ml-1">Hoy</Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-input overflow-hidden">
            {([
              { id: 'mes', label: 'Mes', icon: LayoutGrid },
              { id: 'semana', label: 'Semana', icon: CalendarDays },
              { id: 'lista', label: 'Lista', icon: List },
            ] as const).map(v => {
              const Icon = v.icon
              return (
                <button
                  key={v.id}
                  onClick={() => setVista(v.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors',
                    vista === v.id
                      ? 'bg-green-700 text-white'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Icon size={13} /> {v.label}
                </button>
              )
            })}
          </div>
          {isAdmin && (
            <Popover.Root>
              <Popover.Trigger
                className={cn(
                  'inline-flex items-center gap-1 h-8 px-3 rounded-md border text-xs font-medium transition-colors',
                  'bg-background hover:bg-muted border-input',
                  empleadosOcultos.size > 0 && 'border-green-600 text-green-700 dark:text-green-400',
                )}
              >
                <Users size={13} /> Empleados
                {empleadosOcultos.size > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-green-600 text-white text-[10px] font-bold">
                    {empleados.length - empleadosOcultos.size}
                  </span>
                )}
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
                  <Popover.Popup className="w-72 rounded-xl border bg-popover text-popover-foreground shadow-lg outline-none flex flex-col max-h-96">
                    <div className="p-2 border-b space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mostrar empleados</p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setAllEmpleadosOcultos([])}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline"
                          >
                            Todos
                          </button>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <button
                            onClick={() => setAllEmpleadosOcultos(empleados.map(e => e.id))}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline"
                          >
                            Ninguno
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                          className="pl-7 h-8 text-xs"
                          placeholder="Buscar…"
                          value={empleadosSearch}
                          onChange={e => setEmpleadosSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                      {(() => {
                        const q = empleadosSearch.trim().toLowerCase()
                        const list = q
                          ? empleados.filter(e => `${e.apellido} ${e.nombre} ${e.legajo}`.toLowerCase().includes(q))
                          : empleados
                        if (list.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
                        return list.map(e => {
                          const visible = !empleadosOcultos.has(e.id)
                          return (
                            <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-accent">
                              <input
                                type="checkbox"
                                checked={visible}
                                onChange={() => toggleEmpleadoOculto(e.id)}
                                className="w-3.5 h-3.5 accent-green-700 shrink-0"
                              />
                              <span className={cn('flex-1 truncate', !visible && 'text-muted-foreground line-through')}>
                                {e.apellido}, {e.nombre}
                              </span>
                              <span className="text-muted-foreground text-[10px]">{e.legajo}</span>
                            </label>
                          )
                        })
                      })()}
                    </div>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)} className="relative">
              <SlidersHorizontal size={14} className="mr-1" /> Filtrar
              {filtrosActivos > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-green-600 text-white text-[10px] font-bold">
                  {filtrosActivos}
                </span>
              )}
            </Button>
          )}
          <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white" onClick={() => openCreate(toLocalDateStr(now))}>
            <Plus size={14} className="mr-1" /> Nuevo evento
          </Button>
        </div>
      </div>

      {/* Leyenda de tipos (incluye virtuales de Ausencias) */}
      {(() => {
        const virtualTipos = new Map<string, { nombre: string; color: string; label: string }>()
        for (const e of eventos) {
          if (!e.virtual || !e.tipo.startsWith('__ausencia__:')) continue
          if (!virtualTipos.has(e.tipo)) {
            virtualTipos.set(e.tipo, {
              nombre: e.tipo,
              color: e.color ?? '#6b7280',
              label: `Ausencia · ${e.subtipo ?? ''}`,
            })
          }
        }
        const items = [
          ...tipos.map(t => ({ nombre: t.nombre, color: t.color, label: formatTipoLabel(t.nombre) })),
          ...virtualTipos.values(),
        ]
        if (items.length === 0) return null
        return (
          <div className="px-6 py-2 border-b bg-muted/20 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Tipos:</span>
            {items.map(t => {
              const oculto = tiposOcultos.has(t.nombre)
              return (
                <button
                  key={t.nombre}
                  onClick={() => toggleTipoOculto(t.nombre)}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full border transition-all inline-flex items-center gap-1.5',
                    oculto ? 'opacity-40 border-dashed' : 'border-transparent'
                  )}
                  style={oculto ? {} : { backgroundColor: `${t.color}20`, color: t.color, borderColor: `${t.color}40` }}
                  title={oculto ? 'Mostrar' : 'Ocultar'}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.label}
                </button>
              )
            })}
            {tiposOcultos.size > 0 && (
              <button
                onClick={() => setTiposOcultos(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground ml-1 underline"
              >
                Mostrar todos
              </button>
            )}
          </div>
        )
      })()}

      {/* Filter bar (admin only) */}
      {isAdmin && showFilters && (
        <div className="px-6 py-3 border-b bg-muted/30 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Buscar en título o descripción..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
          </div>
          <select
            className="h-8 text-sm border rounded-md px-2 bg-background"
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {tipos.map(t => <option key={t.nombre} value={t.nombre}>{formatTipoLabel(t.nombre)}</option>)}
          </select>
          <select
            className="h-8 text-sm border rounded-md px-2 bg-background"
            value={filterEmpleadoId}
            onChange={e => setFilterEmpleadoId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Todos los empleados</option>
            {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.apellido}, {emp.nombre}</option>)}
          </select>
          {(filterText || filterTipo || filterEmpleadoId !== '') && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterText(''); setFilterTipo(''); setFilterEmpleadoId('') }}>
              <X size={13} className="mr-1" /> Limpiar
            </Button>
          )}
        </div>
      )}

      {/* Grid mes */}
      {vista === 'mes' && (
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-7 border-l border-t rounded-lg overflow-hidden">
          {DIAS.map((d, dIdx) => (
            <div key={d} className={cn(
              'border-r border-b px-2 py-1.5 text-xs font-medium text-muted-foreground text-center',
              dIdx === 0 || dIdx === 6 ? 'bg-muted/60' : 'bg-muted'
            )}>
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            const dateStr = day ? `${anio}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
            const isToday = dateStr === todayStr
            const isWeekend = i % 7 === 0 || i % 7 === 6
            const evs = day ? eventosDelDia(day) : []
            return (
              <div
                key={i}
                className={cn(
                  'border-r border-b min-h-24 p-1.5 cursor-pointer hover:bg-muted/40 transition-colors',
                  !day && 'bg-muted/20 cursor-default',
                  isWeekend && day && 'bg-muted/25',
                  day && dragOverDate === dateStr && 'bg-green-100 dark:bg-green-950/40 ring-2 ring-green-500 ring-inset',
                )}
                onClick={() => day && openDay(dateStr)}
                onDragOver={ev => { if (day && dragEvento) { ev.preventDefault(); if (dragOverDate !== dateStr) setDragOverDate(dateStr) } }}
                onDragLeave={() => { if (dragOverDate === dateStr) setDragOverDate(null) }}
                onDrop={ev => { if (day) { ev.preventDefault(); handleDropOn(dateStr) } }}
              >
                {day && (
                  <>
                    <span className={cn(
                      'text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full',
                      isToday ? 'bg-green-600 text-white' : isWeekend ? 'text-red-400' : 'text-muted-foreground'
                    )}>
                      {day}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {evs.slice(0, 3).map(e => {
                        const isStart = e.fechaInicio.slice(0, 10) === dateStr
                        const isEnd = (e.fechaFin ?? e.fechaInicio).slice(0, 10) === dateStr
                        const draggable = canDrag(e) && isStart
                        return (
                          <div
                            key={e.id}
                            onClick={ev => { ev.stopPropagation(); openEvent(e) }}
                            draggable={draggable}
                            onDragStart={ev => { if (draggable) { ev.stopPropagation(); ev.dataTransfer.effectAllowed = 'move'; setDragEvento(e) } }}
                            onDragEnd={() => { setDragEvento(null); setDragOverDate(null) }}
                            className={cn(
                              'text-xs text-white px-1 py-0.5 truncate hover:opacity-80',
                              draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                              isStart && isEnd ? 'rounded' : isStart ? 'rounded-l' : isEnd ? 'rounded-r' : 'rounded-none',
                              dragEvento?.id === e.id && 'opacity-50'
                            )}
                            style={{ backgroundColor: getEventColor(e) }}
                          >
                            {isStart && !e.todoElDia && (
                              <span className="opacity-75 mr-1">
                                {extractTime(e.fechaInicio)}{e.fechaFin ? ` - ${extractTime(e.fechaFin)}` : ''}
                              </span>
                            )}
                            {e.titulo}
                          </div>
                        )
                      })}
                      {evs.length > 3 && (
                        <span className="text-xs text-muted-foreground pl-1 cursor-pointer hover:underline" onClick={ev => { ev.stopPropagation(); openDay(dateStr) }}>+{evs.length - 3} más</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
      )}

      {/* Vista semana */}
      {vista === 'semana' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => {
              const dia = addDays(semanaRef, i)
              const dateStr = toLocalDateStr(dia)
              const evs = eventosFiltrados.filter(e => {
                const inicio = e.fechaInicio.slice(0, 10)
                const fin = (e.fechaFin ?? e.fechaInicio).slice(0, 10)
                return dateStr >= inicio && dateStr <= fin
              })
              const esHoy = dateStr === todayStr
              const esFinDeSemana = i === 0 || i === 6
              return (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col rounded-lg border overflow-hidden transition-colors',
                    dragOverDate === dateStr && 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950/40'
                  )}
                  onDragOver={ev => { if (dragEvento) { ev.preventDefault(); if (dragOverDate !== dateStr) setDragOverDate(dateStr) } }}
                  onDragLeave={() => { if (dragOverDate === dateStr) setDragOverDate(null) }}
                  onDrop={ev => { ev.preventDefault(); handleDropOn(dateStr) }}
                >
                  <div
                    className={cn(
                      'px-3 py-2 border-b text-center cursor-pointer hover:bg-muted transition-colors',
                      esHoy ? 'bg-green-600 text-white' : esFinDeSemana ? 'bg-muted/40' : 'bg-muted/20'
                    )}
                    onClick={() => openDay(dateStr)}
                  >
                    <p className={cn('text-[11px] uppercase font-medium', esHoy ? 'text-white/80' : 'text-muted-foreground')}>{DIAS[i]}</p>
                    <p className={cn('text-lg font-semibold', esHoy ? 'text-white' : 'text-foreground')}>{dia.getDate()}</p>
                  </div>
                  <div className="flex-1 p-1.5 space-y-1 min-h-96">
                    {evs.length === 0 && (
                      <p className="text-xs text-muted-foreground/60 text-center py-4">—</p>
                    )}
                    {evs.map(e => {
                      const isStart = e.fechaInicio.slice(0, 10) === dateStr
                      const draggable = canDrag(e) && isStart
                      return (
                        <div
                          key={e.id}
                          onClick={() => openEvent(e)}
                          draggable={draggable}
                          onDragStart={ev => { if (draggable) { ev.stopPropagation(); ev.dataTransfer.effectAllowed = 'move'; setDragEvento(e) } }}
                          onDragEnd={() => { setDragEvento(null); setDragOverDate(null) }}
                          className={cn(
                            'text-xs text-white px-1.5 py-1 rounded hover:opacity-80 truncate',
                            draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                            dragEvento?.id === e.id && 'opacity-50'
                          )}
                          style={{ backgroundColor: getEventColor(e) }}
                          title={e.titulo}
                        >
                          {!e.todoElDia && (
                            <span className="opacity-75 mr-1">{extractTime(e.fechaInicio)}</span>
                          )}
                          {e.titulo}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Vista lista */}
      {vista === 'lista' && (
        <div className="flex-1 overflow-auto p-6">
          {(() => {
            const ordenados = [...eventosFiltrados].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))
            if (ordenados.length === 0) {
              return <p className="text-sm text-muted-foreground text-center py-12">No hay eventos este mes.</p>
            }
            const grupos = new Map<string, Evento[]>()
            for (const e of ordenados) {
              const k = e.fechaInicio.slice(0, 10)
              const arr = grupos.get(k) ?? []
              arr.push(e)
              grupos.set(k, arr)
            }
            return (
              <div className="space-y-4 max-w-3xl mx-auto">
                {[...grupos.entries()].map(([fecha, evs]) => {
                  const d = new Date(fecha + 'T00:00:00')
                  const esHoy = fecha === todayStr
                  return (
                    <div key={fecha} className="flex gap-4">
                      <div className="w-16 text-center shrink-0">
                        <p className={cn('text-[10px] uppercase font-medium', esHoy ? 'text-green-600' : 'text-muted-foreground')}>
                          {DIAS[d.getDay()]}
                        </p>
                        <p className={cn('text-2xl font-bold leading-tight', esHoy ? 'text-green-600' : 'text-foreground')}>
                          {d.getDate()}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">{MESES[d.getMonth()].slice(0, 3)}</p>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {evs.map(e => (
                          <div
                            key={e.id}
                            onClick={() => openEvent(e)}
                            className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: getEventColor(e) }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{e.titulo}</p>
                              {e.descripcion && <p className="text-xs text-muted-foreground truncate">{e.descripcion}</p>}
                              <p className="text-xs text-muted-foreground mt-0.5">
                                <span className="capitalize">{formatTipoLabel(e.tipo)}</span>
                                {e.subtipo && ` · ${e.subtipo}`}
                                {!e.todoElDia && ` · ${extractTime(e.fechaInicio)}${e.fechaFin ? ` – ${extractTime(e.fechaFin)}` : ''}`}
                                {e.todoElDia && ' · Todo el día'}
                                {e.asignados.length > 0 && ` · ${e.asignados.length} asignado${e.asignados.length === 1 ? '' : 's'}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={!!dialog} onOpenChange={open => { if (!open) setDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'view' || dialog?.mode === 'view-employee'
                ? dialog.evento?.titulo
                : dialog?.mode === 'edit' ? 'Editar evento'
                : dialog?.mode === 'day' ? dialog.fecha
                : 'Nuevo evento'}
            </DialogTitle>
          </DialogHeader>

          {/* Day view */}
          {dialog?.mode === 'day' && (() => {
            const dayEvs = dialog.fecha ? eventosFiltrados.filter(e => {
              const inicio = e.fechaInicio.slice(0, 10)
              const fin = (e.fechaFin ?? e.fechaInicio).slice(0, 10)
              return dialog.fecha! >= inicio && dialog.fecha! <= fin
            }) : []
            return (
              <div className="space-y-2 py-1">
                {dayEvs.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay eventos este día.</p>
                )}
                {dayEvs.map(e => (
                  <div
                    key={e.id}
                    onClick={() => openEvent(e)}
                    className="flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getEventColor(e) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTipoLabel(e.tipo)}
                        {!e.todoElDia && ` · ${extractTime(e.fechaInicio)}${e.fechaFin ? ` - ${extractTime(e.fechaFin)}` : ''}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* View mode (read-only) */}
          {dialog?.mode === 'view' && (
            <div className="space-y-2 py-2 text-sm">
              {dialog.evento?.descripcion && <p className="text-muted-foreground">{dialog.evento.descripcion}</p>}
              <p><span className="font-medium">Fecha:</span> {dialog.evento?.fechaInicio.slice(0, 10)}</p>
              {!dialog.evento?.todoElDia && (
                <p><span className="font-medium">Hora:</span> {extractTime(dialog.evento!.fechaInicio)}</p>
              )}
              <p>
                <span className="font-medium">Tipo: </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dialog.evento ? getEventColor(dialog.evento) : '#6b7280' }} />
                  {dialog.evento?.virtual
                    ? `Ausencia · ${dialog.evento.subtipo ?? ''}`
                    : (
                      <>
                        {formatTipoLabel(dialog.evento?.tipo ?? '')}
                        {dialog.evento?.subtipo && <span className="text-muted-foreground">· {dialog.evento.subtipo}</span>}
                      </>
                    )}
                </span>
              </p>
            </div>
          )}

          {/* Admin views employee-created event */}
          {dialog?.mode === 'view-employee' && (
            <div className="space-y-3 py-2 text-sm">
              {dialog.evento?.descripcion && <p className="text-muted-foreground">{dialog.evento.descripcion}</p>}
              <p><span className="font-medium">Fecha:</span> {dialog.evento?.fechaInicio.slice(0, 10)}</p>
              {!dialog.evento?.todoElDia && (
                <p><span className="font-medium">Hora:</span> {extractTime(dialog.evento!.fechaInicio)}</p>
              )}
              <p>
                <span className="font-medium">Tipo: </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getTipoColor(dialog.evento?.tipo ?? '') }} />
                  {formatTipoLabel(dialog.evento?.tipo ?? '')}
                  {dialog.evento?.subtipo && <span className="text-muted-foreground">· {dialog.evento.subtipo}</span>}
                </span>
              </p>
              <p className="text-xs text-muted-foreground border-t pt-2">Creado por: {dialog.evento?.creadoPor?.email}</p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Comentario del administrador</label>
                <Textarea
                  rows={3}
                  placeholder="Agregar comentario..."
                  value={comentarioAdmin}
                  onChange={e => setComentarioAdmin(e.target.value)}
                  className="text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* Create / Edit form */}
          {(dialog?.mode === 'create' || dialog?.mode === 'edit') && (
            <div className="space-y-3 py-2">
              <Input
                placeholder="Título"
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                autoFocus
              />
              <Input
                placeholder="Descripción (opcional)"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              />

              {/* Todo el día toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="todoElDia"
                  checked={form.todoElDia}
                  onChange={e => setForm(f => ({ ...f, todoElDia: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="todoElDia" className="text-sm text-muted-foreground cursor-pointer">Todo el día</label>
              </div>

              {/* Date/time fields */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Inicio</label>
                  <Input type="date" value={form.fechaInicio} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} />
                  {!form.todoElDia && (
                    <Input type="time" className="mt-1" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} />
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fin (opcional)</label>
                  <Input type="date" value={form.fechaFin} onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))} />
                  {!form.todoElDia && (
                    <Input type="time" className="mt-1" value={form.horaFin} onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))} />
                  )}
                </div>
              </div>

              {/* Tipo selector */}
              {tiposDisponibles.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                  <div className="flex flex-wrap gap-2">
                    {tiposDisponibles.map(t => (
                      <button
                        key={t.nombre}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, tipo: t.nombre, employeeIds: t.permiteEmpleado ? f.employeeIds : [] }))}
                        className={cn(
                          'text-xs px-3 py-1.5 rounded border transition-colors',
                          form.tipo === t.nombre ? 'text-white border-transparent' : 'border-border text-muted-foreground hover:border-gray-400'
                        )}
                        style={form.tipo === t.nombre ? { backgroundColor: t.color } : {}}
                      >
                        {formatTipoLabel(t.nombre)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtipo (only when AUSENCIA) */}
              {form.tipo === 'AUSENCIA' && tiposAusencia.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Subtipo de ausencia</label>
                  <select
                    value={form.subtipo}
                    onChange={e => setForm(f => ({ ...f, subtipo: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Sin especificar</option>
                    {tiposAusencia.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                </div>
              )}

              {/* Employee assignment (only for non-employee-creatable tipos) */}
              {showAssignment && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">Asignar a empleados</label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={empleados.length > 0 && empleados.every(emp => form.employeeIds.includes(emp.id))}
                        ref={el => { if (el) el.indeterminate = form.employeeIds.length > 0 && !empleados.every(emp => form.employeeIds.includes(emp.id)) }}
                        onChange={e => setForm(f => ({
                          ...f,
                          employeeIds: e.target.checked ? empleados.map(emp => emp.id) : [],
                        }))}
                      />
                      Todos
                    </label>
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                    {empleados.map(emp => (
                      <label key={emp.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={form.employeeIds.includes(emp.id)}
                          onChange={e => setForm(f => ({
                            ...f,
                            employeeIds: e.target.checked
                              ? [...f.employeeIds, emp.id]
                              : f.employeeIds.filter(id => id !== emp.id)
                          }))}
                        />
                        {emp.apellido}, {emp.nombre}
                        <span className="text-muted-foreground text-xs">({emp.legajo})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {dialog?.mode === 'day' && (
              <>
                <Button variant="outline" onClick={() => setDialog(null)}><X size={14} className="mr-1" /> Cerrar</Button>
                <Button className="bg-green-700 hover:bg-green-800" onClick={() => openCreate(dialog.fecha!)}>
                  <Plus size={14} className="mr-1" /> Nuevo evento
                </Button>
              </>
            )}
            {(dialog?.mode === 'edit' || dialog?.mode === 'view-employee') && dialog.evento && (
              <Button
                variant="ghost"
                className="text-red-600 hover:text-red-700 mr-auto"
                onClick={() => setDeleteEventId(dialog!.evento!.id)}
              >
                <Trash2 size={14} className="mr-1" /> Eliminar
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialog(null)}>
              <X size={14} className="mr-1" /> Cerrar
            </Button>
            {dialog?.mode === 'view-employee' && (
              <Button className="bg-green-700 hover:bg-green-800" onClick={handleSaveComment} disabled={savingComment}>
                {savingComment ? 'Guardando...' : 'Guardar comentario'}
              </Button>
            )}
            {(dialog?.mode === 'create' || dialog?.mode === 'edit') && (
              <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteEventId}
        title="¿Eliminar este evento?"
        onConfirm={doDeleteEvento}
        onCancel={() => setDeleteEventId(null)}
      />
    </div>
  )
}
