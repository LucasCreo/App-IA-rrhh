'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ClipboardList, CheckCircle2, Circle } from 'lucide-react'
import { FormularioDialog, FormularioRespuesta } from './FormularioDialog'

export function MisFormularios() {
  const [respuestas, setRespuestas] = useState<FormularioRespuesta[]>([])
  const [editRespuesta, setEditRespuesta] = useState<FormularioRespuesta | null>(null)
  const [viewRespuesta, setViewRespuesta] = useState<FormularioRespuesta | null>(null)

  function load() {
    fetch('/api/empleado/formularios').then(r => r.json()).then(setRespuestas)
  }
  useEffect(() => { load() }, [])

  if (respuestas.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No tenés formularios asignados</p>
      </div>
    )
  }

  const pendientes = respuestas.filter(r => r.estado === 'PENDIENTE')
  const enviadas = respuestas.filter(r => r.estado === 'ENVIADO')

  return (
    <div className="space-y-4">
      {pendientes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pendientes</p>
          <div className="space-y-2">
            {pendientes.map(r => (
              <div key={r.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{r.asignacion.nombre}</p>
                  <p className="text-xs text-muted-foreground">{r.asignacion.plantilla.nombre}</p>
                  {r.asignacion.fechaLimite && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                      Vence: {new Date(r.asignacion.fechaLimite!).toLocaleDateString('es-AR')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Circle size={12} /> Pendiente
                  </span>
                  <Button size="sm" className="bg-green-700 hover:bg-green-800 h-8 text-xs" onClick={() => setEditRespuesta(r)}>
                    Completar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {enviadas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Enviados</p>
          <div className="space-y-2">
            {enviadas.map(r => (
              <div key={r.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{r.asignacion.nombre}</p>
                  <p className="text-xs text-muted-foreground">{r.asignacion.plantilla.nombre}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enviado el {new Date(r.updatedAt).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 size={12} /> Enviado
                  </span>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setViewRespuesta(r)}>
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <FormularioDialog
        respuesta={editRespuesta}
        mode="fill"
        onClose={() => setEditRespuesta(null)}
        onSaved={load}
      />
      <FormularioDialog
        respuesta={viewRespuesta}
        mode="view"
        onClose={() => setViewRespuesta(null)}
      />
    </div>
  )
}
