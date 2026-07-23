'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle2, Clock, Download } from 'lucide-react'

interface Campo { nombre: string; label: string; tipo: string; rellena: string }

interface Respuesta {
  id: number
  estado: string
  datos: Record<string, string>
  createdAt: string
  updatedAt: string
  asignacion: {
    nombre: string
    fechaLimite?: string
    datosAdmin: Record<string, string>
    plantilla: { nombre: string; campos: Campo[] }
  }
}

export function EmpleadoFormulariosTab({ employeeId }: { employeeId: number }) {
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Respuesta | null>(null)

  useEffect(() => {
    fetch(`/api/empleados/${employeeId}/formularios`)
      .then(r => r.json())
      .then(setRespuestas)
      .finally(() => setLoading(false))
  }, [employeeId])

  function exportar() {
    const rows = respuestas.map(r => ({
      'Asignación': r.asignacion.nombre,
      'Plantilla': r.asignacion.plantilla.nombre,
      'Estado': r.estado === 'COMPLETADO' ? 'Completado' : 'Pendiente',
      'Fecha límite': r.asignacion.fechaLimite
        ? new Date(r.asignacion.fechaLimite).toLocaleDateString('es-AR')
        : '',
      'Respondido': r.estado === 'COMPLETADO'
        ? new Date(r.updatedAt).toLocaleDateString('es-AR')
        : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Formularios')
    XLSX.writeFile(wb, 'formularios.xlsx')
  }

  if (loading) return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
    </div>
  )

  if (respuestas.length === 0) return (
    <p className="text-sm text-muted-foreground py-8 text-center">Sin formularios asignados</p>
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
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Asignación</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plantilla</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha límite</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Respondido</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {respuestas.map(r => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium">{r.asignacion.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.asignacion.plantilla.nombre}</td>
                <td className="px-4 py-3">
                  {r.estado === 'COMPLETADO'
                    ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1"><CheckCircle2 size={11} /> Completado</Badge>
                    : <Badge variant="outline" className="gap-1 text-muted-foreground"><Clock size={11} /> Pendiente</Badge>}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {r.asignacion.fechaLimite
                    ? new Date(r.asignacion.fechaLimite).toLocaleDateString('es-AR')
                    : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {r.estado === 'COMPLETADO'
                    ? new Date(r.updatedAt).toLocaleDateString('es-AR')
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.estado === 'COMPLETADO' && (
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)} className="text-xs h-7 px-2">
                      Ver respuestas
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.asignacion.nombre}</DialogTitle>
            <p className="text-xs text-muted-foreground">{selected?.asignacion.plantilla.nombre}</p>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 mt-1 max-h-96 overflow-y-auto pr-1">
              {selected.asignacion.plantilla.campos
                .filter(c => c.rellena === 'empleado')
                .map(c => {
                  const valor = selected.datos[c.nombre]
                  return (
                    <div key={c.nombre} className="flex items-start justify-between text-sm gap-4">
                      <span className="text-muted-foreground shrink-0">{c.label}</span>
                      {c.tipo === 'archivo' && valor ? (
                        <a
                          href={`/api/formularios/archivo?file=${valor}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-right text-green-700 dark:text-green-400 hover:underline truncate max-w-[200px]"
                        >
                          {valor.replace(/^\d+-/, '')}
                        </a>
                      ) : (
                        <span className="font-medium text-right">{valor || '—'}</span>
                      )}
                    </div>
                  )
                })}
              {selected.asignacion.plantilla.campos.some(c => c.rellena === 'admin') && (
                <div className="border-t pt-3 mt-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Datos administrativos</p>
                  {selected.asignacion.plantilla.campos
                    .filter(c => c.rellena === 'admin')
                    .map(c => (
                      <div key={c.nombre} className="flex items-start justify-between text-sm gap-4 mb-2">
                        <span className="text-muted-foreground shrink-0">{c.label}</span>
                        <span className="font-medium text-right">{selected.asignacion.datosAdmin[c.nombre] || '—'}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
