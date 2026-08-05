'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Check, X, FileText, Search, Paperclip } from 'lucide-react'
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

const ESTADO_FILTROS = [
  { value: '', label: 'Todas' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'APROBADO', label: 'Aprobadas' },
  { value: 'RECHAZADO', label: 'Rechazadas' },
]

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

export function SolicitudesUnificadas() {
  const router = useRouter()
  const [docs, setDocs] = useState<SolicitudDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')

  const [reviewDoc, setReviewDoc] = useState<{ solicitud: SolicitudDoc; estado: 'APROBADO' | 'RECHAZADO' } | null>(null)
  const [viewDoc, setViewDoc] = useState<SolicitudDoc | null>(null)
  const [comentarioDoc, setComentarioDoc] = useState('')
  const [visibleDoc, setVisibleDoc] = useState(false)

  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkReview, setBulkReview] = useState<'APROBADO' | 'RECHAZADO' | null>(null)
  const [bulkComentario, setBulkComentario] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/solicitudes')
      .then(r => r.json())
      .then(d => setDocs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
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

  const filtered = docs.filter(d => {
    if (estadoFiltro && d.estado !== estadoFiltro) return false
    if (qDebounced) {
      const nombre = `${d.employee.apellido} ${d.employee.nombre}`.toLowerCase()
      if (!nombre.includes(qDebounced) && !d.employee.legajo.toLowerCase().includes(qDebounced)) return false
    }
    return true
  }).sort((a, b) => {
    const aP = a.estado === 'PENDIENTE' ? 0 : 1
    const bP = b.estado === 'PENDIENTE' ? 0 : 1
    if (aP !== bP) return aP - bP
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const resolvables = filtered.filter(d => d.estado === 'PENDIENTE' && d.canApprove)
  const selectedResolvables = resolvables.filter(d => selected.has(d.id))
  const allResolvablesSelected = resolvables.length > 0 && resolvables.every(d => selected.has(d.id))
  const someSelected = selectedResolvables.length > 0 && !allResolvablesSelected

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAllResolvables() {
    if (allResolvablesSelected) setSelected(new Set())
    else setSelected(new Set(resolvables.map(d => d.id)))
  }

  async function handleBulkReview() {
    if (!bulkReview || selectedResolvables.length === 0) return
    setBulkProcessing(true)
    const coment = bulkComentario.trim()
    let ok = 0, fail = 0
    for (const item of selectedResolvables) {
      const res = await fetch(`/api/solicitudes/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: bulkReview, comentario: coment, comentarioVisible: !!coment }),
      })
      if (res.ok) ok++; else fail++
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
                ? 'border-foreground text-foreground'
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
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {docs.length}
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
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 dark:border-red-900 dark:hover:bg-red-950/30 h-8"
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
          {docs.length === 0 ? 'No hay solicitudes.' : 'Sin coincidencias para los filtros aplicados.'}
        </p>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {filtered.map(s => {
            const selectable = s.estado === 'PENDIENTE' && s.canApprove
            const isSelected = selected.has(s.id)
            return (
              <RowDoc
                key={s.id}
                s={s}
                selectable={selectable}
                selected={isSelected}
                onToggleSelect={() => toggleOne(s.id)}
                onReview={(estado) => { setReviewDoc({ solicitud: s, estado }); setComentarioDoc(''); setVisibleDoc(false) }}
                onView={() => setViewDoc(s)}
                onPreview={(nombreArchivo) => setPreview({ url: `/api/solicitudes/archivo?file=${nombreArchivo}`, filename: nombreArchivo })}
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

      <ArchivoPreviewDialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        url={preview?.url ?? null}
        filename={preview?.filename ?? null}
      />

      <Dialog open={viewDoc !== null} onOpenChange={v => !v && setViewDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de solicitud</DialogTitle>
          </DialogHeader>
          {viewDoc && (() => {
            const meta = (() => { try { return JSON.parse(viewDoc.metadata ?? '{}') as Record<string, string> } catch { return {} } })()
            const entries = Object.entries(meta).filter(([, v]) => v)
            return (
              <div className="space-y-3 text-sm min-w-0">
                <div className="grid grid-cols-2 gap-2 min-w-0">
                  <div className="min-w-0"><p className="text-muted-foreground text-xs">Empleado</p><p className="font-medium truncate">{viewDoc.employee.apellido}, {viewDoc.employee.nombre}</p></div>
                  <div className="min-w-0"><p className="text-muted-foreground text-xs">Legajo</p><p className="truncate">{viewDoc.employee.legajo}</p></div>
                  <div className="min-w-0"><p className="text-muted-foreground text-xs">Tipo</p><p className="font-medium truncate">{viewDoc.tipo.nombre}</p></div>
                  <div className="min-w-0"><p className="text-muted-foreground text-xs">Solicitado</p><p>{fmt(viewDoc.createdAt)}</p></div>
                </div>
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <StatusBadge estado={viewDoc.estado} />
                  {viewDoc.nombreArchivo && (
                    <button
                      onClick={() => setPreview({ url: `/api/solicitudes/archivo?file=${viewDoc.nombreArchivo}`, filename: viewDoc.nombreArchivo })}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline min-w-0 max-w-full"
                    >
                      <Paperclip size={13} className="shrink-0" />
                      <span className="truncate">{viewDoc.nombreArchivo.replace(/^\d+-/, '')}</span>
                    </button>
                  )}
                </div>
                {entries.length > 0 && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
                    {entries.map(([k, v]) => {
                      const campo = viewDoc.tipo.campos?.find(c => c.nombre === k)
                      return (
                        <div key={k} className="flex justify-between gap-4 text-xs min-w-0">
                          <span className="text-muted-foreground shrink-0">{campo?.label ?? k}</span>
                          <span className="text-foreground text-right break-words min-w-0">{v}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {viewDoc.descripcion && (
                  <div className="rounded-md bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Descripción</p>
                    <p className="break-words">{viewDoc.descripcion}</p>
                  </div>
                )}
                {viewDoc.comentario && (
                  <div className="rounded-md bg-muted/50 px-3 py-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Comentario admin</p>
                    <p className="italic break-words">{viewDoc.comentario}</p>
                    {!viewDoc.comentarioVisible && (
                      <p className="text-xs text-muted-foreground/70 mt-1">(no visible al empleado)</p>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

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

function RowDoc({ s, selectable, selected, onToggleSelect, onReview, onView, onPreview }: {
  s: SolicitudDoc
  selectable: boolean
  selected: boolean
  onToggleSelect: () => void
  onReview: (estado: 'APROBADO' | 'RECHAZADO') => void
  onView: () => void
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
        {s.estado === 'PENDIENTE' ? (
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
        ) : (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onView}>
            Ver
          </Button>
        )}
      </div>
    </div>
  )
}

