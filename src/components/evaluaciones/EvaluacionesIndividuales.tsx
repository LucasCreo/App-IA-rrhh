'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Criterio { nombre: string; label: string; tipo: 'numerico' | 'texto' }

interface EvaluacionItem {
  id: number
  completada: boolean
  resultados: Record<string, string>
  comentario?: string
  employee: { id: number; nombre: string; apellido: string; legajo: string }
  ronda: {
    id: number
    nombre: string
    estado: string
    plantilla: { nombre: string; criterios: Criterio[] }
  }
}

type FiltroEstado = 'todas' | 'pendiente' | 'completada'

export function EvaluacionesIndividuales() {
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas')
  const [dialogEval, setDialogEval] = useState<EvaluacionItem | null>(null)
  const [resultados, setResultados] = useState<Record<string, string>>({})
  const [comentario, setComentario] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/evaluaciones').then(r => r.json()).then(setEvaluaciones).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openDialog(ev: EvaluacionItem) {
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

  const filtradas = evaluaciones.filter(e => {
    const match = `${e.employee.apellido} ${e.employee.nombre} ${e.employee.legajo} ${e.ronda.nombre}`
      .toLowerCase().includes(busqueda.toLowerCase())
    if (!match) return false
    if (filtroEstado === 'pendiente') return !e.completada
    if (filtroEstado === 'completada') return e.completada
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Buscar empleado o ronda…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="h-8 text-sm max-w-64"
        />
        <div className="flex rounded-md border overflow-hidden">
          {(['todas', 'pendiente', 'completada'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroEstado(f)}
              className={cn(
                'px-3 h-8 text-xs font-medium transition-colors',
                filtroEstado === f
                  ? 'bg-green-700 text-white'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              {f === 'todas' ? 'Todas' : f === 'pendiente' ? 'Pendientes' : 'Completadas'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">
          {busqueda || filtroEstado !== 'todas' ? 'Sin resultados para ese filtro.' : 'No hay evaluaciones aún.'}
        </p>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {filtradas.map(ev => {
            const cerrada = ev.ronda.estado === 'CERRADA'
            return (
              <div key={ev.id} className="flex items-center gap-4 px-4 py-3 bg-card">
                {ev.completada
                  ? <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                  : <Circle size={16} className="text-muted-foreground shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{ev.employee.apellido}, {ev.employee.nombre}</p>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{ev.ronda.nombre}</span>
                    <Badge
                      variant={cerrada ? 'secondary' : 'outline'}
                      className={cn('text-xs', !cerrada && 'border-green-600 text-green-700 dark:text-green-400')}
                    >
                      {cerrada ? 'Cerrada' : 'Activa'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{ev.employee.legajo}</p>
                  {ev.completada && ev.ronda.plantilla.criterios.filter(c => c.tipo === 'numerico').length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {ev.ronda.plantilla.criterios.filter(c => c.tipo === 'numerico').map(c => (
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
            )
          })}
        </div>
      )}

      <Dialog open={dialogEval !== null} onOpenChange={v => !v && setDialogEval(null)}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[85vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {dialogEval?.employee.apellido}, {dialogEval?.employee.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-5 py-2">
            {dialogEval?.ronda.plantilla.criterios.map(criterio => (
              <div key={criterio.nombre}>
                <p className="text-sm font-medium mb-2">{criterio.label}</p>
                {criterio.tipo === 'numerico' ? (
                  <div className="flex gap-1.5 flex-wrap">
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
                placeholder="Observaciones generales…"
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
