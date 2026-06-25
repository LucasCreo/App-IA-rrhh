'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CheckCircle2, XCircle, Clock, Plus } from 'lucide-react'

interface TipoAusencia { id: number; nombre: string; color: string; requiereAprobacion: boolean; activo: boolean }
interface Solicitud {
  id: number; estado: string; dias: number; motivo?: string; comentarioAdmin?: string; archivoUrl?: string
  fechaInicio: string; fechaFin: string; createdAt: string
  tipoAusencia: { nombre: string; color: string }
}
interface Saldo { diasTotales: number; diasUsados: number }

const ESTADO_BADGE: Record<string, React.ReactElement> = {
  PENDIENTE: <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-400"><Clock size={11} /> Pendiente</Badge>,
  APROBADA: <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 size={11} /> Aprobada</Badge>,
  RECHAZADA: <Badge variant="outline" className="gap-1 text-red-500 border-red-400"><XCircle size={11} /> Rechazada</Badge>,
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function MisAusencias() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [saldo, setSaldo] = useState<Saldo | null>(null)
  const [tipos, setTipos] = useState<TipoAusencia[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ tipoAusenciaId: '', fechaInicio: '', fechaFin: '', motivo: '' })
  const [archivo, setArchivo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Solicitud | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/empleado/ausencias').then(r => r.json()),
      fetch('/api/ausencias/tipos').then(r => r.json()),
    ]).then(([datos, ts]) => {
      setSolicitudes(datos.solicitudes)
      setSaldo(datos.saldo)
      setTipos(ts.filter((t: TipoAusencia) => t.activo))
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function enviar() {
    if (!form.tipoAusenciaId || !form.fechaInicio || !form.fechaFin) {
      toast.error('Completá los campos obligatorios'); return
    }
    setSaving(true)
    const fd = new FormData()
    fd.append('tipoAusenciaId', form.tipoAusenciaId)
    fd.append('fechaInicio', form.fechaInicio)
    fd.append('fechaFin', form.fechaFin)
    if (form.motivo) fd.append('motivo', form.motivo)
    if (archivo) fd.append('archivo', archivo)
    const res = await fetch('/api/empleado/ausencias', { method: 'POST', body: fd })
    setSaving(false)
    if (!res.ok) { const e = await res.json(); toast.error(e.error ?? 'Error'); return }
    toast.success('Solicitud enviada')
    setDialog(false)
    setForm({ tipoAusenciaId: '', fechaInicio: '', fechaFin: '', motivo: '' })
    setArchivo(null)
    load()
  }

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>

  const restantes = saldo ? saldo.diasTotales - saldo.diasUsados : null

  return (
    <>
      {/* Saldo card */}
      {saldo && (
        <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 p-4 mb-5 flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">{restantes}</p>
            <p className="text-xs text-muted-foreground mt-0.5">días restantes</p>
          </div>
          <div className="flex-1 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Días totales</span><span>{saldo.diasTotales}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Días usados</span><span>{saldo.diasUsados}</span></div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Mis solicitudes</h2>
        <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => setDialog(true)}>
          <Plus size={14} className="mr-1" /> Nueva solicitud
        </Button>
      </div>

      {solicitudes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Sin solicitudes</p>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Período</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Días</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-right px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {solicitudes.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
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
                    {(s.comentarioAdmin || s.motivo) && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelected(s)}>
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

      {/* Nueva solicitud */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva solicitud de ausencia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo *</label>
              <select
                value={form.tipoAusenciaId}
                onChange={e => setForm(f => ({ ...f, tipoAusenciaId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleccioná un tipo</option>
                {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fecha inicio *</label>
              <Input type="date" className="mt-1" value={form.fechaInicio} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fecha fin *</label>
              <Input type="date" className="mt-1" value={form.fechaFin} onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Motivo (opcional)</label>
              <Input className="mt-1" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ej: vacaciones familiares" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Adjunto (opcional)</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="mt-1 w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium cursor-pointer"
                onChange={e => setArchivo(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 w-full" disabled={saving} onClick={enviar}>
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ver detalle */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selected?.tipoAusencia.nombre}</DialogTitle>
            <p className="text-xs text-muted-foreground">{selected && fmt(selected.fechaInicio)} – {selected && fmt(selected.fechaFin)}</p>
          </DialogHeader>
          {selected?.motivo && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p className="text-xs text-muted-foreground mb-0.5">Tu motivo</p>
              <p>{selected.motivo}</p>
            </div>
          )}
          {selected?.comentarioAdmin && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p className="text-xs text-muted-foreground mb-0.5">Comentario de RRHH</p>
              <p>{selected.comentarioAdmin}</p>
            </div>
          )}
          {selected?.archivoUrl && (
            <a
              href={selected.archivoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              Ver adjunto
            </a>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
