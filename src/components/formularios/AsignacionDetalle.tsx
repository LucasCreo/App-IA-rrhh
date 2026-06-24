'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

interface Campo {
  nombre: string
  label: string
  tipo: 'texto' | 'numero' | 'fecha' | 'seleccion'
  opciones?: string
  requerido: boolean
}

interface Respuesta {
  id: number
  estado: string
  datos: Record<string, string>
  updatedAt: string
  employee: { id: number; nombre: string; apellido: string; legajo: string }
}

interface Asignacion {
  id: number
  nombre: string
  fechaLimite: string | null
  createdAt: string
  plantilla: { nombre: string; descripcion?: string; campos: Campo[] }
  respuestas: Respuesta[]
}

export function AsignacionDetalle({ id }: { id: number }) {
  const [asignacion, setAsignacion] = useState<Asignacion | null>(null)
  const [viewRespuesta, setViewRespuesta] = useState<Respuesta | null>(null)

  useEffect(() => {
    fetch(`/api/formularios/asignaciones/${id}`).then(r => r.json()).then(setAsignacion)
  }, [id])

  if (!asignacion) return <p className="text-sm text-muted-foreground">Cargando...</p>

  const enviadas = asignacion.respuestas.filter(r => r.estado === 'ENVIADO').length
  const campos = asignacion.plantilla.campos

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/formularios" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
          <ChevronLeft size={13} /> Formularios
        </Link>
        <h2 className="text-lg font-semibold">{asignacion.nombre}</h2>
        <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
          <span>Plantilla: <span className="font-medium text-foreground">{asignacion.plantilla.nombre}</span></span>
          <span>·</span>
          <span>Progreso: <span className={cn('font-medium', enviadas === asignacion.respuestas.length ? 'text-green-600 dark:text-green-400' : 'text-foreground')}>{enviadas}/{asignacion.respuestas.length}</span></span>
          {asignacion.fechaLimite && (
            <>
              <span>·</span>
              <span>Límite: <span className="font-medium text-foreground">{new Date(asignacion.fechaLimite).toLocaleDateString('es-AR')}</span></span>
            </>
          )}
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Empleado</th>
              <th className="text-center px-4 py-2.5 font-medium">Estado</th>
              <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Enviado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {asignacion.respuestas.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.employee.apellido}, {r.employee.nombre}</p>
                  <p className="text-xs text-muted-foreground">{r.employee.legajo}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  {r.estado === 'ENVIADO' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                      <CheckCircle2 size={13} /> Enviado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Circle size={13} /> Pendiente
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                  {r.estado === 'ENVIADO' ? new Date(r.updatedAt).toLocaleDateString('es-AR') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.estado === 'ENVIADO' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setViewRespuesta(r)}>
                      Ver respuesta
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={viewRespuesta !== null} onOpenChange={v => !v && setViewRespuesta(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{viewRespuesta?.employee.apellido}, {viewRespuesta?.employee.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {campos.length === 0 && <p className="text-sm text-muted-foreground">Este formulario no tiene campos.</p>}
            {campos.map(campo => (
              <div key={campo.nombre}>
                <p className="text-xs font-medium text-muted-foreground mb-1">{campo.label}</p>
                <p className="text-sm bg-muted/40 rounded-md px-3 py-2">
                  {viewRespuesta?.datos?.[campo.nombre] || <span className="text-muted-foreground italic">Sin respuesta</span>}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
