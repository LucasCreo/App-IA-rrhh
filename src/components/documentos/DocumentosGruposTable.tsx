'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Search, Trash2, Send, ChevronRight } from 'lucide-react'
import { DocumentoCargarDialog } from './DocumentoCargarDialog'

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
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/documentos-grupos${busqueda ? `?q=${encodeURIComponent(busqueda)}` : ''}`)
    if (r.ok) {
      const d = await r.json()
      setGrupos(d.grupos ?? [])
    }
    setLoading(false)
  }, [busqueda])

  useEffect(() => { load() }, [load])

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input className="pl-9" placeholder="Buscar por nombre de archivo…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Button className="bg-green-700 hover:bg-green-800" onClick={() => setUploadOpen(true)}>
          <Plus size={16} className="mr-1" /> Cargar Documento
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <FileText size={32} strokeWidth={1.2} />
          <p className="text-sm">No hay documentos cargados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map(g => {
            const pct = g.stats.total > 0 ? Math.round(g.stats.firmados / g.stats.total * 100) : 0
            const errTotal = g.stats.rechazados
            return (
              <div
                key={g.id}
                onClick={() => router.push(`/admin/documentos/${g.id}`)}
                className="rounded-xl border bg-card px-5 py-4 hover:border-green-500/60 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <FileText size={14} className="text-muted-foreground shrink-0" />
                      <p className="font-semibold text-foreground truncate">{g.nombreArchivo}</p>
                      {g.tipoDocumento && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">{g.tipoDocumento.nombre}</span>
                      )}
                      {g.periodo && (
                        <span className="text-xs text-muted-foreground shrink-0">· {g.periodo}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-xs">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {g.stats.firmados}/{g.stats.total} firmados
                      </span>
                      {g.stats.enFirma > 0 && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">{g.stats.enFirma} en firma</span>
                      )}
                      {g.stats.borradores > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">{g.stats.borradores} borrador{g.stats.borradores !== 1 ? 'es' : ''}</span>
                      )}
                      {errTotal > 0 && (
                        <span className="text-xs text-red-600 dark:text-red-400 shrink-0">{errTotal} rechazado{errTotal !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {g.stats.borradores > 0 && (
                      <Button
                        size="sm" variant="outline"
                        className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-900 dark:hover:bg-blue-950/30"
                        onClick={() => enviarFirma(g.id)}
                        title="Enviar a firma los borradores"
                      >
                        <Send size={13} className="mr-1" /> Enviar {g.stats.borradores}
                      </Button>
                    )}
                    <a href={`/api/documentos-grupos/${g.id}/archivo`} target="_blank" title="Ver archivo">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><FileText size={14} /></Button>
                    </a>
                    <Button
                      size="sm" variant="ghost"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      onClick={() => setDeleteId(g.id)} title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </Button>
                    <ChevronRight size={16} className="text-muted-foreground ml-1" />
                  </div>
                </div>
              </div>
            )
          })}
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
    </div>
  )
}
