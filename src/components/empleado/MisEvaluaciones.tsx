'use client'

import { useEffect, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'

interface Criterio { nombre: string; label: string; tipo: 'numerico' | 'texto' }

interface Evaluacion {
  id: number
  resultados: Record<string, string>
  comentario?: string
  createdAt: string
  ronda: {
    nombre: string
    plantilla: { criterios: Criterio[] }
  }
}

export function MisEvaluaciones() {
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/empleado/evaluaciones').then(r => r.json()).then(setEvaluaciones).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>

  if (evaluaciones.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
      <ClipboardCheck size={32} className="opacity-30" />
      <p className="text-sm">No tenés evaluaciones completadas aún.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {evaluaciones.map(ev => {
        const criterios = ev.ronda.plantilla.criterios
        const numericos = criterios.filter(c => c.tipo === 'numerico')
        const textos = criterios.filter(c => c.tipo === 'texto')
        return (
          <div key={ev.id} className="border rounded-lg p-4 bg-card space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-medium text-sm">{ev.ronda.nombre}</p>
                <p className="text-xs text-muted-foreground">{new Date(ev.createdAt).toLocaleDateString('es-AR')}</p>
              </div>
            </div>

            {numericos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {numericos.map(c => (
                  <div key={c.nombre} className="bg-muted/40 rounded-md px-3 py-2">
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">
                      {ev.resultados[c.nombre] ?? '—'}
                      <span className="text-xs font-normal text-muted-foreground">/5</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {textos.map(c => ev.resultados[c.nombre] ? (
              <div key={c.nombre}>
                <p className="text-xs font-medium text-muted-foreground mb-1">{c.label}</p>
                <p className="text-sm">{ev.resultados[c.nombre]}</p>
              </div>
            ) : null)}

            {ev.comentario && (
              <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">
                {ev.comentario}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
