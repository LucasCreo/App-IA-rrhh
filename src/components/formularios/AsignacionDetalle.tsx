'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, ChevronLeft, Trash2, Pencil, AlertTriangle, Paperclip } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'

interface Campo {
  nombre: string
  label: string
  tipo: 'texto' | 'numero' | 'fecha' | 'seleccion' | 'archivo'
  opciones?: string
  requerido: boolean
  rellena?: 'admin' | 'empleado'
}

interface PlantillaOption { id: number; nombre: string; activo: boolean; campos: Campo[] }

interface Respuesta {
  id: number
  estado: string
  datos: Record<string, string>
  updatedAt: string
  employee: { id: number; nombre: string; apellido: string; legajo: string }
}

interface SolicitudFormulario {
  id: number
  nombre: string
  plantillaId: number
  fechaLimite: string | null
  createdAt: string
  datosAdmin: Record<string, string>
  plantilla: { nombre: string; descripcion?: string; campos: Campo[] }
  respuestas: Respuesta[]
}

export function AsignacionDetalle({ id }: { id: number }) {
  const router = useRouter()
  const [asignacion, setAsignacion] = useState<SolicitudFormulario | null>(null)
  const [viewRespuesta, setViewRespuesta] = useState<Respuesta | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [plantillas, setPlantillas] = useState<PlantillaOption[]>([])
  const [editNombre, setEditNombre] = useState('')
  const [editPlantillaId, setEditPlantillaId] = useState('')
  const [editFechaLimite, setEditFechaLimite] = useState('')
  const [editDatosAdmin, setEditDatosAdmin] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)

  async function openEdit() {
    const pRes = await fetch('/api/configuracion/plantillas-formulario').then(r => r.json())
    setPlantillas((pRes as PlantillaOption[]).filter(p => p.activo))
    setEditNombre(asignacion!.nombre)
    setEditPlantillaId(String(asignacion!.plantillaId))
    setEditFechaLimite(asignacion!.fechaLimite ? asignacion!.fechaLimite.slice(0, 10) : '')
    setEditDatosAdmin({ ...asignacion!.datosAdmin })
    setEditOpen(true)
  }

  async function handleSave() {
    if (!editNombre.trim()) { toast.error('Ingresá un nombre'); return }
    setSaving(true)
    const res = await fetch(`/api/formularios/asignaciones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre, plantillaId: Number(editPlantillaId), fechaLimite: editFechaLimite || null, datosAdmin: editDatosAdmin }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Error al guardar'); return }
    setEditOpen(false)
    const updated = await fetch(`/api/formularios/asignaciones/${id}`).then(r => r.json())
    setAsignacion(updated)
    toast.success('Solicitud actualizada')
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/formularios/asignaciones/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) { toast.error('Error al eliminar'); return }
    toast.success('Solicitud eliminada')
    router.push('/admin/formularios')
  }

  useEffect(() => {
    fetch(`/api/formularios/asignaciones/${id}`).then(r => r.json()).then(setAsignacion)
  }, [id])

  if (!asignacion) return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
    </div>
  )

  const enviadas = asignacion.respuestas.filter(r => r.estado === 'ENVIADO').length
  const campos = asignacion.plantilla.campos

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/formularios" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
          <ChevronLeft size={13} /> Formularios
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{asignacion.nombre}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={openEdit}>
              <Pencil size={14} className="mr-1.5" /> Editar
            </Button>
            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} className="mr-1.5" /> Eliminar
            </Button>
          </div>
        </div>
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

      <Dialog open={editOpen} onOpenChange={v => !v && setEditOpen(false)}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Editar solicitud</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nombre</p>
              <Input value={editNombre} onChange={e => setEditNombre(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Plantilla</p>
              <Select value={editPlantillaId} onValueChange={v => { if (v) { setEditPlantillaId(v); setEditDatosAdmin({}) } }}>
                <SelectTrigger><SelectValue placeholder="Seleccioná una plantilla" /></SelectTrigger>
                <SelectContent>
                  {plantillas.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              {editPlantillaId !== String(asignacion?.plantillaId) && asignacion && asignacion.respuestas.filter(r => r.estado === 'ENVIADO').length > 0 && (
                <div className="flex items-start gap-2 mt-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>Cambiar la plantilla reiniciará las respuestas ya enviadas por los empleados.</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Fecha límite (opcional)</p>
              <Input type="date" value={editFechaLimite} onChange={e => setEditFechaLimite(e.target.value)} />
            </div>
            {(() => {
              const plantilla = plantillas.find(p => p.id === Number(editPlantillaId))
              const camposAdmin = plantilla?.campos.filter(c => c.rellena === 'admin') ?? []
              if (!plantilla || camposAdmin.length === 0) return null
              return (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Campos pre-cargados por RRHH</p>
                  {camposAdmin.map(campo => (
                    <div key={campo.nombre}>
                      <p className="text-xs text-muted-foreground mb-1">{campo.label} <span className="italic">(opcional)</span></p>
                      {campo.tipo === 'texto' ? (
                        <Textarea className="text-sm min-h-[60px]" placeholder={`${campo.label}...`}
                          value={editDatosAdmin[campo.nombre] ?? ''}
                          onChange={e => setEditDatosAdmin(prev => ({ ...prev, [campo.nombre]: e.target.value }))} />
                      ) : (
                        <Input type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'fecha' ? 'date' : 'text'}
                          placeholder={campo.label}
                          value={editDatosAdmin[campo.nombre] ?? ''}
                          onChange={e => setEditDatosAdmin(prev => ({ ...prev, [campo.nombre]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={v => !v && setConfirmDelete(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar solicitud?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Se eliminarán todas las respuestas asociadas. Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewRespuesta !== null} onOpenChange={v => !v && setViewRespuesta(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{viewRespuesta?.employee.apellido}, {viewRespuesta?.employee.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {campos.length === 0 && <p className="text-sm text-muted-foreground">Este formulario no tiene campos.</p>}
            {campos.map(campo => {
              const valor = viewRespuesta?.datos?.[campo.nombre]
              return (
                <div key={campo.nombre}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{campo.label}</p>
                  {campo.tipo === 'archivo' && valor ? (
                    <button
                      onClick={() => setPreview({ url: `/api/formularios/archivo?file=${valor}`, filename: valor })}
                      className="text-sm text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1"
                    >
                      <Paperclip size={13} /> {valor.replace(/^\d+-/, '')}
                    </button>
                  ) : (
                    <p className="text-sm bg-muted/40 rounded-md px-3 py-2">
                      {valor || <span className="text-muted-foreground italic">Sin respuesta</span>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      <ArchivoPreviewDialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        url={preview?.url ?? null}
        filename={preview?.filename ?? null}
      />
    </div>
  )
}
