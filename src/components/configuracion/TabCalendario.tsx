'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Plus, Pencil, Trash2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface TipoEvento {
  id: number
  nombre: string
  color: string
  permiteAdmin: boolean
  permiteEmpleado: boolean
  protegido: boolean
}

const COLORES_PRESET = [
  '#3b82f6', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#059669', '#ea580c', '#6b7280',
]

export function TabCalendario() {
  const [tipos, setTipos] = useState<TipoEvento[]>([])
  const [dialog, setDialog] = useState<{ tipo?: TipoEvento } | null>(null)
  const [form, setForm] = useState({ nombre: '', color: '#3b82f6', permiteAdmin: true, permiteEmpleado: false })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TipoEvento | null>(null)

  async function load() {
    const r = await fetch('/api/configuracion/tipos-evento')
    const data = await r.json()
    if (!r.ok) { toast.error(data?.error ?? 'Error cargando tipos'); return }
    setTipos(Array.isArray(data) ? data : [])
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setForm({ nombre: '', color: '#3b82f6', permiteAdmin: true, permiteEmpleado: false })
    setDialog({})
  }

  function openEdit(tipo: TipoEvento) {
    setForm({ nombre: tipo.nombre, color: tipo.color, permiteAdmin: tipo.permiteAdmin, permiteEmpleado: tipo.permiteEmpleado })
    setDialog({ tipo })
  }

  async function handleSave() {
    if (!dialog?.tipo && !form.nombre.trim()) return
    setSaving(true)
    const isEdit = !!dialog?.tipo
    const url = isEdit ? `/api/configuracion/tipos-evento/${dialog.tipo!.id}` : '/api/configuracion/tipos-evento'
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error'); return }
    toast.success(isEdit ? 'Tipo actualizado' : 'Tipo creado')
    setDialog(null)
    load()
  }

  async function doDelete() {
    if (!deleteTarget) return
    const res = await fetch(`/api/configuracion/tipos-evento/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error al eliminar'); return }
    toast.success('Tipo eliminado')
    load()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tipos de evento</CardTitle>
            <CardDescription className="mt-1">
              Define los tipos de eventos y quién puede crearlos.
            </CardDescription>
          </div>
          <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={openCreate}>
            <Plus size={14} className="mr-1" /> Nuevo tipo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-xs border-b">
              <th className="text-left pb-2 font-medium">Nombre</th>
              <th className="text-left pb-2 font-medium">Color</th>
              <th className="text-center pb-2 font-medium">Admin</th>
              <th className="text-center pb-2 font-medium">Empleado</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {tipos.map(t => (
              <tr key={t.id} className={t.protegido ? 'bg-muted/50' : ''}>
                <td className="py-2.5">
                  <span className="flex items-center gap-1.5">
                    {t.protegido && <Lock size={11} className="text-muted-foreground shrink-0" />}
                    <span className="font-medium">{t.nombre}</span>
                  </span>
                </td>
                <td className="py-2.5">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-4 w-4 rounded-full border border-border" style={{ backgroundColor: t.color }} />
                    <span className="text-xs text-muted-foreground font-mono">{t.color}</span>
                  </span>
                </td>
                <td className="text-center py-2.5 text-muted-foreground">{t.permiteAdmin ? '✓' : '–'}</td>
                <td className="text-center py-2.5 text-muted-foreground">{t.permiteEmpleado ? '✓' : '–'}</td>
                <td className="py-2.5 text-right">
                  <button onClick={() => openEdit(t)} className="p-1 hover:text-foreground text-muted-foreground" title="Editar">
                    <Pencil size={13} />
                  </button>
                  {!t.protegido && (
                    <button onClick={() => setDeleteTarget(t)} className="p-1 hover:text-red-600 text-muted-foreground ml-1" title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`¿Eliminar tipo "${deleteTarget?.nombre}"?`}
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Dialog open={!!dialog} onOpenChange={open => { if (!open) setDialog(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog?.tipo ? 'Editar tipo de evento' : 'Nuevo tipo de evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
              <Input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="VACACIONES"
                disabled={dialog?.tipo?.protegido}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="h-8 w-8 rounded border cursor-pointer"
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLORES_PRESET.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: form.color === c ? '#111' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {!dialog?.tipo?.protegido && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-sm">Admins pueden crear</label>
                  <Switch checked={form.permiteAdmin} onCheckedChange={v => setForm(f => ({ ...f, permiteAdmin: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm">Empleados pueden crear</label>
                  <Switch checked={form.permiteEmpleado} onCheckedChange={v => setForm(f => ({ ...f, permiteEmpleado: v }))} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
