'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/apiErrors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, Save, Lock } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface TipoAusencia {
  id: number; nombre: string; color: string; requiereAprobacion: boolean; afectaSaldo: boolean; activo: boolean; protegido?: boolean
}
interface SaldoRow {
  id: number; nombre: string; apellido: string; legajo: string
  anio: number; diasTotales: number; diasUsados: number; saldoId: number | null
}

// ── Tab Saldos ───────────────────────────────────────────────────────────────
export function TabSaldos() {
  const router = useRouter()
  const [data, setData] = useState<SaldoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id: number; diasTotales: number } | null>(null)
  const [dias, setDias] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/ausencias/saldos').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function guardar() {
    if (!editing) return
    const res = await fetch('/api/ausencias/saldos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: editing.id, anio: new Date().getFullYear(), diasTotales: Number(dias) }),
    })
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success('Saldo actualizado')
    setEditing(null)
    load()
  }

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>

  return (
    <>
      <p className="text-xs text-muted-foreground mb-3">Saldo de vacaciones — año {new Date().getFullYear()}</p>
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empleado</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Legajo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usados</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Restantes</th>
              <th className="text-right px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.map(row => {
              const restantes = row.diasTotales - row.diasUsados
              return (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.apellido}, {row.nombre}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">{row.legajo}</td>
                  <td className="px-4 py-3">{row.diasTotales}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.diasUsados}</td>
                  <td className="px-4 py-3">
                    <span className={restantes < 0 ? 'text-red-600 font-medium' : restantes <= 3 ? 'text-yellow-600 font-medium' : 'text-green-600 font-medium'}>
                      {restantes}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditing({ id: row.id, diasTotales: row.diasTotales }); setDias(String(row.diasTotales)) }}>
                      <Pencil size={13} />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Editar días totales</DialogTitle></DialogHeader>
          <Input type="number" min={0} value={dias} onChange={e => setDias(e.target.value)} />
          <DialogFooter>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 w-full" onClick={guardar}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Tab Tipos ────────────────────────────────────────────────────────────────
export function TabTipos() {
  const router = useRouter()
  const [tipos, setTipos] = useState<TipoAusencia[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ nombre: '', color: '#6b7280', requiereAprobacion: true, afectaSaldo: false })
  const [editTarget, setEditTarget] = useState<TipoAusencia | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', color: '#6b7280', requiereAprobacion: true, afectaSaldo: false })
  const [deleteTarget, setDeleteTarget] = useState<TipoAusencia | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/ausencias/tipos').then(r => r.json()).then(setTipos).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function guardar() {
    setSaving(true)
    const res = await fetch('/api/ausencias/tipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success('Tipo creado')
    setDialog(false)
    setForm({ nombre: '', color: '#6b7280', requiereAprobacion: true, afectaSaldo: false })
    load()
  }

  async function guardarEdit() {
    if (!editTarget) return
    setSaving(true)
    const res = await fetch(`/api/ausencias/tipos/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSaving(false)
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success('Tipo actualizado')
    setEditTarget(null)
    load()
  }

  async function toggleActivo(t: TipoAusencia) {
    await fetch(`/api/ausencias/tipos/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !t.activo }),
    })
    load()
  }

  async function doDelete() {
    if (!deleteTarget) return
    const res = await fetch(`/api/ausencias/tipos/${deleteTarget.id}`, { method: 'DELETE' })
    if (!res.ok) {
      await handleApiError(res, href => router.push(href))
      setDeleteTarget(null); return
    }
    toast.success('Tipo eliminado')
    setDeleteTarget(null)
    load()
  }

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => setDialog(true)}>
          <Plus size={14} className="mr-1" /> Nuevo tipo
        </Button>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Requiere aprobación</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Afecta saldo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {tipos.map(t => (
              <tr key={t.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors${t.protegido ? ' bg-muted/50' : ''}`}>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: t.color }} />
                    <span className="font-medium">{t.nombre}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.requiereAprobacion ? 'Sí' : 'No'}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.afectaSaldo ? 'Sí' : 'No'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActivo(t)} className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${t.activo ? 'border-green-400 text-green-700 bg-green-50 dark:bg-green-950/30' : 'border-input text-muted-foreground'}`}>
                    {t.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditTarget(t); setEditForm({ nombre: t.nombre, color: t.color, requiereAprobacion: t.requiereAprobacion, afectaSaldo: t.afectaSaldo }) }}>
                    <Pencil size={13} />
                  </Button>
                  {t.protegido ? (
                    <span title="Tipo protegido — no se puede eliminar" className="inline-flex items-center px-2 text-muted-foreground/50 h-7"><Lock size={13} /></span>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600 hover:text-red-700" onClick={() => setDeleteTarget(t)}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuevo tipo de ausencia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <Input className="mt-1" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Color</label>
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="mt-1 block h-9 w-full cursor-pointer rounded-md border border-input px-1" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Requiere aprobación</label>
              <input type="checkbox" checked={form.requiereAprobacion} onChange={e => setForm(f => ({ ...f, requiereAprobacion: e.target.checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Afecta saldo de vacaciones</label>
              <input type="checkbox" checked={form.afectaSaldo} onChange={e => setForm(f => ({ ...f, afectaSaldo: e.target.checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 w-full" disabled={saving || !form.nombre.trim()} onClick={guardar}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar tipo de ausencia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <Input className="mt-1" value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Color</label>
              <input type="color" value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                className="mt-1 block h-9 w-full cursor-pointer rounded-md border border-input px-1" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Requiere aprobación</label>
              <input type="checkbox" checked={editForm.requiereAprobacion} onChange={e => setEditForm(f => ({ ...f, requiereAprobacion: e.target.checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <label className={`text-sm ${editTarget?.protegido ? 'text-muted-foreground' : ''}`}>
                Afecta saldo de vacaciones {editTarget?.protegido && <span className="text-xs">(protegido)</span>}
              </label>
              <input
                type="checkbox"
                checked={editForm.afectaSaldo}
                disabled={editTarget?.protegido}
                onChange={e => setEditForm(f => ({ ...f, afectaSaldo: e.target.checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 w-full" disabled={saving || !editForm.nombre.trim()} onClick={guardarEdit}>
              <Save size={13} className="mr-1" /> Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`¿Eliminar tipo "${deleteTarget?.nombre}"?`}
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
