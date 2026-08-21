'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { handleApiError } from '@/lib/apiErrors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'
import Link from 'next/link'
import { Calendar, CalendarOff, CheckCircle2, Clock, Paperclip, Plus, Search, SlidersHorizontal, Upload, X, XCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination, paginate } from '@/components/ui/pagination'
import { displayNameFromArchivoUrl } from '@/lib/aditusSolicitudes'

interface TipoAusencia { id: number; nombre: string; color: string; requiereAprobacion: boolean; activo: boolean; afectaSaldo: boolean }
interface SolicitudAusencia {
  id: number; estado: string; dias: number; motivo?: string; comentarioAdmin?: string; archivoUrl?: string
  fechaInicio: string; fechaFin: string; createdAt: string
  tipoAusencia: { nombre: string; color: string }
}
interface Saldo { diasTotales: number; diasUsados: number }

const ESTADO_META: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  PENDIENTE: { icon: <Clock size={11} />, className: 'text-yellow-600 border-yellow-400', label: 'Pendiente' },
  APROBADA: { icon: <CheckCircle2 size={11} />, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Aprobada' },
  RECHAZADA: { icon: <XCircle size={11} />, className: 'text-red-500 border-red-400', label: 'Rechazada' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function diasHabiles(desde: string, hasta: string): number {
  if (!desde || !hasta) return 0
  const [yA, mA, dA] = desde.split('-').map(Number)
  const [yB, mB, dB] = hasta.split('-').map(Number)
  const a = new Date(yA, mA - 1, dA)
  const b = new Date(yB, mB - 1, dB)
  if (b < a) return 0
  let n = 0
  const cur = new Date(a)
  while (cur <= b) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) n++
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

export function MisLicencias() {
  const router = useRouter()
  const [ausencias, setAusencias] = useState<SolicitudAusencia[]>([])
  const [saldo, setSaldo] = useState<Saldo | null>(null)
  const [tiposAus, setTiposAus] = useState<TipoAusencia[]>([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState<SolicitudAusencia | null>(null)

  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [tipoSel, setTipoSel] = useState<TipoAusencia | null>(null)
  const [ausForm, setAusForm] = useState({ fechaInicio: '', fechaFin: '', motivo: '' })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'>('todos')
  const [tipoFiltro, setTipoFiltro] = useState<string>('')
  const [anio, setAnio] = useState<string>('')
  const [desde, setDesde] = useState<string>('')
  const [hasta, setHasta] = useState<string>('')
  const [vigenteEl, setVigenteEl] = useState<string>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setPage(1) }, [busqueda, estadoFiltro, tipoFiltro, anio, desde, hasta, vigenteEl])

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

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/empleado/ausencias')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(a => {
        setAusencias(a?.solicitudes ?? [])
        setSaldo(a?.saldo ?? null)
      })
      .catch(() => toast.error('No se pudieron cargar las licencias'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/ausencias/tipos').then(r => r.json()).then(t => setTiposAus(Array.isArray(t) ? t.filter((x: TipoAusencia) => x.activo) : [])).catch(() => {})
    load()
  }, [load])

  useEffect(() => {
    setAusForm({ fechaInicio: '', fechaFin: '', motivo: '' })
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [tipoSel])

  async function enviar() {
    if (!tipoSel) return
    if (!ausForm.fechaInicio || !ausForm.fechaFin) { toast.error('Completá las fechas'); return }
    setSaving(true)
    const fd = new FormData()
    fd.append('tipoAusenciaId', String(tipoSel.id))
    fd.append('fechaInicio', ausForm.fechaInicio)
    fd.append('fechaFin', ausForm.fechaFin)
    if (ausForm.motivo) fd.append('motivo', ausForm.motivo)
    if (file) fd.append('archivo', file)
    const res = await fetch('/api/empleado/ausencias', { method: 'POST', body: fd })
    setSaving(false)
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success('Solicitud enviada')
    setNuevaOpen(false); setTipoSel(null)
    load()
  }

  const restantes = saldo ? saldo.diasTotales - saldo.diasUsados : null
  const q = busqueda.trim().toLowerCase()
  const aniosDisponibles = [...new Set(ausencias.map(a => a.fechaInicio.slice(0, 4)))].sort((a, b) => Number(b) - Number(a))
  const rangoInvalido = !!desde && !!hasta && hasta < desde
  const filtradas = rangoInvalido ? [] : ausencias.filter(s => {
    if (estadoFiltro !== 'todos' && s.estado !== estadoFiltro) return false
    if (tipoFiltro && s.tipoAusencia.nombre !== tipoFiltro) return false
    if (anio && !s.fechaInicio.startsWith(`${anio}-`)) return false
    const ini = s.fechaInicio.slice(0, 10)
    const fin = s.fechaFin.slice(0, 10)
    // "Solicitud entre": la fechaInicio debe caer dentro de [desde, hasta]
    if (desde && ini < desde) return false
    if (hasta && ini > hasta) return false
    // "Vigente el": el día debe caer entre fechaInicio y fechaFin
    if (vigenteEl && (vigenteEl < ini || vigenteEl > fin)) return false
    if (q) {
      const hay = `${s.tipoAusencia.nombre} ${s.motivo ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const sorted = [...filtradas].sort((a, b) => {
    const aP = a.estado === 'PENDIENTE' ? 0 : 1
    const bP = b.estado === 'PENDIENTE' ? 0 : 1
    if (aP !== bP) return aP - bP
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  return (
    <div className="space-y-4">
      {saldo && (
        <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 p-4 flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">{restantes}</p>
            <p className="text-xs text-muted-foreground mt-0.5">días restantes</p>
          </div>
          <div className="flex-1 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Días totales</span><span>{saldo.diasTotales}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Días usados</span><span>{saldo.diasUsados}</span></div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por tipo o motivo…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setFiltersOpen(v => !v)}
          className={cn(activeFiltersCount > 0 && 'border-green-500 text-green-700 dark:text-green-400')}
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
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <X size={12} className="mr-1" /> Limpiar
          </Button>
        )}
        <Button className="ml-auto bg-green-700 hover:bg-green-800" onClick={() => setNuevaOpen(true)}>
          <Plus size={16} className="mr-1" /> Nueva licencia
        </Button>
      </div>

      {filtersOpen && (
        <div className="flex flex-wrap gap-3 items-end p-4 bg-muted/30 border border-border rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Estado</p>
            <Select value={estadoFiltro} onValueChange={v => v && setEstadoFiltro(v as typeof estadoFiltro)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" alignItemWithTrigger={false}>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="APROBADA">Aprobada</SelectItem>
                <SelectItem value="RECHAZADA">Rechazada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tipo</p>
            <Select value={tipoFiltro || 'todos'} onValueChange={v => setTipoFiltro(!v || v === 'todos' ? '' : v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" alignItemWithTrigger={false}>
                <SelectItem value="todos">Todos</SelectItem>
                {tiposAus.map(t => <SelectItem key={t.id} value={t.nombre}>{t.nombre}</SelectItem>)}
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
            <p className="text-xs text-muted-foreground mb-1" title="Muestra licencias que abarquen ese día">Incluye</p>
            <Input type="date" value={vigenteEl} onChange={e => setVigenteEl(e.target.value)} className="h-9 w-40" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <CalendarOff size={32} strokeWidth={1.2} />
          <p className="text-sm">{rangoInvalido ? 'La fecha "Desde" no puede ser posterior a "Hasta"' : 'Sin licencias registradas'}</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Licencia</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Período</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Solicitado</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginate(sorted, page, pageSize).map(s => {
                const meta = ESTADO_META[s.estado]
                return (
                  <tr
                    key={s.id}
                    className="border-t cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setDetalle(s)}
                  >
                    <td className="px-4 py-2 font-medium min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.tipoAusencia.color }} />
                        <CalendarOff size={13} className="text-muted-foreground shrink-0" />
                        <span className="truncate">{s.tipoAusencia.nombre}</span>
                      </div>
                      {s.motivo && (
                        <p className="text-[11px] text-muted-foreground pl-7 truncate">{s.motivo}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {fmt(s.fechaInicio)} – {fmt(s.fechaFin)} · {s.dias} día{s.dias !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden lg:table-cell">
                      {fmt(s.createdAt)}
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
                            href={`/empleado/calendario?range=${s.fechaInicio.slice(0, 10)}:${s.fechaFin.slice(0, 10)}`}
                            className="inline-flex items-center gap-1 h-7 px-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-muted rounded"
                            title="Ver en el calendario"
                          >
                            <Calendar size={12} /> Calendario
                          </Link>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetalle(s)}>
                          Ver
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <Pagination
          page={page} pageSize={pageSize} total={sorted.length}
          itemLabel="licencias"
          onPageChange={setPage} onPageSizeChange={setPageSize}
        />
      )}

      {/* Nueva licencia */}
      <Dialog open={nuevaOpen} onOpenChange={v => { if (!v) { setNuevaOpen(false); setTipoSel(null) } }}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0"><DialogTitle>Nueva licencia</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                <CalendarOff size={11} /> Tipo
              </p>
              <div className="grid grid-cols-2 gap-2">
                {tiposAus.map(t => {
                  const sel = tipoSel?.id === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTipoSel(t)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors',
                        sel
                          ? 'border-green-600 bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 font-medium'
                          : 'border-border hover:border-green-400 hover:bg-muted/50'
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      <span className="truncate">{t.nombre}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {tipoSel && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fecha inicio *</p>
                    <Input type="date" value={ausForm.fechaInicio} onChange={e => setAusForm(f => ({ ...f, fechaInicio: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fecha fin *</p>
                    <Input type="date" value={ausForm.fechaFin} onChange={e => setAusForm(f => ({ ...f, fechaFin: e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
                {(() => {
                  if (!tipoSel.afectaSaldo || !saldo) return null
                  const solicitados = diasHabiles(ausForm.fechaInicio, ausForm.fechaFin)
                  if (solicitados === 0) return null
                  const rest = saldo.diasTotales - saldo.diasUsados
                  if (solicitados <= rest) {
                    return <p className="text-xs text-muted-foreground">{solicitados} día{solicitados !== 1 ? 's' : ''} hábiles · te quedarían {rest - solicitados}</p>
                  }
                  return (
                    <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                      Estás solicitando {solicitados} días hábiles pero solo te quedan {rest}. Podés enviar la solicitud igual; queda a criterio del administrador aprobarla.
                    </div>
                  )
                })()}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Motivo (opcional)</p>
                  <Input value={ausForm.motivo} onChange={e => setAusForm(f => ({ ...f, motivo: e.target.value }))} className="h-8 text-sm" placeholder="Ej: vacaciones familiares" />
                </div>
                <div>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  <Button variant="outline" className="w-full justify-start gap-2 font-normal" onClick={() => fileRef.current?.click()}>
                    {file
                      ? <><Paperclip size={14} className="shrink-0" /><span className="truncate text-sm">{file.name}</span></>
                      : <><Upload size={14} className="shrink-0 text-muted-foreground" /><span className="text-muted-foreground">Adjuntar archivo (opcional)…</span></>}
                  </Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => { setNuevaOpen(false); setTipoSel(null) }}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" disabled={!tipoSel || saving} onClick={enviar}>
              {saving ? 'Enviando…' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle */}
      <Dialog open={detalle !== null} onOpenChange={v => !v && setDetalle(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{detalle?.tipoAusencia.nombre}</DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{fmt(detalle.fechaInicio)} – {fmt(detalle.fechaFin)} · {detalle.dias} día{detalle.dias !== 1 ? 's' : ''}</p>
              {detalle.motivo && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground mb-0.5">Tu motivo</p>
                  <p>{detalle.motivo}</p>
                </div>
              )}
              {detalle.comentarioAdmin && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground mb-0.5">Comentario de RRHH</p>
                  <p>{detalle.comentarioAdmin}</p>
                </div>
              )}
              {detalle.archivoUrl && (
                <button
                  onClick={() => setPreview({ url: detalle.archivoUrl!, filename: displayNameFromArchivoUrl(detalle.archivoUrl) || undefined })}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <Paperclip size={13} /> Ver adjunto
                </button>
              )}
            </div>
          )}
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
