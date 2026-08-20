'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { handleApiError } from '@/lib/apiErrors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'
import Link from 'next/link'
import { Calendar, CalendarOff, CheckCircle2, Clock, Paperclip, Plus, Search, Upload, XCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { displayNameFromArchivoUrl } from '@/lib/aditusSolicitudes'

interface TipoAusencia { id: number; nombre: string; color: string; requiereAprobacion: boolean; activo: boolean; afectaSaldo: boolean }
interface SolicitudAusencia {
  id: number; estado: string; dias: number; motivo?: string; comentarioAdmin?: string; archivoUrl?: string
  fechaInicio: string; fechaFin: string; createdAt: string
  tipoAusencia: { nombre: string; color: string }
}
interface Saldo { diasTotales: number; diasUsados: number }

const ESTADO_META: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  PENDIENTE: { icon: <Clock size={11} />, className: 'text-yellow-600 border-yellow-400', label: 'Pendiente' },
  APROBADA: { icon: <CheckCircle2 size={11} />, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Aprobada' },
  RECHAZADA: { icon: <XCircle size={11} />, className: 'text-red-500 border-red-400', label: 'Rechazada' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function diasHabiles(desde: string, hasta: string): number {
  if (!desde || !hasta) return 0
  const [yA, mA, dA] = desde.split('-').map(Number)
  const [yB, mB, dB] = hasta.split('-').map(Number)
  const a = new Date(yA, mA - 1, dA)
  const b = new Date(yB, mB - 1, dB)
  if (b < a) return 0
  let n = 0
  const cur = new Date(a)
  while (cur <= b) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) n++
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

export function MisLicencias() {
  const router = useRouter()
  const [ausencias, setAusencias] = useState<SolicitudAusencia[]>([])
  const [saldo, setSaldo] = useState<Saldo | null>(null)
  const [tiposAus, setTiposAus] = useState<TipoAusencia[]>([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState<SolicitudAusencia | null>(null)

  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [tipoSel, setTipoSel] = useState<TipoAusencia | null>(null)
  const [ausForm, setAusForm] = useState({ fechaInicio: '', fechaFin: '', motivo: '' })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'>('todos')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/empleado/ausencias')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(a => {
        setAusencias(a?.solicitudes ?? [])
        setSaldo(a?.saldo ?? null)
      })
      .catch(() => toast.error('No se pudieron cargar las licencias'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/ausencias/tipos').then(r => r.json()).then(t => setTiposAus(Array.isArray(t) ? t.filter((x: TipoAusencia) => x.activo) : [])).catch(() => {})
    load()
  }, [load])

  useEffect(() => {
    setAusForm({ fechaInicio: '', fechaFin: '', motivo: '' })
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [tipoSel])

  async function enviar() {
    if (!tipoSel) return
    if (!ausForm.fechaInicio || !ausForm.fechaFin) { toast.error('Completá las fechas'); return }
    setSaving(true)
    const fd = new FormData()
    fd.append('tipoAusenciaId', String(tipoSel.id))
    fd.append('fechaInicio', ausForm.fechaInicio)
    fd.append('fechaFin', ausForm.fechaFin)
    if (ausForm.motivo) fd.append('motivo', ausForm.motivo)
    if (file) fd.append('archivo', file)
    const res = await fetch('/api/empleado/ausencias', { method: 'POST', body: fd })
    setSaving(false)
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success('Solicitud enviada')
    setNuevaOpen(false); setTipoSel(null)
    load()
  }

  const restantes = saldo ? saldo.diasTotales - saldo.diasUsados : null
  const q = busqueda.trim().toLowerCase()
  const filtradas = ausencias.filter(s => {
    if (estadoFiltro !== 'todos' && s.estado !== estadoFiltro) return false
    if (q) {
      const hay = `${s.tipoAusencia.nombre} ${s.motivo ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const sorted = [...filtradas].sort((a, b) => {
    const aP = a.estado === 'PENDIENTE' ? 0 : 1
    const bP = b.estado === 'PENDIENTE' ? 0 : 1
    if (aP !== bP) return aP - bP
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  const counts = {
    todos: ausencias.length,
    PENDIENTE: ausencias.filter(a => a.estado === 'PENDIENTE').length,
    APROBADA: ausencias.filter(a => a.estado === 'APROBADA').length,
    RECHAZADA: ausencias.filter(a => a.estado === 'RECHAZADA').length,
  }
  const chips: { key: typeof estadoFiltro; label: string }[] = [
    { key: 'todos', label: 'Todas' },
    { key: 'PENDIENTE', label: 'Pendientes' },
    { key: 'APROBADA', label: 'Aprobadas' },
    { key: 'RECHAZADA', label: 'Rechazadas' },
  ]

  return (
    <div className="space-y-4">
      {saldo && (
        <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 p-4 flex items-center gap-6">
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por tipo o motivo…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={estadoFiltro} onValueChange={v => v && setEstadoFiltro(v as typeof estadoFiltro)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent side="bottom" alignItemWithTrigger={false}>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
            <SelectItem value="APROBADA">Aprobada</SelectItem>
            <SelectItem value="RECHAZADA">Rechazada</SelectItem>
          </SelectContent>
        </Select>
        <Button className="bg-green-700 hover:bg-green-800" onClick={() => setNuevaOpen(true)}>
          <Plus size={16} className="mr-1" /> Nueva licencia
        </Button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => setEstadoFiltro(c.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
              estadoFiltro === c.key
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {c.label}
            <span className="opacity-60">{counts[c.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <CalendarOff size={32} strokeWidth={1.2} />
          <p className="text-sm">Sin licencias registradas</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {sorted.map(s => {
            const meta = ESTADO_META[s.estado]
            return (
              <div key={s.id} className="flex items-start gap-3 px-4 py-3 bg-card">
                <CalendarOff size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{s.tipoAusencia.nombre}</span>
                    <span className="h-2 w-2 rounded-full" style={{ background: s.tipoAusencia.color }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmt(s.fechaInicio)} – {fmt(s.fechaFin)} · {s.dias} día{s.dias !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {meta && (
                    <Badge variant="outline" className={cn('gap-1', meta.className)}>
                      {meta.icon} {meta.label}
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    {s.estado === 'APROBADA' && (
                      <Link
                        href={`/empleado/calendario?range=${s.fechaInicio.slice(0, 10)}:${s.fechaFin.slice(0, 10)}`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        title="Ver en el calendario"
                      >
                        <Calendar size={12} /> Calendario
                      </Link>
                    )}
                    <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setDetalle(s)}>Ver</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Nueva licencia */}
      <Dialog open={nuevaOpen} onOpenChange={v => { if (!v) { setNuevaOpen(false); setTipoSel(null) } }}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0"><DialogTitle>Nueva licencia</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                <CalendarOff size={11} /> Tipo
              </p>
              <div className="grid grid-cols-2 gap-2">
                {tiposAus.map(t => {
                  const sel = tipoSel?.id === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTipoSel(t)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors',
                        sel
                          ? 'border-green-600 bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 font-medium'
                          : 'border-border hover:border-green-400 hover:bg-muted/50'
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      <span className="truncate">{t.nombre}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {tipoSel && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fecha inicio *</p>
                    <Input type="date" value={ausForm.fechaInicio} onChange={e => setAusForm(f => ({ ...f, fechaInicio: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Fecha fin *</p>
                    <Input type="date" value={ausForm.fechaFin} onChange={e => setAusForm(f => ({ ...f, fechaFin: e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
                {(() => {
                  if (!tipoSel.afectaSaldo || !saldo) return null
                  const solicitados = diasHabiles(ausForm.fechaInicio, ausForm.fechaFin)
                  if (solicitados === 0) return null
                  const rest = saldo.diasTotales - saldo.diasUsados
                  if (solicitados <= rest) {
                    return <p className="text-xs text-muted-foreground">{solicitados} día{solicitados !== 1 ? 's' : ''} hábiles · te quedarían {rest - solicitados}</p>
                  }
                  return (
                    <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                      Estás solicitando {solicitados} días hábiles pero solo te quedan {rest}. Podés enviar la solicitud igual; queda a criterio del administrador aprobarla.
                    </div>
                  )
                })()}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Motivo (opcional)</p>
                  <Input value={ausForm.motivo} onChange={e => setAusForm(f => ({ ...f, motivo: e.target.value }))} className="h-8 text-sm" placeholder="Ej: vacaciones familiares" />
                </div>
                <div>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  <Button variant="outline" className="w-full justify-start gap-2 font-normal" onClick={() => fileRef.current?.click()}>
                    {file
                      ? <><Paperclip size={14} className="shrink-0" /><span className="truncate text-sm">{file.name}</span></>
                      : <><Upload size={14} className="shrink-0 text-muted-foreground" /><span className="text-muted-foreground">Adjuntar archivo (opcional)…</span></>}
                  </Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => { setNuevaOpen(false); setTipoSel(null) }}>Cancelar</Button>
            <Button className="bg-green-700 hover:bg-green-800" disabled={!tipoSel || saving} onClick={enviar}>
              {saving ? 'Enviando…' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle */}
      <Dialog open={detalle !== null} onOpenChange={v => !v && setDetalle(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{detalle?.tipoAusencia.nombre}</DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{fmt(detalle.fechaInicio)} – {fmt(detalle.fechaFin)} · {detalle.dias} día{detalle.dias !== 1 ? 's' : ''}</p>
              {detalle.motivo && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground mb-0.5">Tu motivo</p>
                  <p>{detalle.motivo}</p>
                </div>
              )}
              {detalle.comentarioAdmin && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground mb-0.5">Comentario de RRHH</p>
                  <p>{detalle.comentarioAdmin}</p>
                </div>
              )}
              {detalle.archivoUrl && (
                <button
                  onClick={() => setPreview({ url: detalle.archivoUrl!, filename: displayNameFromArchivoUrl(detalle.archivoUrl) || undefined })}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <Paperclip size={13} /> Ver adjunto
                </button>
              )}
            </div>
          )}
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
