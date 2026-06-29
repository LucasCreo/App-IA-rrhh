'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Criterio { nombre: string; label: string; tipo: 'numerico' | 'texto' }

interface Evaluacion {
  id: number
  completada: boolean
  resultados: Record<string, string>
  comentario?: string
  employee: { id: number; nombre: string; apellido: string; legajo: string }
}

interface Ronda {
  id: number
  nombre: string
  descripcion?: string | null
  estado: string
  createdAt: string
  plantilla: { nombre: string; criterios: Criterio[] }
  evaluaciones: Evaluacion[]
}

export function RondaDetalle({ id }: { id: number }) {
  const router = useRouter()
  const [ronda, setRonda] = useState<Ronda | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogEval, setDialogEval] = useState<Evaluacion | null>(null)
  const [resultados, setResultados] = useState<Record<string, string>>({})
  const [comentario, setComentario] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/evaluaciones/rondas/${id}`).then(r => r.json()).then(setRonda).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  function openDialog(ev: Evaluacion) {
    setDialogEval(ev)
    setResultados({ ...ev.resultados })
    setComentario(ev.comentario ?? '')
  }

  function setResultado(nombre: string, valor: string) {
    setResultados(prev => ({ ...prev, [nombre]: valor }))
  }

  async function handleGuardar() {
    if (!dialogEval) return
    setSaving(true)
    try {
      const res = await fetch(`/api/evaluaciones/${dialogEval.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultados, comentario, completada: true }),
      })
      if (!res.ok) { toast.error('Error al guardar'); return }
      toast.success('Evaluación guardada')
      setDialogEval(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function toggleEstado() {
    if (!ronda) return
    const nuevoEstado = ronda.estado === 'ACTIVA' ? 'CERRADA' : 'ACTIVA'
    await fetch(`/api/evaluaciones/rondas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    load()
    toast.success(nuevoEstado === 'CERRADA' ? 'Ronda cerrada' : 'Ronda reabierta')
  }

  if (loading) return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
    </div>
  )

  if (!ronda) return <p className="text-muted-foreground">Ronda no encontrada.</p>

  const completadas = ronda.evaluaciones.filter(e => e.completada).length
  const criterios = ronda.plantilla.criterios
  const cerrada = ronda.estado === 'CERRADA'

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => router.push('/admin/evaluaciones')}>
          <ChevronLeft size={14} /> Volver
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-base">{ronda.nombre}</h2>
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{ronda.plantilla.nombre}</span>
            <Badge variant={cerrada ? 'secondary' : 'outline'} className={cn('text-xs', !cerrada && 'border-green-600 text-green-700 dark:text-green-400')}>
              {cerrada ? 'Cerrada' : 'Activa'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completadas} / {ronda.evaluaciones.length} completadas · {new Date(ronda.createdAt).toLocaleDateString('es-AR')}
          </p>
        </div>
        <Button
          size="sm"
          variant={cerrada ? 'outline' : 'secondary'}
          onClick={toggleEstado}
        >
          {cerrada ? 'Reabrir ronda' : 'Cerrar ronda'}
        </Button>
      </div>

      {ronda.descripcion && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-1">Descripción (visible para el empleado)</p>
          <p className="text-sm whitespace-pre-wrap">{ronda.descripcion}</p>
        </div>
      )}

      <div className="divide-y rounded-lg border overflow-hidden">
        {ronda.evaluaciones.map(ev => (
          <div key={ev.id} className="flex items-center gap-4 px-4 py-3 bg-card">
            {ev.completada
              ? <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              : <Circle size={16} className="text-muted-foreground shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{ev.employee.apellido}, {ev.employee.nombre}</p>
              <p className="text-xs text-muted-foreground">{ev.employee.legajo}</p>
              {ev.completada && criterios.filter(c => c.tipo === 'numerico').length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {criterios.filter(c => c.tipo === 'numerico').map(c => (
                    <span key={c.nombre} className="text-xs text-muted-foreground">
                      {c.label}: <span className="font-medium text-foreground">{ev.resultados[c.nombre] ?? '—'}/10</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0"
              disabled={cerrada && !ev.completada}
              onClick={() => openDialog(ev)}
            >
              {ev.completada ? 'Editar' : 'Evaluar'}
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={dialogEval !== null} onOpenChange={v => !v && setDialogEval(null)}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[85vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {dialogEval?.employee.apellido}, {dialogEval?.employee.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-5 py-2">
            {criterios.map(criterio => (
              <div key={criterio.nombre}>
                <p className="text-sm font-medium mb-2">{criterio.label}</p>
                {criterio.tipo === 'numerico' ? (
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <button
                        key={n}
                        onClick={() => setResultado(criterio.nombre, String(n))}
                        className={cn(
                          'w-10 h-10 rounded-md text-sm font-semibold border transition-colors',
                          resultados[criterio.nombre] === String(n)
                            ? 'bg-green-700 text-white border-green-700'
                            : 'border-border hover:bg-muted text-foreground'
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Textarea
                    value={resultados[criterio.nombre] ?? ''}
                    onChange={e => setResultado(criterio.nombre, e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                  />
                )}
              </div>
            ))}
            <div>
              <p className="text-sm font-medium mb-2">Comentario general (opcional)</p>
              <Textarea
                placeholder="Observaciones generales sobre el empleado…"
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setDialogEval(null)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={handleGuardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar evaluación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
