'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Layers, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
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

  async function fetchLotes() {
    setLoading(true)
    try {
      const r = await fetch('/api/lotes')
      if (r.ok) setLotes(await r.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLotes() }, [])

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
    const results = await Promise.all(
      Array.from(selected).map(id =>
        fetch(`/api/lotes/${id}`, { method: 'DELETE' }).then(r => r.ok)
      )
    )
    const ok = results.filter(Boolean).length
    const fail = results.length - ok
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    setSelected(new Set())
    if (ok > 0) toast.success(`${ok} lote(s) eliminado(s)`)
    if (fail > 0) toast.error(`${fail} no se pudo(ieron) eliminar`)
    fetchLotes()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {selected.size > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 dark:border-red-900 dark:hover:bg-red-950/30"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 size={14} className="mr-1" /> Eliminar {selected.size}
          </Button>
        )}
        <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => setDialogOpen(true)}>
          <Plus size={16} className="mr-1.5" />Nuevo Lote
        </Button>
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
