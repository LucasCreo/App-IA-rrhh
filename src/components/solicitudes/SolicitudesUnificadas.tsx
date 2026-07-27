'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Check, X, FileText, CalendarOff, Search, CheckCircle2, XCircle, Clock, Paperclip } from 'lucide-react'
import { handleApiError } from '@/lib/apiErrors'
import { cn } from '@/lib/utils'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'

interface CampoSolicitud { nombre: string; label: string }
interface SolicitudDoc {
  id: number; nombreArchivo?: string; estado: string
  descripcion?: string; comentario?: string; comentarioVisible: boolean
  metadata?: string; createdAt: string
  canApprove: boolean
  employee: { id: number; nombre: string; apellido: string; legajo: string }
  tipo: { id: number; nombre: string; campos?: CampoSolicitud[] }
}
interface SolicitudAus {
  id: number; estado: string; dias: number; motivo?: string; comentarioAdmin?: string; archivoUrl?: string
  fechaInicio: string; fechaFin: string; createdAt: string
  canApprove: boolean
  employee: { id: number; nombre: string; apellido: string; legajo: string }
  tipoAusencia: { id: number; nombre: string; color: string; afectaSaldo: boolean }
}

type ItemDoc = { kind: 'doc'; key: string; fecha: string; pendiente: boolean; estado: string; data: SolicitudDoc }
type ItemAus = { kind: 'aus'; key: string; fecha: string; pendiente: boolean; estado: string; data: SolicitudAus }
type Item = ItemDoc | ItemAus

const ESTADO_FILTROS = [
  { value: '', label: 'Todas' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'APROBADO', label: 'Aprobadas' },
  { value: 'RECHAZADO', label: 'Rechazadas' },
]

const TIPO_FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'doc', label: 'Documentos' },
  { value: 'aus', label: 'Ausencias' },
] as const

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

const ESTADO_AUS: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  PENDIENTE: { icon: <Clock size={11} />, className: 'text-yellow-600 border-yellow-400', label: 'Pendiente' },
  APROBADA: { icon: <CheckCircle2 size={11} />, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Aprobada' },
  RECHAZADA: { icon: <XCircle size={11} />, className: 'text-red-500 border-red-400', label: 'Rechazada' },
}

// Normalize estado to the doc-style (PENDIENTE / APROBADO / RECHAZADO) for filtering
function normEstado(estado: string): 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'OTRO' {
  if (estado === 'PENDIENTE') return 'PENDIENTE'
  if (estado === 'APROBADO' || estado === 'APROBADA') return 'APROBADO'
  if (estado === 'RECHAZADO' || estado === 'RECHAZADA') return 'RECHAZADO'
  return 'OTRO'
}

export function SolicitudesUnificadas() {
  const router = useRouter()
  const [docs, setDocs] = useState<SolicitudDoc[]>([])
  const [ausencias, setAusencias] = useState<SolicitudAus[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<typeof TIPO_FILTROS[number]['value']>('todos')
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')

  const [reviewDoc, setReviewDoc] = useState<{ solicitud: SolicitudDoc; estado: 'APROBADO' | 'RECHAZADO' } | null>(null)
  const [comentarioDoc, setComentarioDoc] = useState('')
  const [visibleDoc, setVisibleDoc] = useState(false)

  const [reviewAus, setReviewAus] = useState<SolicitudAus | null>(null)
  const [comentarioAus, setComentarioAus] = useState('')
  const [saldoReview, setSaldoReview] = useState<{ diasTotales: number; diasUsados: number } | null>(null)

  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkReview, setBulkReview] = useState<'APROBADO' | 'RECHAZADO' | null>(null)
  const [bulkComentario, setBulkComentario] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useEffect(() => {
    if (!reviewAus || !reviewAus.tipoAusencia.afectaSaldo) { setSaldoReview(null); return }
    const anio = new Date(reviewAus.fechaInicio).getFullYear()
    fetch(`/api/ausencias/saldo?employeeId=${reviewAus.employee.id}&anio=${anio}`)
      .then(r => r.ok ? r.json() : null)
      .then(s => setSaldoReview(s))
      .catch(() => setSaldoReview(null))
  }, [reviewAus])

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/solicitudes').then(r => r.json()).catch(() => []),
      fetch('/api/ausencias/solicitudes').then(r => r.json()).catch(() => []),
    ]).then(([d, a]) => {
      setDocs(Array.isArray(d) ? d : [])
      setAusencias(Array.isArray(a) ? a : [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function resolverDoc() {
    if (!reviewDoc) return
    const res = await fetch(`/api/solicitudes/${reviewDoc.solicitud.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: reviewDoc.estado, comentario: comentarioDoc, comentarioVisible: visibleDoc }),
    })
    if (!res.ok) { toast.error('Error al actualizar la solicitud'); return }
    toast.success(reviewDoc.estado === 'APROBADO' ? 'Solicitud aprobada' : 'Solicitud rechazada')
    setReviewDoc(null); setComentarioDoc(''); setVisibleDoc(false)
    load()
    router.refresh()
  }

  async function resolverAus(estado: 'APROBADA' | 'RECHAZADA') {
    if (!reviewAus) return
    const res = await fetch(`/api/ausencias/solicitudes/${reviewAus.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, comentarioAdmin: comentarioAus }),
    })
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success(estado === 'APROBADA' ? 'Solicitud aprobada' : 'Solicitud rechazada')
    setReviewAus(null); setComentarioAus('')
    load()
    router.refresh()
  }

  const items: Item[] = [
    ...docs.map<ItemDoc>(d => ({ kind: 'doc', key: `d-${d.id}`, fecha: d.createdAt, pendiente: d.estado === 'PENDIENTE', estado: d.estado, data: d })),
    ...ausencias.map<ItemAus>(a => ({ kind: 'aus', key: `a-${a.id}`, fecha: a.createdAt, pendiente: a.estado === 'PENDIENTE', estado: a.estado, data: a })),
  ]

  const filtered = items.filter(i => {
    if (tipoFiltro !== 'todos' && i.kind !== tipoFiltro) return false
    if (estadoFiltro && normEstado(i.estado) !== estadoFiltro) return false
    if (qDebounced) {
      const emp = i.kind === 'doc' ? i.data.employee : i.data.employee
      const nombre = `${emp.apellido} ${emp.nombre}`.toLowerCase()
      if (!nombre.includes(qDebounced) && !emp.legajo.toLowerCase().includes(qDebounced)) return false
    }
    return true
  }).sort((a, b) => {
    if (a.pendiente !== b.pendiente) return a.pendiente ? -1 : 1
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  })

  const counts = {
    total: items.length,
    doc: items.filter(i => i.kind === 'doc').length,
    aus: items.filter(i => i.kind === 'aus').length,
  }

  // Solo se pueden aprobar/rechazar los pendientes que además canApprove
  const resolvables = filtered.filter(i => i.pendiente && i.data.canApprove)
  const selectedResolvables = resolvables.filter(i => selected.has(i.key))
  const allResolvablesSelected = resolvables.length > 0 && resolvables.every(i => selected.has(i.key))
  const someSelected = selectedResolvables.length > 0 && !allResolvablesSelected

  function toggleOne(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  function toggleAllResolvables() {
    if (allResolvablesSelected) setSelected(new Set())
    else setSelected(new Set(resolvables.map(i => i.key)))
  }

  async function handleBulkReview() {
    if (!bulkReview || selectedResolvables.length === 0) return
    setBulkProcessing(true)
    const coment = bulkComentario.trim()
    let ok = 0, fail = 0
    for (const item of selectedResolvables) {
      let res: Response
      if (item.kind === 'doc') {
        res = await fetch(`/api/solicitudes/${item.data.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: bulkReview, comentario: coment, comentarioVisible: !!coment }),
        })
      } else {
        const estadoAus = bulkReview === 'APROBADO' ? 'APROBADA' : 'RECHAZADA'
        res = await fetch(`/api/ausencias/solicitudes/${item.data.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: estadoAus, comentarioAdmin: coment }),
        })
      }
      if (res.ok) ok++
      else fail++
    }
    setBulkProcessing(false)
    setBulkReview(null); setBulkComentario(''); setSelected(new Set())
    if (ok > 0) toast.success(`${ok} ${bulkReview === 'APROBADO' ? 'aprobada(s)' : 'rechazada(s)'}`)
    if (fail > 0) toast.error(`${fail} no se pudo(ieron) resolver`)
    load()
    router.refresh()
  }

  const esAprobacionDoc = reviewDoc?.estado === 'APROBADO'

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b pb-0">
        {ESTADO_FILTROS.map(f => (
          <button
            key={f.value}
            onClick={() => setEstadoFiltro(f.value)}
            className={cn(
              'cursor-pointer px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              estadoFiltro === f.value
                ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

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
        <div className="flex gap-1 flex-wrap">
          {TIPO_FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => setTipoFiltro(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                tipoFiltro === f.value
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {f.label}
              <span className="opacity-60">
                {f.value === 'todos' ? counts.total : f.value === 'doc' ? counts.doc : counts.aus}
              </span>
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {items.length}
        </span>
      </div>

      {selectedResolvables.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm">{selectedResolvables.length} pendiente{selectedResolvables.length === 1 ? '' : 's'} seleccionado{selectedResolvables.length === 1 ? '' : 's'}</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-800 text-white h-8"
              onClick={() => { setBulkReview('APROBADO'); setBulkComentario('') }}
            >
              <Check size={14} className="mr-1" /> Aprobar {selectedResolvables.length}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30 h-8"
              onClick={() => { setBulkReview('RECHAZADO'); setBulkComentario('') }}
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
            onCheckedChange={toggleAllResolvables}
            aria-label="Seleccionar todos los pendientes"
          />
          <span>Seleccionar todos los pendientes que podés resolver ({resolvables.length})</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {items.length === 0 ? 'No hay solicitudes.' : 'Sin coincidencias para los filtros aplicados.'}
        </p>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {filtered.map(item => {
            const selectable = item.pendiente && item.data.canApprove
            const isSelected = selected.has(item.key)
            return item.kind === 'doc' ? (
              <RowDoc
                key={item.key}
                s={item.data}
                selectable={selectable}
                selected={isSelected}
                onToggleSelect={() => toggleOne(item.key)}
                onReview={(estado) => { setReviewDoc({ solicitud: item.data, estado }); setComentarioDoc(''); setVisibleDoc(false) }}
                onPreview={(nombreArchivo) => setPreview({ url: `/api/solicitudes/archivo?file=${nombreArchivo}`, filename: nombreArchivo })}
              />
            ) : (
              <RowAus
                key={item.key}
                s={item.data}
                selectable={selectable}
                selected={isSelected}
                onToggleSelect={() => toggleOne(item.key)}
                onReview={() => { setReviewAus(item.data); setComentarioAus(item.data.comentarioAdmin ?? '') }}
              />
            )
          })}
        </div>
      )}

      {/* Review doc dialog */}
      <Dialog open={reviewDoc !== null} onOpenChange={v => !v && setReviewDoc(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{esAprobacionDoc ? 'Aprobar solicitud' : 'Rechazar solicitud'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">Podés agregar un comentario opcional para el empleado.</p>
            <Textarea
              placeholder="Ej: Todo en orden, muchas gracias…"
              value={comentarioDoc}
              onChange={e => setComentarioDoc(e.target.value)}
              rows={3}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="visible"
                checked={visibleDoc}
                onCheckedChange={v => setVisibleDoc(v === true)}
                disabled={!comentarioDoc.trim()}
              />
              <label htmlFor="visible" className={cn('text-sm select-none', !comentarioDoc.trim() && 'text-muted-foreground/50')}>
                Mostrar comentario al empleado
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDoc(null)}>Cancelar</Button>
            <Button
              className={esAprobacionDoc ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
              onClick={resolverDoc}
            >
              {esAprobacionDoc ? 'Aprobar' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review ausencia dialog */}
      <Dialog open={reviewAus !== null} onOpenChange={v => !v && setReviewAus(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAus?.estado === 'PENDIENTE' ? 'Revisar solicitud de ausencia' : 'Detalle de solicitud'}
            </DialogTitle>
          </DialogHeader>
          {reviewAus && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-muted-foreground text-xs">Empleado</p><p className="font-medium">{reviewAus.employee.apellido}, {reviewAus.employee.nombre}</p></div>
                <div><p className="text-muted-foreground text-xs">Tipo</p><p className="font-medium">{reviewAus.tipoAusencia.nombre}</p></div>
                <div><p className="text-muted-foreground text-xs">Desde</p><p>{fmt(reviewAus.fechaInicio)}</p></div>
                <div><p className="text-muted-foreground text-xs">Hasta</p><p>{fmt(reviewAus.fechaFin)}</p></div>
                <div><p className="text-muted-foreground text-xs">Días hábiles</p><p>{reviewAus.dias}</p></div>
                <div><p className="text-muted-foreground text-xs">Solicitado</p><p>{fmt(reviewAus.createdAt)}</p></div>
              </div>
              {reviewAus.tipoAusencia.afectaSaldo && saldoReview && (() => {
                const restantes = saldoReview.diasTotales - saldoReview.diasUsados
                const despues = restantes - reviewAus.dias
                if (despues >= 0) {
                  return <p className="text-xs text-muted-foreground">Saldo: {restantes} disponibles · quedarían {despues} tras aprobar</p>
                }
                return (
                  <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                    ⚠ Al aprobar, el saldo quedaría en <strong>{despues}</strong> (solicita {reviewAus.dias} y le quedan {restantes}).
                  </div>
                )
              })()}
              {reviewAus.motivo && (
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Motivo</p>
                  <p>{reviewAus.motivo}</p>
                </div>
              )}
              {reviewAus.archivoUrl && (
                <button
                  onClick={() => setPreview({ url: reviewAus.archivoUrl!, filename: reviewAus.archivoUrl!.split('/').pop() ?? undefined })}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <Paperclip size={13} /> Ver adjunto
                </button>
              )}
              {reviewAus.estado === 'PENDIENTE' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Comentario (opcional)</label>
                  <Input className="mt-1" value={comentarioAus} onChange={e => setComentarioAus(e.target.value)} placeholder="Ej: aprobado para la semana del 14/7" />
                </div>
              )}
              {reviewAus.estado !== 'PENDIENTE' && reviewAus.comentarioAdmin && (
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Comentario admin</p>
                  <p>{reviewAus.comentarioAdmin}</p>
                </div>
              )}
            </div>
          )}
          {reviewAus?.estado === 'PENDIENTE' && (
            reviewAus.canApprove ? (
              <DialogFooter className="gap-2">
                <Button variant="destructive" size="sm" onClick={() => resolverAus('RECHAZADA')}>
                  <XCircle size={14} className="mr-1" /> Rechazar
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" size="sm" onClick={() => resolverAus('APROBADA')}>
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

      <ArchivoPreviewDialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        url={preview?.url ?? null}
        filename={preview?.filename ?? null}
      />

      {/* Bulk review dialog */}
      <Dialog open={bulkReview !== null} onOpenChange={v => { if (!v && !bulkProcessing) setBulkReview(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bulkReview === 'APROBADO'
                ? `Aprobar ${selectedResolvables.length} solicitud${selectedResolvables.length === 1 ? '' : 'es'}`
                : `Rechazar ${selectedResolvables.length} solicitud${selectedResolvables.length === 1 ? '' : 'es'}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Vas a resolver {selectedResolvables.length} solicitud{selectedResolvables.length === 1 ? '' : 'es'} a la vez.
              Podés agregar un comentario opcional (será visible al empleado).
            </p>
            <Textarea
              placeholder="Comentario opcional…"
              value={bulkComentario}
              onChange={e => setBulkComentario(e.target.value)}
              rows={3}
              disabled={bulkProcessing}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkReview(null)} disabled={bulkProcessing}>Cancelar</Button>
            <Button
              className={bulkReview === 'APROBADO' ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
              onClick={handleBulkReview}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? 'Procesando…' : bulkReview === 'APROBADO' ? 'Aprobar' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RowDoc({ s, selectable, selected, onToggleSelect, onReview, onPreview }: {
  s: SolicitudDoc
  selectable: boolean
  selected: boolean
  onToggleSelect: () => void
  onReview: (estado: 'APROBADO' | 'RECHAZADO') => void
  onPreview?: (nombreArchivo: string) => void
}) {
  const meta = (() => { try { return JSON.parse(s.metadata ?? '{}') as Record<string, string> } catch { return {} } })()
  const entries = Object.entries(meta).filter(([, v]) => v)
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-card">
      <div className="w-4 mt-1 shrink-0">
        {selectable && (
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Seleccionar solicitud" />
        )}
      </div>
      <FileText size={16} className="text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{s.employee.apellido}, {s.employee.nombre}</span>
          <span className="text-xs text-muted-foreground">· {s.employee.legajo}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Documento</span>
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.tipo.nombre}</span>
        </div>
        {s.nombreArchivo && (
          <button
            onClick={() => onPreview?.(s.nombreArchivo!)}
            className="text-xs text-blue-600 hover:underline text-left"
          >
            {s.nombreArchivo.replace(/^\d+-/, '')}
          </button>
        )}
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {entries.map(([k, v]) => {
              const campo = s.tipo.campos?.find(c => c.nombre === k)
              return (
                <span key={k} className="text-xs text-muted-foreground">
                  {campo?.label ?? k}: <span className="text-foreground">{v}</span>
                </span>
              )
            })}
          </div>
        )}
        {s.descripcion && <p className="text-xs text-muted-foreground mt-1">{s.descripcion}</p>}
        {s.comentario && (
          <p className={cn('text-xs italic mt-1 border-l-2 pl-2', s.comentarioVisible ? 'border-green-400 text-muted-foreground' : 'border-border text-muted-foreground/60')}>
            {s.comentario}
            {!s.comentarioVisible && <span className="ml-1 not-italic text-muted-foreground/50">(no visible al empleado)</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <StatusBadge estado={s.estado} />
          <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.createdAt).toLocaleDateString('es-AR')}</p>
        </div>
        {s.estado === 'PENDIENTE' && (
          s.canApprove ? (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/30" title="Aprobar" onClick={() => onReview('APROBADO')}>
                <Check size={14} />
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30" title="Rechazar" onClick={() => onReview('RECHAZADO')}>
                <X size={14} />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Fuera de tu jerarquía</span>
          )
        )}
      </div>
    </div>
  )
}

function RowAus({ s, selectable, selected, onToggleSelect, onReview }: {
  s: SolicitudAus
  selectable: boolean
  selected: boolean
  onToggleSelect: () => void
  onReview: () => void
}) {
  const estadoInfo = ESTADO_AUS[s.estado]
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-card">
      <div className="w-4 mt-1 shrink-0">
        {selectable && (
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Seleccionar solicitud" />
        )}
      </div>
      <CalendarOff size={16} className="text-blue-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{s.employee.apellido}, {s.employee.nombre}</span>
          <span className="text-xs text-muted-foreground">· {s.employee.legajo}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Ausencia</span>
          <span className="inline-flex items-center gap-1.5 text-xs bg-muted px-1.5 py-0.5 rounded">
            <span className="h-2 w-2 rounded-full" style={{ background: s.tipoAusencia.color }} />
            {s.tipoAusencia.nombre}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {fmt(s.fechaInicio)} – {fmt(s.fechaFin)} · {s.dias} día{s.dias !== 1 ? 's' : ''}
        </p>
        {s.motivo && <p className="text-xs text-muted-foreground mt-1">{s.motivo}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          {estadoInfo && (
            <Badge variant="outline" className={cn('gap-1', estadoInfo.className)}>
              {estadoInfo.icon} {estadoInfo.label}
            </Badge>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.createdAt).toLocaleDateString('es-AR')}</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onReview}>
          {s.estado === 'PENDIENTE' ? 'Revisar' : 'Ver'}
        </Button>
      </div>
    </div>
  )
}
