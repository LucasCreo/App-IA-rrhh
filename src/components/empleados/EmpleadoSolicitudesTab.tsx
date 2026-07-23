'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Check, X, FileText, CalendarOff, CheckCircle2, XCircle, Clock, Paperclip } from 'lucide-react'
import { handleApiError } from '@/lib/apiErrors'
import { cn } from '@/lib/utils'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'

interface CampoSolicitud { nombre: string; label: string }
interface SolicitudDoc {
  id: number; nombreArchivo?: string; estado: string
  descripcion?: string; comentario?: string; comentarioVisible: boolean
  metadata?: string; createdAt: string
  canApprove: boolean
  tipo: { id: number; nombre: string; campos?: CampoSolicitud[] }
}
interface SolicitudAus {
  id: number; estado: string; dias: number; motivo?: string; comentarioAdmin?: string; archivoUrl?: string
  fechaInicio: string; fechaFin: string; createdAt: string
  canApprove: boolean
  tipoAusencia: { id: number; nombre: string; color: string; afectaSaldo: boolean }
}

type ItemDoc = { kind: 'doc'; key: string; fecha: string; pendiente: boolean; estado: string; data: SolicitudDoc }
type ItemAus = { kind: 'aus'; key: string; fecha: string; pendiente: boolean; estado: string; data: SolicitudAus }
type Item = ItemDoc | ItemAus

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'doc', label: 'Documentos' },
  { value: 'aus', label: 'Ausencias' },
  { value: 'pendientes', label: 'Pendientes' },
] as const
type Filtro = typeof FILTROS[number]['value']

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

const ESTADO_AUS: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  PENDIENTE: { icon: <Clock size={11} />, className: 'text-yellow-600 border-yellow-400', label: 'Pendiente' },
  APROBADA: { icon: <CheckCircle2 size={11} />, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Aprobada' },
  RECHAZADA: { icon: <XCircle size={11} />, className: 'text-red-500 border-red-400', label: 'Rechazada' },
}

export function EmpleadoSolicitudesTab({ employeeId }: { employeeId: number }) {
  const router = useRouter()
  const [docs, setDocs] = useState<SolicitudDoc[]>([])
  const [ausencias, setAusencias] = useState<SolicitudAus[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const [reviewDoc, setReviewDoc] = useState<{ solicitud: SolicitudDoc; estado: 'APROBADO' | 'RECHAZADO' } | null>(null)
  const [comentarioDoc, setComentarioDoc] = useState('')
  const [visibleDoc, setVisibleDoc] = useState(false)

  const [reviewAus, setReviewAus] = useState<SolicitudAus | null>(null)
  const [comentarioAus, setComentarioAus] = useState('')

  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/empleados/${employeeId}/solicitudes`)
      .then(r => r.json())
      .then(d => {
        setDocs(Array.isArray(d?.documentos) ? d.documentos : [])
        setAusencias(Array.isArray(d?.ausencias) ? d.ausencias : [])
      })
      .finally(() => setLoading(false))
  }, [employeeId])

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
  }

  const items: Item[] = [
    ...docs.map<ItemDoc>(d => ({ kind: 'doc', key: `d-${d.id}`, fecha: d.createdAt, pendiente: d.estado === 'PENDIENTE', estado: d.estado, data: d })),
    ...ausencias.map<ItemAus>(a => ({ kind: 'aus', key: `a-${a.id}`, fecha: a.createdAt, pendiente: a.estado === 'PENDIENTE', estado: a.estado, data: a })),
  ]

  const filtered = items.filter(i => {
    if (filtro === 'doc') return i.kind === 'doc'
    if (filtro === 'aus') return i.kind === 'aus'
    if (filtro === 'pendientes') return i.pendiente
    return true
  }).sort((a, b) => {
    if (a.pendiente !== b.pendiente) return a.pendiente ? -1 : 1
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  })

  const counts = {
    todos: items.length,
    doc: items.filter(i => i.kind === 'doc').length,
    aus: items.filter(i => i.kind === 'aus').length,
    pendientes: items.filter(i => i.pendiente).length,
  }

  const esAprobacionDoc = reviewDoc?.estado === 'APROBADO'

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
              filtro === f.value
                ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {f.label}
            <span className="opacity-60">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Sin solicitudes</p>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {filtered.map(item => item.kind === 'doc' ? (
            <RowDoc
              key={item.key}
              s={item.data}
              onReview={(estado) => { setReviewDoc({ solicitud: item.data, estado }); setComentarioDoc(''); setVisibleDoc(false) }}
              onPreview={(nombreArchivo) => setPreview({ url: `/api/solicitudes/archivo?file=${nombreArchivo}`, filename: nombreArchivo })}
            />
          ) : (
            <RowAus key={item.key} s={item.data} onReview={() => { setReviewAus(item.data); setComentarioAus(item.data.comentarioAdmin ?? '') }} />
          ))}
        </div>
      )}

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
                <div><p className="text-muted-foreground text-xs">Tipo</p><p className="font-medium">{reviewAus.tipoAusencia.nombre}</p></div>
                <div><p className="text-muted-foreground text-xs">Solicitado</p><p>{fmt(reviewAus.createdAt)}</p></div>
                <div><p className="text-muted-foreground text-xs">Desde</p><p>{fmt(reviewAus.fechaInicio)}</p></div>
                <div><p className="text-muted-foreground text-xs">Hasta</p><p>{fmt(reviewAus.fechaFin)}</p></div>
                <div><p className="text-muted-foreground text-xs">Días hábiles</p><p>{reviewAus.dias}</p></div>
              </div>
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
    </div>
  )
}

function RowDoc({ s, onReview, onPreview }: { s: SolicitudDoc; onReview: (estado: 'APROBADO' | 'RECHAZADO') => void; onPreview?: (nombreArchivo: string) => void }) {
  const meta = (() => { try { return JSON.parse(s.metadata ?? '{}') as Record<string, string> } catch { return {} } })()
  const entries = Object.entries(meta).filter(([, v]) => v)
  return (
    <div className="flex items-start gap-4 px-4 py-3 bg-card">
      <FileText size={16} className="text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
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

function RowAus({ s, onReview }: { s: SolicitudAus; onReview: () => void }) {
  const estadoInfo = ESTADO_AUS[s.estado]
  return (
    <div className="flex items-start gap-4 px-4 py-3 bg-card">
      <CalendarOff size={16} className="text-blue-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
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
