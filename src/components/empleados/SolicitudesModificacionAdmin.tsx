'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Check, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface Solicitud {
  id: number
  comentario: string
  estado: string
  createdAt: string
}

export function SolicitudesModificacionAdmin({ employeeId }: { employeeId: number }) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  function load() {
    fetch(`/api/solicitudes-modificacion?employeeId=${employeeId}`)
      .then(r => r.json())
      .then(setSolicitudes)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [employeeId])

  async function marcarRevisado(id: number) {
    const prev = solicitudes
    // Optimista: marcar como REVISADO inmediatamente
    setSolicitudes(prev.map(s => s.id === id ? { ...s, estado: 'REVISADO' } : s))
    toast.success('Marcado como revisado')

    const res = await fetch(`/api/solicitudes-modificacion/${id}`, { method: 'PATCH' })
    if (!res.ok) {
      setSolicitudes(prev)
      toast.error('Error al actualizar')
      return
    }
    router.refresh()
  }

  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
    </div>
  )
  if (solicitudes.length === 0) return (
    <p className="text-xs text-muted-foreground py-2">Sin solicitudes de modificación.</p>
  )

  return (
    <div className="space-y-2">
      {solicitudes.map(s => (
        <div key={s.id} className={cn(
          'flex items-start gap-3 rounded-md border p-3 text-sm',
          s.estado === 'PENDIENTE' ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/20' : 'bg-muted/30'
        )}>
          <MessageSquare size={14} className={cn('mt-0.5 shrink-0', s.estado === 'PENDIENTE' ? 'text-yellow-600' : 'text-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <p className={s.estado === 'PENDIENTE' ? 'text-foreground' : 'text-muted-foreground'}>{s.comentario}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(s.createdAt).toLocaleDateString('es-AR')}
              {s.estado === 'REVISADO' && <span className="ml-2 text-green-600">· Revisado</span>}
            </p>
          </div>
          {s.estado === 'PENDIENTE' && (
            <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => marcarRevisado(s.id)}>
              <Check size={12} className="mr-1" /> Revisado
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
