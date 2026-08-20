'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Layers, ChevronRight, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
}

interface Lote {
  id: number
  nombre: string
  descripcion: string | null
  periodo: string
  createdAt: string
  tipoDocumento: { id: number; nombre: string } | null
  stats: LoteStats
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
  const [sortBy, setSortBy] = useState<'createdAt' | 'nombre' | 'periodo'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => { setPage(1) }, [qDebounced, anio, sortBy, sortOrder])

  const fetchLotes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), sortBy, sortOrder })
      if (qDebounced) params.set('q', qDebounced)
      if (anio) params.set('periodo', anio)
      const r = await fetch(`/api/lotes?${params}`)
      if (r.ok) {
        const d = await r.json()
        setLotes(d.items ?? [])
        setTotal(d.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, qDebounced, anio, sortBy, sortOrder])

  useEffect(() => { fetchLotes() }, [fetchLotes])

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

  const anioActual = new Date().getFullYear()
  const aniosDisponibles = Array.from({ length: 6 }, (_, i) => String(anioActual - i))

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
        <Select value={anio || 'todos'} onValueChange={v => setAnio(!v || v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los años</SelectItem>
            {aniosDisponibles.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={`${sortBy}_${sortOrder}`}
          onValueChange={v => {
            const [by, order] = (v ?? 'createdAt_desc').split('_')
            setSortBy(by as 'createdAt' | 'nombre' | 'periodo')
            setSortOrder(order as 'asc' | 'desc')
          }}
        >
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt_desc">Más recientes primero</SelectItem>
            <SelectItem value="createdAt_asc">Más antiguos primero</SelectItem>
            <SelectItem value="nombre_asc">Nombre (A–Z)</SelectItem>
            <SelectItem value="nombre_desc">Nombre (Z–A)</SelectItem>
            <SelectItem value="periodo_desc">Período (recientes)</SelectItem>
            <SelectItem value="periodo_asc">Período (antiguos)</SelectItem>
          </SelectContent>
        </Select>
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
              const pct = lote.stats.total > 0
                ? Math.round(lote.stats.firmados / lote.stats.total * 100)
                : 0
              const errTotal = lote.stats.errores + lote.stats.rechazados
              const isSelected = selected.has(lote.id)
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
                    className={`flex-1 min-w-0 bg-card border rounded-xl px-5 py-4 cursor-pointer hover:border-green-500/60 hover:shadow-sm transition-all group ${isSelected ? 'border-green-500' : 'border-border'}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-foreground">{lote.nombre}</p>
                        <span className="text-xs text-muted-foreground">{formatPeriodo(lote.periodo)}</span>
                        {lote.tipoDocumento && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{lote.tipoDocumento.nombre}</span>
                        )}
                      </div>
                      {lote.descripcion && (
                        <p className="text-xs text-muted-foreground mb-2 truncate">{lote.descripcion}</p>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-xs">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {lote.stats.firmados}/{lote.stats.total} firmados
                        </span>
                        {lote.stats.enFirma > 0 && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">
                            {lote.stats.enFirma} en firma
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
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {new Date(lote.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
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
