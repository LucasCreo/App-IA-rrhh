'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Check, X, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CampoSolicitud { nombre: string; label: string }

interface Solicitud {
  id: number; nombreArchivo?: string; estado: string
  descripcion?: string; comentario?: string; comentarioVisible: boolean
  metadata?: string; createdAt: string
  employee: { id: number; nombre: string; apellido: string; legajo: string }
  tipo: { id: number; nombre: string; campos?: CampoSolicitud[] }
}

type AccionDialog = { id: number; estado: 'APROBADO' | 'RECHAZADO' } | null

const FILTROS = [
  { value: '',          label: 'Todas' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'APROBADO',  label: 'Aprobadas' },
  { value: 'RECHAZADO', label: 'Rechazadas' },
]

export function SolicitudesTab() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [filtro, setFiltro] = useState('PENDIENTE')
  const [loading, setLoading] = useState(true)
  const [accion, setAccion] = useState<AccionDialog>(null)
  const [comentario, setComentario] = useState('')
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  const load = useCallback(() => {
    setLoading(true)
    const url = filtro ? `/api/solicitudes?estado=${filtro}` : '/api/solicitudes'
    fetch(url).then(r => r.json()).then(setSolicitudes).finally(() => setLoading(false))
  }, [filtro])

  useEffect(() => { load() }, [load])

  function openDialog(id: number, estado: 'APROBADO' | 'RECHAZADO') {
    setAccion({ id, estado })
    setComentario('')
    setVisible(false)
  }

  function closeDialog() { setAccion(null) }

  async function handleConfirmar() {
    if (!accion) return
    const res = await fetch(`/api/solicitudes/${accion.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: accion.estado, comentario, comentarioVisible: visible }),
    })
    if (!res.ok) { toast.error('Error al actualizar la solicitud'); return }
    toast.success(accion.estado === 'APROBADO' ? 'Solicitud aprobada' : 'Solicitud rechazada')
    closeDialog()
    load()
    router.refresh()
  }

  const esAprobacion = accion?.estado === 'APROBADO'

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b pb-0">
        {FILTROS.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              filtro === f.value
                ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : solicitudes.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No hay solicitudes en esta categoría.</p>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {solicitudes.map(s => (
            <div key={s.id} className="flex items-start gap-4 px-4 py-3 bg-card">
              <FileText size={16} className="text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{s.employee.apellido}, {s.employee.nombre}</span>
                  <span className="text-xs text-muted-foreground">· {s.employee.legajo}</span>
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.tipo.nombre}</span>
                </div>
                {s.nombreArchivo && (
                  <a
                    href={`/api/solicitudes/archivo?file=${s.nombreArchivo}`}
                    target="_blank"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {s.nombreArchivo.replace(/^\d+-/, '')}
                  </a>
                )}
                {(() => {
                  try {
                    const meta = JSON.parse(s.metadata ?? '{}') as Record<string, string>
                    const entries = Object.entries(meta).filter(([, v]) => v)
                    if (!entries.length) return null
                    return (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {entries.map(([k, v]) => {
                          const campo = s.tipo.campos?.find(c => c.nombre === k)
                          return (
                            <span key={k} className="text-xs text-muted-foreground">
                              {campo?.label ?? k}: <span className="text-foreground">{v}</span>
                            </span>
                          )
                        })}
                      </div>
                    )
                  } catch { return null }
                })()}
                {s.descripcion && (
                  <p className="text-xs text-muted-foreground mt-1">{s.descripcion}</p>
                )}
                {s.comentario && (
                  <p className={cn('text-xs italic mt-1 border-l-2 pl-2', s.comentarioVisible ? 'border-green-400 text-muted-foreground' : 'border-border text-muted-foreground/60')}>
                    {s.comentario}
                    {!s.comentarioVisible && <span className="ml-1 not-italic text-muted-foreground/50">(no visible al empleado)</span>}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <StatusBadge estado={s.estado} />
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(s.createdAt).toLocaleDateString('es-AR')}
                  </p>
                </div>
                {s.estado === 'PENDIENTE' && (
                  <div className="flex gap-1">
                    <Button
                      size="sm" variant="outline"
                      className="h-8 w-8 p-0 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/30"
                      title="Aprobar"
                      onClick={() => openDialog(s.id, 'APROBADO')}
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="h-8 w-8 p-0 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Rechazar"
                      onClick={() => openDialog(s.id, 'RECHAZADO')}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={accion !== null} onOpenChange={closeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{esAprobacion ? 'Aprobar solicitud' : 'Rechazar solicitud'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Podés agregar un comentario opcional para el empleado.
            </p>
            <Textarea
              placeholder="Ej: Todo en orden, muchas gracias…"
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              rows={3}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="visible"
                checked={visible}
                onCheckedChange={v => setVisible(v === true)}
                disabled={!comentario.trim()}
              />
              <label htmlFor="visible" className={cn('text-sm select-none', !comentario.trim() && 'text-muted-foreground/50')}>
                Mostrar comentario al empleado
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              className={esAprobacion ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
              onClick={handleConfirmar}
            >
              {esAprobacion ? 'Aprobar' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
