'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { handleApiError } from '@/lib/apiErrors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'
import { TabSaldos } from '@/components/ausencias/AusenciasAdmin'
import Link from 'next/link'
import { Calendar, CalendarOff, Check, CheckCircle2, Clock, Paperclip, Search, SlidersHorizontal, X, XCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination, paginate } from '@/components/ui/pagination'
import { displayNameFromArchivoUrl } from '@/lib/aditusSolicitudes'

interface SolicitudAus {
  id: number; estado: string; dias: number; motivo?: string; comentarioAdmin?: string; archivoUrl?: string
  fechaInicio: string; fechaFin: string; createdAt: string
  canApprove: boolean
  employee: { id: number; nombre: string; apellido: string; legajo: string }
  tipoAusencia: { id: number; nombre: string; color: string; afectaSaldo: boolean }
}

const ESTADO_META: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  PENDIENTE: { icon: <Clock size={11} />, className: 'text-yellow-600 border-yellow-400', label: 'Pendiente' },
  APROBADA: { icon: <CheckCircle2 size={11} />, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Aprobada' },
  RECHAZADA: { icon: <XCircle size={11} />, className: 'text-red-500 border-red-400', label: 'Rechazada' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

const TABS = [
  { id: 'solicitudes', label: 'Peticiones' },
  { id: 'saldos', label: 'Saldos de vacaciones' },
] as const
type Tab = typeof TABS[number]['id']

export function LicenciasAdmin() {
  const [tab, setTab] = useState<Tab>('solicitudes')
  return (
    <>
      <div className="flex border-b mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'solicitudes' && <SolicitudesAusencia />}
      {tab === 'saldos' && <TabSaldos />}
    </>
  )
}

function SolicitudesAusencia() {
  const router = useRouter()
  const [items, setItems] = useState<SolicitudAus[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [tipoFiltro, setTipoFiltro] = useState<string>('')
  const [anio, setAnio] = useState<string>('')
  const [desde, setDesde] = useState<string>('')
  const [hasta, setHasta] = useState<string>('')
  const [vigenteEl, setVigenteEl] = useState<string>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [review, setReview] = useState<SolicitudAus | null>(null)
  const [comentario, setComentario] = useState('')
  const [saldoReview, setSaldoReview] = useState<{ diasTotales: number; diasUsados: number } | null>(null)
  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkReview, setBulkReview] = useState<'APROBADA' | 'RECHAZADA' | null>(null)
  const [bulkComentario, setBulkComentario] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useEffect(() => { setPage(1) }, [estadoFiltro, tipoFiltro, anio, desde, hasta, vigenteEl, qDebounced])

  const activeFiltersCount =
    (estadoFiltro !== 'todos' ? 1 : 0) +
    (tipoFiltro ? 1 : 0) +
    (anio ? 1 : 0) +
    (desde ? 1 : 0) +
    (hasta ? 1 : 0) +
    (vigenteEl ? 1 : 0)

  function clearAllFilters() {
    setEstadoFiltro('todos'); setTipoFiltro(''); setAnio(''); setDesde(''); setHasta(''); setVigenteEl('')
  }

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!review || !review.tipoAusencia.afectaSaldo) { setSaldoReview(null); return }
    const anio = new Date(review.fechaInicio).getFullYear()
    fetch(`/api/ausencias/saldo?employeeId=${review.employee.id}&anio=${anio}`)
      .then(r => r.ok ? r.json() : null)
      .then(s => setSaldoReview(s))
      .catch(() => setSaldoReview(null))
  }, [review])

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/ausencias/solicitudes')
      .then(r => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const tiposEnItems = [...new Set(items.map(s => s.tipoAusencia.nombre))].sort()
  const aniosDisponibles = [...new Set(items.map(s => s.fechaInicio.slice(0, 4)))].sort((a, b) => Number(b) - Number(a))
  const rangoInvalido = !!desde && !!hasta && hasta < desde

  const filtered = (rangoInvalido ? [] : items).filter(s => {
    if (estadoFiltro !== 'todos' && s.estado !== estadoFiltro) return false
    if (tipoFiltro && s.tipoAusencia.nombre !== tipoFiltro) return false
    if (anio && !s.fechaInicio.startsWith(`${anio}-`)) return false
    const ini = s.fechaInicio.slice(0, 10)
    const fin = s.fechaFin.slice(0, 10)
    if (desde && ini < desde) return false
    if (hasta && ini > hasta) return false
    if (vigenteEl && (vigenteEl < ini || vigenteEl > fin)) return false
    if (qDebounced) {
      const nombre = `${s.employee.apellido} ${s.employee.nombre}`.toLowerCase()
      if (!nombre.includes(qDebounced) && !s.employee.legajo.toLowerCase().includes(qDebounced)) return false
    }
    return true
  }).sort((a, b) => {
    const aP = a.estado === 'PENDIENTE' ? 0 : 1
    const bP = b.estado === 'PENDIENTE' ? 0 : 1
    if (aP !== bP) return aP - bP
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const resolvables = filtered.filter(s => s.estado === 'PENDIENTE' && s.canApprove)
  const selectedResolvables = resolvables.filter(s => selected.has(s.id))
  const allResolvablesSelected = resolvables.length > 0 && resolvables.every(s => selected.has(s.id))
  const someSelected = selectedResolvables.length > 0 && !allResolvablesSelected

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (allResolvablesSelected) setSelected(new Set())
    else setSelected(new Set(resolvables.map(s => s.id)))
  }

  async function resolver(estado: 'APROBADA' | 'RECHAZADA') {
    if (!review) return
    const res = await fetch(`/api/ausencias/solicitudes/${review.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, comentarioAdmin: comentario }),
    })
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success(estado === 'APROBADA' ? 'Solicitud aprobada' : 'Solicitud rechazada')
    setReview(null); setComentario('')
    load()
    router.refresh()
  }

  async function handleBulkReview() {
    if (!bulkReview || selectedResolvables.length === 0) return
    setBulkProcessing(true)
    const coment = bulkComentario.trim()
    let ok = 0, fail = 0
    for (const s of selectedResolvables) {
      const res = await fetch(`/api/ausencias/solicitudes/${s.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: bulkReview, comentarioAdmin: coment }),
      })
      if (res.ok) ok++; else fail++
    }
    setBulkProcessing(false)
    setBulkReview(null); setBulkComentario(''); setSelected(new Set())
    if (ok > 0) toast.success(`${ok} ${bulkReview === 'APROBADA' ? 'aprobada(s)' : 'rechazada(s)'}`)
    if (fail > 0) toast.error(`${fail} no se pudo(ieron) resolver`)
    load()
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-56 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9"
            placeholder="Buscar por nombre o legajo…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-9', activeFiltersCount > 0 && 'border-green-500 text-green-700 dark:text-green-400')}
          onClick={() => setFiltersOpen(v => !v)}
        >
          <SlidersHorizontal size={14} className="mr-1.5" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-green-600 text-white text-[10px] font-semibold">
              {activeFiltersCount}
            </span>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearAllFilters}>
            <X size={12} className="mr-1" /> Limpiar
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {items.length}
        </span>
      </div>

      {filtersOpen && (
        <div className="flex flex-wrap gap-3 items-end p-4 bg-muted/30 border border-border rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Estado</p>
            <Select value={estadoFiltro} onValueChange={v => v && setEstadoFiltro(v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" alignItemWithTrigger={false}>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                <SelectItem value="APROBADA">Aprobadas</SelectItem>
                <SelectItem value="RECHAZADA">Rechazadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tipo</p>
            <Select value={tipoFiltro || 'todos'} onValueChange={v => setTipoFiltro(!v || v === 'todos' ? '' : v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" alignItemWithTrigger={false}>
                <SelectItem value="todos">Todos</SelectItem>
                {tiposEnItems.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Año</p>
            <Select value={anio || 'todos'} onValueChange={v => setAnio(!v || v === 'todos' ? '' : v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" alignItemWithTrigger={false}>
                <SelectItem value="todos">Todos</SelectItem>
                {aniosDisponibles.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Solicitud desde</p>
            <Input type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Solicitud hasta</p>
            <Input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1" title="Muestra licencias que abarquen ese día">Vigente el</p>
            <Input type="date" value={vigenteEl} onChange={e => setVigenteEl(e.target.value)} className="h-9 w-40" />
          </div>
        </div>
      )}

      {selectedResolvables.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm">{selectedResolvables.length} pendiente{selectedResolvables.length === 1 ? '' : 's'} seleccionado{selectedResolvables.length === 1 ? '' : 's'}</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-800 text-white h-8"
              onClick={() => { setBulkReview('APROBADA'); setBulkComentario('') }}
            >
              <Check size={14} className="mr-1" /> Aprobar {selectedResolvables.length}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 dark:border-red-900 dark:hover:bg-red-950/30 h-8"
              onClick={() => { setBulkReview('RECHAZADA'); setBulkComentario('') }}
            >
              <X size={14} className="mr-1" /> Rechazar {selectedResolvables.length}
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>
              Limpiar
            </Button>
          </div>
        </div>
      )}

      {resolvables.length > 0 && !loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Checkbox
            checked={allResolvablesSelected}
            indeterminate={someSelected}
            onCheckedChange={toggleAll}
            aria-label="Seleccionar todos los pendientes"
          />
          <span>Seleccionar todos los pendientes que podés resolver ({resolvables.length})</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {rangoInvalido ? 'La fecha "Desde" no puede ser posterior a "Hasta"' :
            items.length === 0 ? 'No hay solicitudes de ausencia.' : 'Sin coincidencias para los filtros aplicados.'}
        </p>
      ) : (
        <div className="border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-muted">
              <tr>
                <th className="w-10 px-3 py-2.5"></th>
                <th className="text-left px-4 py-2.5 font-medium">Empleado</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Legajo</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Motivo</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Desde</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Hasta</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Solicitado</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginate(filtered, page, pageSize).map(s => {
                const selectable = s.estado === 'PENDIENTE' && s.canApprove
                const isSelected = selected.has(s.id)
                const meta = ESTADO_META[s.estado]
                return (
                  <tr
                    key={s.id}
                    className={cn(
                      'border-t cursor-pointer hover:bg-muted/40 transition-colors',
                      isSelected && 'bg-green-50/50 dark:bg-green-950/10'
                    )}
                    onClick={() => { setReview(s); setComentario(s.comentarioAdmin ?? '') }}
                  >
                    <td className="px-3 py-2 w-10" onClick={e => e.stopPropagation()}>
                      {selectable && (
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(s.id)} aria-label="Seleccionar solicitud" />
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <CalendarOff size={13} className="text-muted-foreground shrink-0" />
                        <span className="truncate">{s.employee.apellido}, {s.employee.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">{s.employee.legajo}</td>
                    <td className="px-4 py-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.tipoAusencia.color }} />
                        <span className="truncate">{s.tipoAusencia.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden sm:table-cell max-w-[220px]">
                      <span className="truncate block" title={s.motivo || ''}>{s.motivo || '—'}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">{fmt(s.fechaInicio)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">{fmt(s.fechaFin)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-2">
                      {meta && (
                        <Badge variant="outline" className={cn('gap-1', meta.className)}>
                          {meta.icon} {meta.label}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {s.estado === 'APROBADA' && (
                          <Link
                            href={`/admin/calendario?range=${s.fechaInicio.slice(0, 10)}:${s.fechaFin.slice(0, 10)}`}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Ver en el calendario"
                          >
                            <Calendar size={13} />
                          </Link>
                        )}
                        <Button
                          size="sm"
                          variant={s.estado === 'PENDIENTE' ? 'outline' : 'ghost'}
                          className={cn(
                            'h-7 text-xs',
                            s.estado === 'PENDIENTE' && 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30',
                          )}
                          onClick={() => { setReview(s); setComentario(s.comentarioAdmin ?? '') }}
                        >
                          {s.estado === 'PENDIENTE' ? 'Revisar' : 'Ver'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-3 pb-2">
            <Pagination
              page={page} pageSize={pageSize} total={filtered.length}
              itemLabel="licencias"
              onPageChange={setPage} onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={review !== null} onOpenChange={v => !v && setReview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {review?.estado === 'PENDIENTE' ? 'Revisar solicitud de ausencia' : 'Detalle de solicitud'}
            </DialogTitle>
          </DialogHeader>
          {review && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-muted-foreground text-xs">Empleado</p><p className="font-medium">{review.employee.apellido}, {review.employee.nombre}</p></div>
                <div><p className="text-muted-foreground text-xs">Tipo</p><p className="font-medium">{review.tipoAusencia.nombre}</p></div>
                <div><p className="text-muted-foreground text-xs">Desde</p><p>{fmt(review.fechaInicio)}</p></div>
                <div><p className="text-muted-foreground text-xs">Hasta</p><p>{fmt(review.fechaFin)}</p></div>
                <div><p className="text-muted-foreground text-xs">Días hábiles</p><p>{review.dias}</p></div>
                <div><p className="text-muted-foreground text-xs">Solicitado</p><p>{fmt(review.createdAt)}</p></div>
              </div>
              {review.tipoAusencia.afectaSaldo && saldoReview && (() => {
                const restantes = saldoReview.diasTotales - saldoReview.diasUsados
                const despues = restantes - review.dias
                if (despues >= 0) {
                  return <p className="text-xs text-muted-foreground">Saldo: {restantes} disponibles · quedarían {despues} tras aprobar</p>
                }
                return (
                  <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                    ⚠ Al aprobar, el saldo quedaría en <strong>{despues}</strong> (solicita {review.dias} y le quedan {restantes}).
                  </div>
                )
              })()}
              {review.motivo && (
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Motivo</p>
                  <p>{review.motivo}</p>
                </div>
              )}
              {review.archivoUrl && (
                <button
                  onClick={() => setPreview({ url: review.archivoUrl!, filename: displayNameFromArchivoUrl(review.archivoUrl) || undefined })}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <Paperclip size={13} /> Ver adjunto
                </button>
              )}
              {review.estado === 'PENDIENTE' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Comentario (opcional)</label>
                  <Input className="mt-1" value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Ej: aprobado para la semana del 14/7" />
                </div>
              )}
              {review.estado !== 'PENDIENTE' && review.comentarioAdmin && (
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Comentario admin</p>
                  <p>{review.comentarioAdmin}</p>
                </div>
              )}
            </div>
          )}
          {review?.estado === 'PENDIENTE' && (
            review.canApprove ? (
              <DialogFooter className="gap-2">
                <Button variant="destructive" size="sm" onClick={() => resolver('RECHAZADA')}>
                  <XCircle size={14} className="mr-1" /> Rechazar
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" size="sm" onClick={() => resolver('APROBADA')}>
                  <CheckCircle2 size={14} className="mr-1" /> Aprobar
                </Button>
              </DialogFooter>
            ) : (
              <p className="text-xs text-muted-foreground italic px-1 pt-2">
                Solo el superior directo (o alguien más arriba) puede resolver esta solicitud.
              </p>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk dialog */}
      <Dialog open={bulkReview !== null} onOpenChange={v => { if (!v && !bulkProcessing) setBulkReview(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bulkReview === 'APROBADA'
                ? `Aprobar ${selectedResolvables.length} solicitud${selectedResolvables.length === 1 ? '' : 'es'}`
                : `Rechazar ${selectedResolvables.length} solicitud${selectedResolvables.length === 1 ? '' : 'es'}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Vas a resolver {selectedResolvables.length} solicitud{selectedResolvables.length === 1 ? '' : 'es'} a la vez.
              Podés agregar un comentario opcional.
            </p>
            <Input
              placeholder="Comentario opcional…"
              value={bulkComentario}
              onChange={e => setBulkComentario(e.target.value)}
              disabled={bulkProcessing}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkReview(null)} disabled={bulkProcessing}>Cancelar</Button>
            <Button
              className={bulkReview === 'APROBADA' ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
              onClick={handleBulkReview}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? 'Procesando…' : bulkReview === 'APROBADA' ? 'Aprobar' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ArchivoPreviewDialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        url={preview?.url ?? null}
        filename={preview?.filename ?? null}
      />
    </div>
  )
}
