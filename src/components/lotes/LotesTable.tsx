'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Layers, ChevronRight, Trash2, Search, SlidersHorizontal, X, Lock, RefreshCw, AlertTriangle, CheckCircle2, Cloud } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const MESES_LIST = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Pagination } from '@/components/ui/pagination'
import { CrearLoteDialog } from './CrearLoteDialog'

interface LoteStats {
  total: number
  firmados: number
  enFirma: number
  borradores: number
  errores: number
  rechazados: number
  sinRecibo: number
  pendientes: number
}

interface Lote {
  id: number
  nombre: string
  descripcion: string | null
  periodo: string
  createdAt: string
  tipoDocumento: { id: number; nombre: string } | null
  estado: string
  progreso: number
  origen: string
  mes: number | null
  anio: number | null
  stats: LoteStats
}

const ESTADO_META: Record<string, { label: string; className: string; icon?: React.ComponentType<{ size?: number; className?: string }> }> = {
  ABIERTO: { label: 'Abierto', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  PROCESANDO: { label: 'Procesando', className: 'bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:text-amber-400', icon: RefreshCw },
  LISTO: { label: 'Listo', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  CON_ERRORES: { label: 'Con errores', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
  CERRADO: { label: 'Cerrado', className: 'bg-muted text-muted-foreground', icon: Lock },
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatPeriodo(p: string) {
  const [year, month] = p.split('-')
  return `${MESES[parseInt(month) - 1]} ${year}`
}

export function LotesTable() {
  const router = useRouter()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [anio, setAnio] = useState('')
  const [mes, setMes] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => { setPage(1) }, [qDebounced, anio, mes])

  const activeFiltersCount = (anio ? 1 : 0) + (mes ? 1 : 0)
  function clearAllFilters() { setAnio(''); setMes('') }

  const fetchLotes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), sortBy: 'createdAt', sortOrder: 'desc' })
      if (qDebounced) params.set('q', qDebounced)
      const periodo = anio && mes ? `${anio}-${mes}` : (anio || mes ? `${anio}${mes ? '-' + mes : ''}` : '')
      if (periodo) params.set('periodo', periodo)
      const r = await fetch(`/api/lotes?${params}`)
      if (r.ok) {
        const d = await r.json()
        setLotes(d.items ?? [])
        setTotal(d.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, qDebounced, anio, mes])

  useEffect(() => { fetchLotes() }, [fetchLotes])

  // Suscripción SSE: aplica cambios de estado/progreso en vivo sobre los lotes
  // ya cargados. No agrega ni quita filas (eso lo maneja el fetch normal),
  // solo mergea deltas para evitar re-renderizar la tabla completa.
  useEffect(() => {
    const es = new EventSource('/api/lotes/eventos')
    es.addEventListener('update', ev => {
      try {
        const { changes } = JSON.parse((ev as MessageEvent).data) as {
          changes: Array<{ id: number; estado: string; progreso: number }>
        }
        if (!changes?.length) return
        setLotes(prev => prev.map(l => {
          const c = changes.find(x => x.id === l.id)
          if (!c) return l
          if (c.estado === '__DELETED__') return l
          return { ...l, estado: c.estado, progreso: c.progreso }
        }))
      } catch { /* ignore */ }
    })
    es.onerror = () => { /* EventSource reintenta solo */ }
    return () => es.close()
  }, [])

  async function cerrarLote(loteId: number) {
    const r = await fetch(`/api/lotes/${loteId}/cerrar`, { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { toast.error(d?.error ?? 'No se pudo cerrar'); return }
    toast.success('Lote cerrado')
    setLotes(prev => prev.map(l => l.id === loteId ? { ...l, estado: 'CERRADO' } : l))
  }

  const allSelected = lotes.length > 0 && lotes.every(l => selected.has(l.id))
  const someSelected = selected.size > 0 && !allSelected
  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(lotes.map(l => l.id)))
  }
  async function handleBulkDelete() {
    if (selected.size === 0) return
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/lotes/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      const data = await res.json().catch(() => ({}))
      const ok: number = data?.deleted ?? 0
      const errors: Array<{ id: number; error: string }> = data?.errors ?? []
      const total = selected.size
      if (ok > 0) toast.success(ok === 1 ? '1 lote eliminado' : `${ok} lotes eliminados`)
      if (errors.length > 0) {
        const primero = errors[0]?.error ?? 'Error desconocido'
        const msg = errors.length === 1
          ? `No se pudo eliminar 1 lote: ${primero}`
          : `${errors.length} lotes no se pudieron eliminar. Primer error: ${primero}`
        toast.error(msg, { duration: 8000 })
      }
      if (!res.ok && ok === 0 && errors.length === 0) {
        toast.error(data?.error ?? `No se pudieron eliminar los ${total} lotes`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de red al eliminar los lotes')
    } finally {
      setBulkDeleting(false)
      setBulkDeleteOpen(false)
      setSelected(new Set())
      fetchLotes()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-56 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9"
            placeholder="Buscar por nombre o descripción…"
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
        <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 dark:border-red-900 dark:hover:bg-red-950/30 disabled:opacity-50"
          onClick={() => setBulkDeleteOpen(true)}
          disabled={selected.size === 0}
          title={selected.size === 0 ? 'Seleccioná uno o más lotes para eliminar' : undefined}
        >
          <Trash2 size={14} className="mr-1" />
          {selected.size > 0 ? `Eliminar ${selected.size}` : 'Eliminar'}
        </Button>
        <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => setDialogOpen(true)}>
          <Plus size={16} className="mr-1.5" />Nuevo Lote
        </Button>
        </div>
      </div>

      {filtersOpen && (
        <div className="flex flex-wrap gap-3 items-end p-4 bg-muted/30 border border-border rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Año</p>
            <Input
              type="number"
              min={2000}
              max={2100}
              placeholder="Todos"
              value={anio}
              onChange={e => setAnio(e.target.value.slice(0, 4))}
              className="h-9 w-28"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Mes</p>
            <Select value={mes || 'todos'} onValueChange={v => setMes(!v || v === 'todos' ? '' : v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" alignItemWithTrigger={false}>
                <SelectItem value="todos">Todos</SelectItem>
                {MESES_LIST.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : lotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
            <Layers size={32} className="opacity-30" />
            <p className="text-sm">No hay lotes creados</p>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus size={14} className="mr-1" />Crear primer lote
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={toggleAll}
                aria-label="Seleccionar todos"
              />
              <span>
                {selected.size > 0 ? `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}` : 'Seleccionar todos'}
              </span>
            </div>
            {lotes.map(lote => {
              const enProceso = lote.estado === 'PROCESANDO'
              const pctFirma = lote.stats.total > 0
                ? Math.round(lote.stats.firmados / lote.stats.total * 100)
                : 0
              // Mientras se está ingesting/procesando, mostramos el progreso del
              // ciclo (worker); una vez LISTO/CERRADO cambiamos al progreso de firmas.
              const pct = enProceso ? lote.progreso : pctFirma
              const pctLabel = enProceso ? `${lote.progreso}% procesado` : `${lote.stats.firmados}/${lote.stats.total} firmados`
              const errTotal = lote.stats.errores + lote.stats.rechazados
              // Este lote es uno de los que suma al badge del sidebar en Recibos:
              // estado CON_ERRORES o al menos un documento en ERROR.
              const requiereAtencion = lote.estado === 'CON_ERRORES' || lote.stats.errores > 0
              // Cantidad concreta de items que hacen que el lote esté flageado (para el badge)
              const atencionCount = lote.stats.errores + lote.stats.pendientes
              const isSelected = selected.has(lote.id)
              const meta = ESTADO_META[lote.estado] ?? { label: lote.estado, className: 'bg-muted text-muted-foreground' }
              const IconEstado = meta.icon
              const esSftp = lote.origen === 'SFTP'
              const puedeCerrar = esSftp && (lote.estado === 'LISTO' || lote.estado === 'CON_ERRORES' || lote.estado === 'ABIERTO')
              return (
                <div key={lote.id} className="flex items-center gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(lote.id)}
                    aria-label={`Seleccionar ${lote.nombre}`}
                    className="shrink-0"
                  />
                  <div
                    onClick={() => router.push(`/admin/lotes/${lote.id}`)}
                    className={`relative flex-1 min-w-0 bg-card border rounded-xl px-5 py-4 cursor-pointer hover:border-green-500/60 hover:shadow-sm transition-all group ${isSelected ? 'border-green-500' : 'border-border'}`}
                  >
                    {requiereAtencion && (
                      <span
                        className="absolute -top-2 -left-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold px-1.5 shadow ring-2 ring-background"
                        title={`${atencionCount} item(s) requieren revisión`}
                      >
                        {atencionCount > 99 ? '99+' : Math.max(1, atencionCount)}
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-foreground">{lote.nombre}</p>
                        <span className="text-xs text-muted-foreground">{formatPeriodo(lote.periodo)}</span>
                        {lote.descripcion && (
                          <span className="text-xs text-muted-foreground truncate">· {lote.descripcion}</span>
                        )}
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded', meta.className)}>
                          {IconEstado && <IconEstado size={10} className={enProceso ? 'animate-spin' : ''} />}
                          {meta.label}
                        </span>
                        {esSftp && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" title="Ingresado por SFTP">
                            <Cloud size={10} /> SFTP
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Creado {new Date(lote.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-xs">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              enProceso ? 'bg-amber-500' : 'bg-green-500',
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{pctLabel}</span>
                        {lote.stats.enFirma > 0 && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">
                            {lote.stats.enFirma} en firma
                          </span>
                        )}
                        {lote.stats.pendientes > 0 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">
                            {lote.stats.pendientes} pendiente{lote.stats.pendientes !== 1 ? 's' : ''}
                          </span>
                        )}
                        {lote.stats.sinRecibo > 0 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">
                            {lote.stats.sinRecibo} sin recibo
                          </span>
                        )}
                        {errTotal > 0 && (
                          <span className="text-xs text-red-600 dark:text-red-400 shrink-0">
                            {errTotal} error{errTotal !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {puedeCerrar && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            title="Cerrar lote: el próximo archivo SFTP del mismo mes creará un lote nuevo"
                            onClick={e => { e.stopPropagation(); cerrarLote(lote.id) }}
                          >
                            <Lock size={12} className="mr-1" /> Cerrar
                          </Button>
                        )}
                        <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <Pagination
              page={page} pageSize={pageSize} total={total}
              itemLabel="lotes"
              onPageChange={setPage} onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      <CrearLoteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); fetchLotes() }}
      />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={open => { if (!open && !bulkDeleting) setBulkDeleteOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selected.size} lote{selected.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán los lotes seleccionados. Los recibos ya firmados que estén dentro quedarán sin lote asociado. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
