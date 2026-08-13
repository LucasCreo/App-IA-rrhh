'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Search, Trash2, Send, ChevronRight, Tag } from 'lucide-react'
import { DocumentoCargarDialog } from './DocumentoCargarDialog'

interface TipoDocumento {
  id: number
  nombre: string
}

interface Grupo {
  id: number
  nombreArchivo: string
  periodo: string | null
  createdAt: string
  tipoDocumento: { id: number; nombre: string; accion: string } | null
  cargadoPor: { email: string }
  stats: {
    total: number
    firmados: number
    enFirma: number
    borradores: number
    rechazados: number
    conformes: number
    noConformes: number
  }
}

export function DocumentosGruposTable() {
  const router = useRouter()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [tipos, setTipos] = useState<TipoDocumento[]>([])
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (busqueda) params.set('q', busqueda)
    if (tipoFiltro !== 'todos') params.set('tipoDocumentoId', tipoFiltro)
    params.set('page', String(page))
    params.set('limit', String(pageSize))
    const r = await fetch(`/api/documentos-grupos?${params}`)
    if (r.ok) {
      const d = await r.json()
      setGrupos(d.grupos ?? [])
      setTotal(d.total ?? 0)
    }
    setLoading(false)
  }, [busqueda, tipoFiltro, page, pageSize])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/configuracion/tipos-documento')
      .then(r => r.ok ? r.json() : [])
      .then((data: TipoDocumento[]) => setTipos(Array.isArray(data) ? data : []))
      .catch(() => setTipos([]))
  }, [])

  async function eliminar(id: number) {
    const r = await fetch(`/api/documentos-grupos/${id}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Documento eliminado'); load() }
    else toast.error('No se pudo eliminar')
    setDeleteId(null)
  }

  async function enviarFirma(id: number) {
    const r = await fetch(`/api/documentos-grupos/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (r.ok) {
      const d = await r.json()
      toast.success(`${d.sent} asignación${d.sent !== 1 ? 'es' : ''} enviada${d.sent !== 1 ? 's' : ''} a firma`)
      load()
    } else toast.error('No se pudo enviar')
  }

  const allSelected = grupos.length > 0 && grupos.every(g => selected.has(g.id))
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
    else setSelected(new Set(grupos.map(g => g.id)))
  }
  async function handleBulkDelete() {
    if (selected.size === 0) return
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/documentos-grupos/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      const data = await res.json().catch(() => ({}))
      const ok: number = data?.deleted ?? 0
      const errors: Array<{ id: number; error: string }> = data?.errors ?? []
      if (ok > 0) toast.success(ok === 1 ? '1 documento eliminado' : `${ok} documentos eliminados`)
      if (errors.length > 0) {
        const primero = errors[0]?.error ?? 'Error desconocido'
        toast.error(errors.length === 1
          ? `No se pudo eliminar 1 documento: ${primero}`
          : `${errors.length} documentos no se pudieron eliminar. Primer error: ${primero}`,
          { duration: 8000 })
      }
      if (!res.ok && ok === 0 && errors.length === 0) {
        toast.error(data?.error ?? `No se pudieron eliminar los ${selected.size} documentos`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de red al eliminar')
    } finally {
      setBulkDeleting(false)
      setBulkDeleteOpen(false)
      setSelected(new Set())
      load()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input className="pl-9" placeholder="Buscar por nombre de archivo…" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1) }} />
        </div>
        <Select value={tipoFiltro} onValueChange={v => { setTipoFiltro(v ?? 'todos'); setPage(1) }}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Tipo de documento" />
          </SelectTrigger>
          <SelectContent side="bottom" alignItemWithTrigger={false}>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {tipos
              .filter(t => t.nombre.toLowerCase() !== 'recibo de sueldo')
              .map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 dark:border-red-900 dark:hover:bg-red-950/30 disabled:opacity-50"
          onClick={() => setBulkDeleteOpen(true)}
          disabled={selected.size === 0}
          title={selected.size === 0 ? 'Seleccioná uno o más documentos para eliminar' : undefined}
        >
          <Trash2 size={14} className="mr-1" />
          {selected.size > 0 ? `Eliminar ${selected.size}` : 'Eliminar'}
        </Button>
        <Button className="bg-green-700 hover:bg-green-800" onClick={() => setUploadOpen(true)}>
          <Plus size={16} className="mr-1" /> Cargar Documento
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <FileText size={32} strokeWidth={1.2} />
          <p className="text-sm">
            {busqueda || tipoFiltro !== 'todos' ? 'Sin resultados para los filtros aplicados' : 'No hay documentos cargados'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
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
          {grupos.map(g => {
            const pct = g.stats.total > 0 ? Math.round(g.stats.firmados / g.stats.total * 100) : 0
            const errTotal = g.stats.rechazados
            const isSelected = selected.has(g.id)
            return (
              <div key={g.id} className="flex items-center gap-2">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleOne(g.id)}
                  aria-label={`Seleccionar ${g.nombreArchivo}`}
                  className="shrink-0"
                />
                <div
                  onClick={() => router.push(`/admin/documentos/${g.id}`)}
                  className={`flex-1 min-w-0 rounded-lg border bg-card px-3 py-2 hover:border-green-500/60 hover:shadow-sm transition-all cursor-pointer ${isSelected ? 'border-green-500' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText size={13} className="text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium text-foreground truncate">{g.nombreArchivo}</p>
                        {g.periodo && (
                          <span className="text-xs text-muted-foreground shrink-0">· {g.periodo}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[200px]">
                          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {g.stats.firmados}/{g.stats.total}
                        </span>
                        {g.stats.enFirma > 0 && (
                          <span className="text-[11px] text-blue-600 dark:text-blue-400 shrink-0">· {g.stats.enFirma} en firma</span>
                        )}
                        {g.stats.borradores > 0 && (
                          <span className="text-[11px] text-muted-foreground shrink-0">· {g.stats.borradores} borrador{g.stats.borradores !== 1 ? 'es' : ''}</span>
                        )}
                        {errTotal > 0 && (
                          <span className="text-[11px] text-red-600 dark:text-red-400 shrink-0">· {errTotal} rechazado{errTotal !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <span
                        className="inline-flex items-center gap-1 text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
                        title="Tipo de documento"
                      >
                        <Tag size={10} />
                        {g.tipoDocumento?.nombre ?? 'Sin tipo'}
                      </span>
                      {g.stats.borradores > 0 && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-900 dark:hover:bg-blue-950/30"
                          onClick={() => enviarFirma(g.id)}
                          title="Enviar a firma los borradores"
                        >
                          <Send size={12} className="mr-1" /> {g.stats.borradores}
                        </Button>
                      )}
                      <a href={`/api/documentos-grupos/${g.id}/archivo`} target="_blank" title="Ver archivo">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><FileText size={13} /></Button>
                      </a>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={() => setDeleteId(g.id)} title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </Button>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <Pagination
            page={page} pageSize={pageSize} total={total}
            itemLabel="documentos"
            onPageChange={setPage} onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {uploadOpen && (
        <DocumentoCargarDialog
          open
          onClose={() => setUploadOpen(false)}
          onSaved={() => { setUploadOpen(false); load() }}
        />
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina el archivo y todas las asignaciones. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && eliminar(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={open => { if (!open && !bulkDeleting) setBulkDeleteOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selected.size} documento{selected.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán los documentos seleccionados junto con todas sus asignaciones. Esta acción no se puede deshacer.
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
