'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Search, SlidersHorizontal } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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
  comentarioAdmin?: string | null
  creadoPorId: number
  creadoPor?: { email: string; role: string }
  asignados: Asignado[]
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

export function CalendarioView({ isAdmin = false, empleados = [], currentUserId, currentEmployeeId, googleConnected }: Props) {
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())
  const [eventos, setEventos] = useState<Evento[]>([])
  const [tipos, setTipos] = useState<TipoEvento[]>([])
  const [dialog, setDialog] = useState<{ mode: DialogMode; evento?: Evento; fecha?: string } | null>(null)
  const [form, setForm] = useState({
    titulo: '', descripcion: '',
    fechaInicio: '', horaInicio: '08:00',
    fechaFin: '', horaFin: '',
    todoElDia: true,
    tipo: 'PERSONAL',
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
    fetch(`/api/eventos?mes=${mes}&anio=${anio}`)
      .then(r => r.json())
      .then(setEventos)
  }, [mes, anio])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/configuracion/tipos-evento').then(r => r.json()).then(setTipos)
  }, [])

  useEffect(() => {
    if (!googleConnected) return
    fetch('/api/calendario/google/sync', { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) load() })
  }, [googleConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  function prevMes() { if (mes === 1) { setMes(12); setAnio(a => a - 1) } else setMes(m => m - 1) }
  function nextMes() { if (mes === 12) { setMes(1); setAnio(a => a + 1) } else setMes(m => m + 1) }

  function getTipoColor(tipoNombre: string) {
    return tipos.find(t => t.nombre === tipoNombre)?.color ?? '#6b7280'
  }

  const tiposDisponibles = tipos.filter(t => isAdmin ? t.permiteAdmin : t.permiteEmpleado)

  function defaultTipo() {
    return tiposDisponibles[0]?.nombre ?? 'PERSONAL'
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
      todoElDia: true, tipo,
      employeeIds: currentEmployeeId ? [currentEmployeeId] : [],
    })
    setDialog({ mode: 'create', fecha })
  }

  function openEvent(e: Evento) {
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
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error al guardar'); return }
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
    if (!res.ok) { toast.error('Error al guardar comentario'); return }
    toast.success('Comentario guardado')
    load()
  }

  async function doDeleteEvento() {
    if (!deleteEventId) return
    const res = await fetch(`/api/eventos/${deleteEventId}`, { method: 'DELETE' })
    setDeleteEventId(null)
    if (!res.ok) { toast.error('Error al eliminar'); return }
    toast.success('Evento eliminado')
    setDialog(null)
    load()
  }

  // Filter eventos
  const eventosFiltrados = eventos.filter(e => {
    if (filterText) {
      const q = filterText.toLowerCase()
      if (!e.titulo.toLowerCase().includes(q) && !(e.descripcion?.toLowerCase().includes(q))) return false
    }
    if (filterTipo && e.tipo !== filterTipo) return false
    if (filterEmpleadoId !== '' && !e.asignados.some(a => a.employeeId === filterEmpleadoId)) return false
    return true
  })

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
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={prevMes}><ChevronLeft size={16} /></Button>
          <h2 className="text-lg font-semibold w-44 text-center">{MESES[mes - 1]} {anio}</h2>
          <Button variant="ghost" size="sm" onClick={nextMes}><ChevronRight size={16} /></Button>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)}>
              <SlidersHorizontal size={14} className="mr-1" /> Filtrar
            </Button>
          )}
          <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white" onClick={() => openCreate(toLocalDateStr(now))}>
            <Plus size={14} className="mr-1" /> Nuevo evento
          </Button>
        </div>
      </div>

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

      {/* Grid */}
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
                )}
                onClick={() => day && openDay(dateStr)}
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
                        return (
                          <div
                            key={e.id}
                            onClick={ev => { ev.stopPropagation(); openEvent(e) }}
                            className={cn(
                              'text-xs text-white px-1 py-0.5 truncate cursor-pointer hover:opacity-80',
                              isStart && isEnd ? 'rounded' : isStart ? 'rounded-l' : isEnd ? 'rounded-r' : 'rounded-none'
                            )}
                            style={{ backgroundColor: getTipoColor(e.tipo) }}
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
                    <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getTipoColor(e.tipo) }} />
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
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getTipoColor(dialog.evento?.tipo ?? '') }} />
                  {formatTipoLabel(dialog.evento?.tipo ?? '')}
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
