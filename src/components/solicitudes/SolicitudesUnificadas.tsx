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
import { Check, X, Search, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'
import { Pagination } from '@/components/ui/pagination'

interface CampoSolicitud { nombre: string; label: string; tipo?: string }
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  useEffect(() => { setPage(1) }, [estadoFiltro, qDebounced])

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (estadoFiltro) params.set('estado', estadoFiltro)
    if (qDebounced) params.set('q', qDebounced)
    params.set('page', String(page))
    params.set('limit', String(pageSize))
    fetch(`/api/solicitudes?${params}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) { setDocs(d); setTotal(d.length) }
        else { setDocs(d.items ?? []); setTotal(d.total ?? 0) }
      })
      .finally(() => setLoading(false))
  }, [estadoFiltro, qDebounced, page, pageSize])

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

  const filtered = docs

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
            placeholder="Buscar…"
            title="Busca por nombre, legajo, descripción o comentario"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {total} {total === 1 ? 'resultado' : 'resultados'}
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
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="w-10 px-3 py-2.5"></th>
                <th className="text-left px-4 py-2.5 font-medium">Empleado</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Legajo</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Archivo</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Descripción</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Comentario</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const selectable = s.estado === 'PENDIENTE' && s.canApprove
                const isSelected = selected.has(s.id)
                return (
                  <tr key={s.id} className={`border-t hover:bg-muted/40 transition-colors ${isSelected ? 'bg-green-50/50 dark:bg-green-950/10' : ''}`}>
                    <td className="px-3 py-2 w-10">
                      {selectable && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(s.id)}
                          aria-label="Seleccionar solicitud"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">{s.employee.apellido}, {s.employee.nombre}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden sm:table-cell">{s.employee.legajo}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.tipo.nombre}</span>
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell max-w-[200px]">
                      {s.nombreArchivo ? (
                        <button
                          onClick={() => setPreview({ url: `/api/solicitudes/archivo?file=${s.nombreArchivo}`, filename: s.nombreArchivo })}
                          className="text-xs text-blue-600 hover:underline truncate block max-w-full text-left"
                          title={s.nombreArchivo.replace(/^[^|]*\|\|/, '').replace(/^\d+-/, '')}
                        >
                          {s.nombreArchivo.replace(/^[^|]*\|\|/, '').replace(/^\d+-/, '')}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell max-w-[200px]">
                      {s.descripcion ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 break-words" title={s.descripcion}>{s.descripcion}</p>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell max-w-[200px]">
                      {s.comentario ? (
                        <p className={cn('text-xs italic line-clamp-2 break-words', s.comentarioVisible ? 'text-muted-foreground' : 'text-muted-foreground/60')} title={s.comentario}>
                          {s.comentario}
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge estado={s.estado} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {s.estado === 'PENDIENTE' && s.canApprove ? (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30" title="Aprobar" onClick={() => { setReviewDoc({ solicitud: s, estado: 'APROBADO' }); setComentarioDoc(''); setVisibleDoc(false) }}>
                              <Check size={13} />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" title="Rechazar" onClick={() => { setReviewDoc({ solicitud: s, estado: 'RECHAZADO' }); setComentarioDoc(''); setVisibleDoc(false) }}>
                              <X size={13} />
                            </Button>
                          </>
                        ) : s.estado === 'PENDIENTE' ? (
                          <span className="text-xs text-muted-foreground italic px-2">Fuera de tu jerarquía</span>
                        ) : null}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setViewDoc(s)}>
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

      {!loading && total > 0 && (
        <Pagination
          page={page} pageSize={pageSize} total={total}
          itemLabel="solicitudes"
          onPageChange={setPage} onPageSizeChange={setPageSize}
        />
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
                      <span className="truncate">{viewDoc.nombreArchivo.replace(/^[^|]*\|\|/, '').replace(/^\d+-/, '')}</span>
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
                          {campo?.tipo === 'archivo' ? (
                            <a
                              href={`/api/solicitudes/archivo?file=${v}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1 min-w-0 truncate"
                            >
                              {v.replace(/^[^|]*\|\|/, '').replace(/^\d+-/, '')}
                            </a>
                          ) : campo?.tipo === 'booleano' ? (
                            <span className="text-foreground text-right">{v === 'true' ? 'Sí' : 'No'}</span>
                          ) : (
                            <span className="text-foreground text-right break-words min-w-0">{v}</span>
                          )}
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


