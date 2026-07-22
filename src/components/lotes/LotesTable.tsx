'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Layers, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
        <h1 className="font-semibold text-foreground">Lotes de Recibos</h1>
        <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => setDialogOpen(true)}>
          <Plus size={16} className="mr-1.5" />Nuevo Lote
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-6">
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
            {lotes.map(lote => {
              const pct = lote.stats.total > 0
                ? Math.round(lote.stats.firmados / lote.stats.total * 100)
                : 0
              const errTotal = lote.stats.errores + lote.stats.rechazados
              return (
                <div
                  key={lote.id}
                  onClick={() => router.push(`/admin/lotes/${lote.id}`)}
                  className="bg-card border border-border rounded-xl px-5 py-4 cursor-pointer hover:border-green-500/60 hover:shadow-sm transition-all group"
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
    </div>
  )
}
