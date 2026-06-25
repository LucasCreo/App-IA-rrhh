'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle2, Circle, Download } from 'lucide-react'

interface Criterio { nombre: string; label: string; tipo: 'numerico' | 'texto' }

interface Evaluacion {
  id: number
  completada: boolean
  resultados: Record<string, string>
  comentario?: string
  createdAt: string
  ronda: {
    nombre: string
    plantilla: { nombre: string; criterios: Criterio[] }
  }
}

export function EmpleadoEvaluacionesTab({ employeeId }: { employeeId: number }) {
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Evaluacion | null>(null)

  useEffect(() => {
    fetch(`/api/empleados/${employeeId}/evaluaciones`)
      .then(r => r.json())
      .then(setEvaluaciones)
      .finally(() => setLoading(false))
  }, [employeeId])

  function exportar() {
    const rows = evaluaciones.map(ev => {
      const numericos = ev.ronda.plantilla.criterios.filter(c => c.tipo === 'numerico')
      const promedio = numericos.length > 0
        ? (numericos.reduce((sum, c) => sum + (Number(ev.resultados[c.nombre]) || 0), 0) / numericos.length).toFixed(1)
        : ''
      return {
        'Ronda': ev.ronda.nombre,
        'Plantilla': ev.ronda.plantilla.nombre,
        'Estado': ev.completada ? 'Completada' : 'Pendiente',
        'Promedio': promedio ? `${promedio}/10` : '',
        'Comentario': ev.comentario ?? '',
        'Fecha': new Date(ev.createdAt).toLocaleDateString('es-AR'),
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones')
    XLSX.writeFile(wb, 'evaluaciones.xlsx')
  }

  if (loading) return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
    </div>
  )

  if (evaluaciones.length === 0) return (
    <p className="text-sm text-muted-foreground py-8 text-center">Sin evaluaciones registradas</p>
  )

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" variant="outline" onClick={exportar}>
          <Download size={14} className="mr-1.5" /> Exportar Excel
        </Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="border-b">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ronda</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plantilla</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Promedio</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {evaluaciones.map(ev => {
              const numericos = ev.ronda.plantilla.criterios.filter(c => c.tipo === 'numerico')
              const promedio = numericos.length > 0
                ? (numericos.reduce((sum, c) => sum + (Number(ev.resultados[c.nombre]) || 0), 0) / numericos.length).toFixed(1)
                : null

              return (
                <tr key={ev.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{ev.ronda.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ev.ronda.plantilla.nombre}</td>
                  <td className="px-4 py-3">
                    {ev.completada
                      ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1"><CheckCircle2 size={11} /> Completada</Badge>
                      : <Badge variant="outline" className="gap-1 text-muted-foreground"><Circle size={11} /> Pendiente</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {ev.completada && promedio
                      ? <span className="font-semibold text-green-700 dark:text-green-400">{promedio} / 10</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(ev.createdAt).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {ev.completada && (
                      <Button size="sm" variant="ghost" onClick={() => setSelected(ev)} className="text-xs h-7 px-2">
                        Ver detalle
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.ronda.nombre}</DialogTitle>
            <p className="text-xs text-muted-foreground">{selected?.ronda.plantilla.nombre}</p>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 mt-1">
              {selected.ronda.plantilla.criterios.map(c => (
                <div key={c.nombre} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-medium">
                    {c.tipo === 'numerico'
                      ? `${selected.resultados[c.nombre] ?? '—'} / 10`
                      : selected.resultados[c.nombre] ?? '—'}
                  </span>
                </div>
              ))}
              {selected.comentario && (
                <div className="border-t pt-3 mt-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Comentario</p>
                  <p className="text-sm">{selected.comentario}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
