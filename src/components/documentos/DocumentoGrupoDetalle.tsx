'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, FileText, Search, Send, Trash2 } from 'lucide-react'

interface Asignacion {
  id: number
  estado: string
  firmaConforme: boolean | null
  firmaComentario: string | null
  fechaFirma: string | null
  fechaCarga: string
  employee: {
    id: number
    nombre: string
    apellido: string
    legajo: string
    categoria: { id: number; nombre: string } | null
  }
}

interface Grupo {
  id: number
  nombreArchivo: string
  periodo: string | null
  createdAt: string
  tipoDocumento: { id: number; nombre: string; accion: string } | null
  cargadoPor: { email: string }
  asignaciones: Asignacion[]
}

export function DocumentoGrupoDetalle({ grupoId }: { grupoId: number }) {
  const router = useRouter()
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/documentos-grupos/${grupoId}`)
    if (r.ok) setGrupo(await r.json())
    setLoading(false)
  }, [grupoId])

  useEffect(() => { load() }, [load])

  async function eliminarGrupo() {
    const r = await fetch(`/api/documentos-grupos/${grupoId}`, { method: 'DELETE' })
    if (r.ok) { toast.success('Documento eliminado'); router.push('/admin/documentos') }
    else toast.error('No se pudo eliminar')
    setConfirmDelete(false)
  }

  async function enviarFirma(asignacionIds?: number[]) {
    setSending(true)
    const r = await fetch(`/api/documentos-grupos/${grupoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asignacionIds ? { asignacionIds } : {}),
    })
    setSending(false)
    if (r.ok) {
      const d = await r.json()
      toast.success(`${d.sent} enviado${d.sent !== 1 ? 's' : ''} a firma`)
      setSelected(new Set())
      load()
    } else toast.error('No se pudo enviar')
  }

  if (loading) return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
    </div>
  )
  if (!grupo) return <p className="text-sm text-muted-foreground">No encontrado.</p>

  const q = busqueda.trim().toLowerCase()
  const filtradas = grupo.asignaciones.filter(a => {
    if (!q) return true
    return `${a.employee.apellido} ${a.employee.nombre} ${a.employee.legajo}`.toLowerCase().includes(q)
  })
  const stats = {
    total: grupo.asignaciones.length,
    firmados: grupo.asignaciones.filter(a => a.estado === 'FIRMADO').length,
    enFirma: grupo.asignaciones.filter(a => a.estado === 'ENVIADO_A_FIRMA').length,
    borradores: grupo.asignaciones.filter(a => a.estado === 'BORRADOR').length,
  }
  const borradorIds = grupo.asignaciones.filter(a => a.estado === 'BORRADOR').map(a => a.id)
  const selectedBorradores = borradorIds.filter(id => selected.has(id))
  const allBorradoresSelected = borradorIds.length > 0 && borradorIds.every(id => selected.has(id))

  function toggle(id: number) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function toggleAllBorradores() {
    if (allBorradoresSelected) setSelected(new Set())
    else setSelected(new Set(borradorIds))
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/documentos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> Volver a documentos
      </Link>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <FileText size={16} className="text-muted-foreground shrink-0" />
              <h2 className="font-semibold text-lg truncate">{grupo.nombreArchivo}</h2>
              {grupo.tipoDocumento && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{grupo.tipoDocumento.nombre}</span>}
              {grupo.periodo && <span className="text-xs text-muted-foreground">· {grupo.periodo}</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              Cargado por {grupo.cargadoPor.email} · {new Date(grupo.createdAt).toLocaleDateString('es-AR')}
            </p>
            <div className="flex gap-4 mt-3 text-sm flex-wrap">
              <span><strong>{stats.total}</strong> asignados</span>
              <span className="text-green-700 dark:text-green-400"><strong>{stats.firmados}</strong> firmados</span>
              <span className="text-blue-600 dark:text-blue-400"><strong>{stats.enFirma}</strong> en firma</span>
              <span className="text-muted-foreground"><strong>{stats.borradores}</strong> borrador{stats.borradores !== 1 ? 'es' : ''}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <a href={`/api/documentos-grupos/${grupo.id}/archivo`} target="_blank">
              <Button variant="outline" size="sm"><FileText size={13} className="mr-1.5" /> Ver archivo</Button>
            </a>
            <Button
              variant="outline" size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950/30"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={13} className="mr-1.5" /> Eliminar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input className="pl-9" placeholder="Buscar por empleado o legajo…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        {borradorIds.length > 0 && (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={sending}
            onClick={() => enviarFirma(selected.size > 0 ? selectedBorradores : borradorIds)}
          >
            <Send size={13} className="mr-1.5" />
            {selected.size > 0
              ? `Enviar ${selectedBorradores.length} seleccionado${selectedBorradores.length !== 1 ? 's' : ''}`
              : `Enviar ${borradorIds.length} borrador${borradorIds.length !== 1 ? 'es' : ''}`}
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-4 py-2.5 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
          <Checkbox
            checked={allBorradoresSelected}
            onCheckedChange={toggleAllBorradores}
            disabled={borradorIds.length === 0}
            aria-label="Seleccionar todos los borradores"
          />
          <span>Empleado</span>
          <span className="w-16 text-right">Legajo</span>
          <span className="w-32">Estado</span>
          <span className="w-24 text-right">Firmado</span>
        </div>
        {filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin resultados</p>
        ) : (
          filtradas.map(a => {
            const isBorrador = a.estado === 'BORRADOR'
            return (
              <div key={a.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/20 text-sm">
                <Checkbox
                  checked={selected.has(a.id)}
                  onCheckedChange={() => toggle(a.id)}
                  disabled={!isBorrador}
                  aria-label={`Seleccionar ${a.employee.apellido}, ${a.employee.nombre}`}
                />
                <div className="min-w-0">
                  <p className="truncate">{a.employee.apellido}, {a.employee.nombre}</p>
                  {a.employee.categoria && (
                    <p className="text-xs text-muted-foreground truncate">{a.employee.categoria.nombre}</p>
                  )}
                </div>
                <span className="w-16 text-right text-xs text-muted-foreground">{a.employee.legajo}</span>
                <span className="w-32 inline-flex items-center gap-1.5">
                  <StatusBadge estado={a.estado} accion={grupo.tipoDocumento?.accion} pov="admin" />
                  {a.estado === 'FIRMADO' && a.firmaConforme === true && (
                    <span className="text-[10px] text-green-700 dark:text-green-400">✓</span>
                  )}
                  {a.estado === 'FIRMADO' && a.firmaConforme === false && (
                    <span className="text-[10px] text-red-600 dark:text-red-400">✗</span>
                  )}
                </span>
                <span className="w-24 text-right text-xs text-muted-foreground">
                  {a.fechaFirma ? new Date(a.fechaFirma).toLocaleDateString('es-AR') : '—'}
                </span>
              </div>
            )
          })
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={o => { if (!o) setConfirmDelete(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina el archivo y las {stats.total} asignación{stats.total !== 1 ? 'es' : ''}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={eliminarGrupo}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
