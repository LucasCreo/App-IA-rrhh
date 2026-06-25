'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CheckCircle2, XCircle, Clock, Pencil, Trash2, Plus, Save } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface TipoAusencia {
  id: number; nombre: string; color: string; requiereAprobacion: boolean; afectaSaldo: boolean; activo: boolean
}
interface Solicitud {
  id: number; estado: string; dias: number; motivo?: string; comentarioAdmin?: string; archivoUrl?: string
  fechaInicio: string; fechaFin: string; createdAt: string
  employee: { id: number; nombre: string; apellido: string; legajo: string }
  tipoAusencia: { id: number; nombre: string; color: string; afectaSaldo: boolean }
}
interface SaldoRow {
  id: number; nombre: string; apellido: string; legajo: string
  anio: number; diasTotales: number; diasUsados: number; saldoId: number | null
}

const ESTADO_BADGE: Record<string, React.ReactElement> = {
  PENDIENTE: <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-400"><Clock size={11} /> Pendiente</Badge>,
  APROBADA: <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 size={11} /> Aprobada</Badge>,
  RECHAZADA: <Badge variant="outline" className="gap-1 text-red-500 border-red-400"><XCircle size={11} /> Rechazada</Badge>,
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Tab Solicitudes ──────────────────────────────────────────────────────────
function TabSolicitudes() {
  const [data, setData] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'TODAS' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'>('TODAS')
  const [reviewing, setReviewing] = useState<Solicitud | null>(null)
  const [comentario, setComentario] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/ausencias/solicitudes').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function resolver(estado: 'APROBADA' | 'RECHAZADA') {
    if (!reviewing) return
    setSaving(true)
    const res = await fetch(`/api/ausencias/solicitudes/${reviewing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, comentarioAdmin: comentario }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Error al procesar la solicitud'); return }
    toast.success(estado === 'APROBADA' ? 'Solicitud aprobada' : 'Solicitud rechazada')
    setReviewing(null)
    setComentario('')
    load()
  }

  const visible = filtro === 'TODAS' ? data : data.filter(s => s.estado === filtro)

  return (
    <>
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['TODAS', 'PENDIENTE', 'APROBADA', 'RECHAZADA'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filtro === f ? 'bg-green-600 text-white border-green-600' : 'border-input text-muted-foreground hover:bg-muted'}`}
          >
            {f === 'TODAS' ? 'Todas' : f.charAt(0) + f.slice(1).toLowerCase()}
            {f !== 'TODAS' && <span className="ml-1 opacity-70">({data.filter(s => s.estado === f).length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Sin solicitudes</p>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empleado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Período</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Días</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-right px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.employee.apellido}, {s.employee.nombre}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.tipoAusencia.color }} />
                      {s.tipoAusencia.nombre}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                    {fmt(s.fechaInicio)} – {fmt(s.fechaFin)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{s.dias}</td>
                  <td className="px-4 py-3">{ESTADO_BADGE[s.estado]}</td>
                  <td className="px-4 py-3 text-right">
                    {s.estado === 'PENDIENTE' && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setReviewing(s); setComentario('') }}>
                        Revisar
                      </Button>
                    )}
                    {s.estado !== 'PENDIENTE' && s.comentarioAdmin && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setReviewing(s); setComentario(s.comentarioAdmin ?? '') }}>
                        Ver
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!reviewing} onOpenChange={v => !v && setReviewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewing?.estado === 'PENDIENTE' ? 'Revisar solicitud' : 'Detalle de solicitud'}
            </DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-muted-foreground text-xs">Empleado</p><p className="font-medium">{reviewing.employee.apellido}, {reviewing.employee.nombre}</p></div>
                <div><p className="text-muted-foreground text-xs">Tipo</p><p className="font-medium">{reviewing.tipoAusencia.nombre}</p></div>
                <div><p className="text-muted-foreground text-xs">Desde</p><p>{fmt(reviewing.fechaInicio)}</p></div>
                <div><p className="text-muted-foreground text-xs">Hasta</p><p>{fmt(reviewing.fechaFin)}</p></div>
                <div><p className="text-muted-foreground text-xs">Días hábiles</p><p>{reviewing.dias}</p></div>
                <div><p className="text-muted-foreground text-xs">Solicitado</p><p>{fmt(reviewing.createdAt)}</p></div>
              </div>
              {reviewing.motivo && (
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Motivo</p>
                  <p>{reviewing.motivo}</p>
                </div>
              )}
              {reviewing.archivoUrl && (
                <a
                  href={reviewing.archivoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  Ver adjunto
                </a>
              )}
              {reviewing.estado === 'PENDIENTE' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Comentario (opcional)</label>
                  <Input
                    className="mt-1"
                    value={comentario}
                    onChange={e => setComentario(e.target.value)}
                    placeholder="Ej: aprobado para la semana del 14/7"
                  />
                </div>
              )}
              {reviewing.estado !== 'PENDIENTE' && reviewing.comentarioAdmin && (
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Comentario admin</p>
                  <p>{reviewing.comentarioAdmin}</p>
                </div>
              )}
            </div>
          )}
          {reviewing?.estado === 'PENDIENTE' && (
            <DialogFooter className="gap-2">
              <Button variant="destructive" size="sm" disabled={saving} onClick={() => resolver('RECHAZADA')}>
                <XCircle size={14} className="mr-1" /> Rechazar
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" size="sm" disabled={saving} onClick={() => resolver('APROBADA')}>
                <CheckCircle2 size={14} className="mr-1" /> Aprobar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Tab Saldos ───────────────────────────────────────────────────────────────
function TabSaldos() {
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
    await fetch('/api/ausencias/saldos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: editing.id, anio: new Date().getFullYear(), diasTotales: Number(dias) }),
    })
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
function TabTipos() {
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
    if (!res.ok) { toast.error('Error al guardar'); return }
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
    if (!res.ok) { const e = await res.json(); toast.error(e.error ?? 'Error al guardar'); return }
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
    if (!res.ok) { toast.error('No se puede eliminar — tiene solicitudes asociadas'); setDeleteTarget(null); return }
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
              <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
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
                <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditTarget(t); setEditForm({ nombre: t.nombre, color: t.color, requiereAprobacion: t.requiereAprobacion, afectaSaldo: t.afectaSaldo }) }}>
                    <Pencil size={13} />
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => setDeleteTarget(t)}>
                    <Trash2 size={13} />
                  </Button>
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
              <label className="text-sm">Afecta saldo de vacaciones</label>
              <input type="checkbox" checked={editForm.afectaSaldo} onChange={e => setEditForm(f => ({ ...f, afectaSaldo: e.target.checked }))} />
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

// ── Main export ──────────────────────────────────────────────────────────────
export function AusenciasAdmin() {
  const [tab, setTab] = useState<'solicitudes' | 'saldos' | 'tipos'>('solicitudes')

  const tabs = [
    { key: 'solicitudes', label: 'Solicitudes' },
    { key: 'saldos', label: 'Saldos de vacaciones' },
    { key: 'tipos', label: 'Tipos' },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'solicitudes' && <TabSolicitudes />}
      {tab === 'saldos' && <TabSaldos />}
      {tab === 'tipos' && <TabTipos />}
    </div>
  )
}
