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
import { Calendar, CalendarOff, Check, CheckCircle2, Clock, Paperclip, Search, X, XCircle } from 'lucide-react'

interface SolicitudAus {
  id: number; estado: string; dias: number; motivo?: string; comentarioAdmin?: string; archivoUrl?: string
  fechaInicio: string; fechaFin: string; createdAt: string
  canApprove: boolean
  employee: { id: number; nombre: string; apellido: string; legajo: string }
  tipoAusencia: { id: number; nombre: string; color: string; afectaSaldo: boolean }
}

const ESTADO_FILTROS = [
  { value: '', label: 'Todas' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'APROBADA', label: 'Aprobadas' },
  { value: 'RECHAZADA', label: 'Rechazadas' },
]

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
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [review, setReview] = useState<SolicitudAus | null>(null)
  const [comentario, setComentario] = useState('')
  const [saldoReview, setSaldoReview] = useState<{ diasTotales: number; diasUsados: number } | null>(null)
  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkReview, setBulkReview] = useState<'APROBADA' | 'RECHAZADA' | null>(null)
  const [bulkComentario, setBulkComentario] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)

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

  const filtered = items.filter(s => {
    if (estadoFiltro && s.estado !== estadoFiltro) return false
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
      <div className="flex gap-1 border-b">
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
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {items.length === 0 ? 'No hay solicitudes de ausencia.' : 'Sin coincidencias para los filtros aplicados.'}
        </p>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {filtered.map(s => {
            const selectable = s.estado === 'PENDIENTE' && s.canApprove
            const isSelected = selected.has(s.id)
            const meta = ESTADO_META[s.estado]
            return (
              <div key={s.id} className="flex items-start gap-3 px-4 py-3 bg-card">
                <div className="w-4 mt-1 shrink-0">
                  {selectable && (
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(s.id)} aria-label="Seleccionar solicitud" />
                  )}
                </div>
                <CalendarOff size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{s.employee.apellido}, {s.employee.nombre}</span>
                    <span className="text-xs text-muted-foreground">· {s.employee.legajo}</span>
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
                    {meta && (
                      <Badge variant="outline" className={cn('gap-1', meta.className)}>
                        {meta.icon} {meta.label}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.createdAt).toLocaleDateString('es-AR')}</p>
                  </div>
                  {s.estado === 'APROBADA' && (
                    <Link
                      href={`/admin/calendario?range=${s.fechaInicio.slice(0, 10)}:${s.fechaFin.slice(0, 10)}`}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Ver en el calendario"
                    >
                      <Calendar size={14} />
                    </Link>
                  )}
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setReview(s); setComentario(s.comentarioAdmin ?? '') }}>
                    {s.estado === 'PENDIENTE' ? 'Revisar' : 'Ver'}
                  </Button>
                </div>
              </div>
            )
          })}
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
                  onClick={() => setPreview({ url: review.archivoUrl!, filename: review.archivoUrl!.split('/').pop() ?? undefined })}
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
