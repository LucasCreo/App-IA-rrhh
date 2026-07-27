'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Upload, Paperclip, FileText, CalendarOff, Plus, CheckCircle2, XCircle, Clock, Search } from 'lucide-react'
import { handleApiError } from '@/lib/apiErrors'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'

interface CampoSolicitud { nombre: string; label: string; tipo: 'texto' | 'numero' | 'fecha'; requerido: boolean }
interface TipoSolicitud { id: number; nombre: string; descripcion?: string; requiereAprobacion: boolean; campos: CampoSolicitud[] }
interface TipoAusencia { id: number; nombre: string; color: string; requiereAprobacion: boolean; activo: boolean; afectaSaldo: boolean }

interface SolicitudDoc {
  id: number; nombreArchivo?: string; estado: string
  descripcion?: string; comentario?: string; comentarioVisible: boolean
  metadata?: string; createdAt: string; tipo: TipoSolicitud
}
interface SolicitudAusencia {
  id: number; estado: string; dias: number; motivo?: string; comentarioAdmin?: string; archivoUrl?: string
  fechaInicio: string; fechaFin: string; createdAt: string
  tipoAusencia: { nombre: string; color: string }
}
interface Saldo { diasTotales: number; diasUsados: number }

type ItemBase = { key: string; fecha: string; estado: string; pendiente: boolean }
type ItemDoc = ItemBase & { kind: 'doc'; data: SolicitudDoc }
type ItemAus = ItemBase & { kind: 'ausencia'; data: SolicitudAusencia }
type Item = ItemDoc | ItemAus

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'ausencias', label: 'Ausencias' },
  { value: 'pendientes', label: 'Pendientes' },
] as const
type Filtro = typeof FILTROS[number]['value']

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

const ESTADO_AUS: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  PENDIENTE: { icon: <Clock size={11} />, className: 'text-yellow-600 border-yellow-400', label: 'Pendiente' },
  APROBADA: { icon: <CheckCircle2 size={11} />, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Aprobada' },
  RECHAZADA: { icon: <XCircle size={11} />, className: 'text-red-500 border-red-400', label: 'Rechazada' },
}

export function MisSolicitudes() {
  const router = useRouter()
  const [docs, setDocs] = useState<SolicitudDoc[]>([])
  const [ausencias, setAusencias] = useState<SolicitudAusencia[]>([])
  const [saldo, setSaldo] = useState<Saldo | null>(null)
  const [tiposSol, setTiposSol] = useState<TipoSolicitud[]>([])
  const [tiposAus, setTiposAus] = useState<TipoAusencia[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'' | 'pendiente' | 'aprobada' | 'rechazada'>('')
  const [detalle, setDetalle] = useState<Item | null>(null)

  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [tipoSel, setTipoSel] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const [descripcion, setDescripcion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [campoValues, setCampoValues] = useState<Record<string, string>>({})
  const [ausForm, setAusForm] = useState({ fechaInicio: '', fechaFin: '', motivo: '' })
  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/solicitudes').then(r => r.json()).catch(() => []),
      fetch('/api/empleado/ausencias').then(r => r.json()).catch(() => ({ solicitudes: [], saldo: null })),
    ]).then(([d, a]) => {
      setDocs(Array.isArray(d) ? d : [])
      setAusencias(a?.solicitudes ?? [])
      setSaldo(a?.saldo ?? null)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/solicitudes/tipos').then(r => r.json()).then(t => setTiposSol(Array.isArray(t) ? t : [])).catch(() => {})
    fetch('/api/ausencias/tipos').then(r => r.json()).then(t => setTiposAus(Array.isArray(t) ? t.filter((x: TipoAusencia) => x.activo) : [])).catch(() => {})
    load()
    // Marca las solicitudes como vistas para limpiar el badge del sidebar
    fetch('/api/badges/solicitudes-seen', { method: 'POST' }).catch(() => {})
  }, [])

  const parsed = (() => {
    if (!tipoSel) return null
    const [kind, id] = tipoSel.split(':')
    if (kind === 'doc') return { kind: 'doc' as const, tipo: tiposSol.find(t => String(t.id) === id) }
    if (kind === 'aus') return { kind: 'ausencia' as const, tipo: tiposAus.find(t => String(t.id) === id) }
    return null
  })()

  useEffect(() => {
    setCampoValues({})
    setAusForm({ fechaInicio: '', fechaFin: '', motivo: '' })
    setDescripcion('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    if (parsed?.kind === 'doc' && parsed.tipo) {
      const d: Record<string, string> = {}
      for (const c of parsed.tipo.campos) d[c.nombre] = ''
      setCampoValues(d)
    }
  }, [tipoSel]) // eslint-disable-line react-hooks/exhaustive-deps

  const items: Item[] = [
    ...docs.map<ItemDoc>(d => ({ kind: 'doc', key: `d-${d.id}`, fecha: d.createdAt, estado: d.estado, pendiente: d.estado === 'PENDIENTE', data: d })),
    ...ausencias.map<ItemAus>(a => ({ kind: 'ausencia', key: `a-${a.id}`, fecha: a.createdAt, estado: a.estado, pendiente: a.estado === 'PENDIENTE', data: a })),
  ]

  function estadoMatch(estado: string, target: typeof estadoFiltro): boolean {
    if (!target) return true
    if (target === 'pendiente') return estado === 'PENDIENTE'
    if (target === 'aprobada') return estado === 'APROBADO' || estado === 'APROBADA'
    if (target === 'rechazada') return estado === 'RECHAZADO' || estado === 'RECHAZADA'
    return true
  }

  const q = busqueda.trim().toLowerCase()

  const filtered = items.filter(i => {
    if (filtro === 'documentos' && i.kind !== 'doc') return false
    if (filtro === 'ausencias' && i.kind !== 'ausencia') return false
    if (filtro === 'pendientes' && !i.pendiente) return false
    if (!estadoMatch(i.estado, estadoFiltro)) return false
    if (q) {
      const nombre = i.kind === 'doc' ? i.data.tipo.nombre : i.data.tipoAusencia.nombre
      const desc = i.kind === 'doc' ? (i.data.descripcion ?? '') : (i.data.motivo ?? '')
      if (!nombre.toLowerCase().includes(q) && !desc.toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    if (a.pendiente !== b.pendiente) return a.pendiente ? -1 : 1
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  })

  const counts = {
    todos: items.length,
    documentos: items.filter(i => i.kind === 'doc').length,
    ausencias: items.filter(i => i.kind === 'ausencia').length,
    pendientes: items.filter(i => i.pendiente).length,
  }

  async function enviarDoc() {
    if (parsed?.kind !== 'doc' || !parsed.tipo) return
    const camposValidos = parsed.tipo.campos.every(c => !c.requerido || campoValues[c.nombre]?.trim())
    if (!camposValidos) { toast.error('Completá los campos requeridos'); return }
    setSaving(true)
    try {
      let fileName: string | null = null
      if (file) {
        const fd = new FormData(); fd.append('file', file)
        const up = await fetch('/api/solicitudes/archivo', { method: 'POST', body: fd })
        if (!up.ok) { toast.error('Error al subir el archivo'); return }
        fileName = (await up.json()).fileName
      }
      const metadata: Record<string, string> = {}
      for (const c of parsed.tipo.campos) {
        const v = campoValues[c.nombre]?.trim()
        if (v) metadata[c.nombre] = v
      }
      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoId: parsed.tipo.id,
          nombreArchivo: fileName,
          descripcion,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }),
      })
      if (!res.ok) { toast.error('Error al enviar'); return }
      toast.success('Solicitud enviada')
      setNuevaOpen(false); setTipoSel('')
      load()
    } finally { setSaving(false) }
  }

  async function enviarAusencia() {
    if (parsed?.kind !== 'ausencia' || !parsed.tipo) return
    if (!ausForm.fechaInicio || !ausForm.fechaFin) { toast.error('Completá las fechas'); return }
    setSaving(true)
    const fd = new FormData()
    fd.append('tipoAusenciaId', String(parsed.tipo.id))
    fd.append('fechaInicio', ausForm.fechaInicio)
    fd.append('fechaFin', ausForm.fechaFin)
    if (ausForm.motivo) fd.append('motivo', ausForm.motivo)
    if (file) fd.append('archivo', file)
    const res = await fetch('/api/empleado/ausencias', { method: 'POST', body: fd })
    setSaving(false)
    if (!res.ok) { await handleApiError(res, href => router.push(href)); return }
    toast.success('Solicitud enviada')
    setNuevaOpen(false); setTipoSel('')
    load()
  }

  const restantes = saldo ? saldo.diasTotales - saldo.diasUsados : null

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

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                filtro === f.value
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {f.label}
              <span className="opacity-60">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => setNuevaOpen(true)}>
          <Plus size={14} className="mr-1" /> Nueva solicitud
        </Button>
      </div>

      {filtro === 'todos' && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Buscar por tipo o descripción…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <select
            value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value as typeof estadoFiltro)}
            className="h-8 text-xs px-2 rounded-md border border-input bg-background text-foreground"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <FileText size={32} strokeWidth={1.2} />
          <p className="text-sm">Sin resultados</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {filtered.map(item => (
            <div key={item.key} className="flex items-start gap-3 px-4 py-3 bg-card">
              {item.kind === 'doc'
                ? <FileText size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                : <CalendarOff size={16} className="text-blue-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {item.kind === 'doc' ? item.data.tipo.nombre : item.data.tipoAusencia.nombre}
                </p>
                {item.kind === 'ausencia' && (
                  <p className="text-xs text-muted-foreground">{fmt(item.data.fechaInicio)} – {fmt(item.data.fechaFin)} · {item.data.dias} día{item.data.dias !== 1 ? 's' : ''}</p>
                )}
                {item.kind === 'doc' && item.data.descripcion && (
                  <p className="text-xs text-muted-foreground truncate">{item.data.descripcion}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {item.kind === 'doc'
                  ? <StatusBadge estado={item.estado} />
                  : (
                    <Badge variant="outline" className={cn('gap-1', ESTADO_AUS[item.estado]?.className)}>
                      {ESTADO_AUS[item.estado]?.icon} {ESTADO_AUS[item.estado]?.label ?? item.estado}
                    </Badge>
                  )}
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setDetalle(item)}>
                  Ver
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nueva solicitud */}
      <Dialog open={nuevaOpen} onOpenChange={v => { if (!v) { setNuevaOpen(false); setTipoSel('') } }}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0"><DialogTitle>Nueva solicitud</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {tiposAus.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                  <CalendarOff size={11} /> Ausencias
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {tiposAus.map(t => {
                    const val = `aus:${t.id}`
                    const sel = tipoSel === val
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTipoSel(val)}
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
            )}
            {tiposSol.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText size={11} /> Documentos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {tiposSol.map(t => {
                    const val = `doc:${t.id}`
                    const sel = tipoSel === val
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTipoSel(val)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors',
                          sel
                            ? 'border-green-600 bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 font-medium'
                            : 'border-border hover:border-green-400 hover:bg-muted/50'
                        )}
                      >
                        <FileText size={13} className="shrink-0 text-muted-foreground" />
                        <span className="truncate">{t.nombre}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {parsed?.kind === 'doc' && parsed.tipo && (
              <>
                {parsed.tipo.descripcion && <p className="text-xs text-muted-foreground">{parsed.tipo.descripcion}</p>}
                {parsed.tipo.campos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {parsed.tipo.campos.map(c => (
                      <div key={c.nombre}>
                        <p className="text-xs text-muted-foreground mb-1">
                          {c.label}{c.requerido && <span className="text-destructive ml-0.5">*</span>}
                        </p>
                        <Input
                          type={c.tipo === 'numero' ? 'number' : c.tipo === 'fecha' ? 'date' : 'text'}
                          value={campoValues[c.nombre] ?? ''}
                          onChange={e => setCampoValues(prev => ({ ...prev, [c.nombre]: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 font-normal"
                    onClick={() => fileRef.current?.click()}
                  >
                    {file
                      ? <><Paperclip size={14} className="shrink-0" /><span className="truncate text-sm">{file.name}</span></>
                      : <><Upload size={14} className="shrink-0 text-muted-foreground" /><span className="text-muted-foreground">Adjuntar archivo (opcional)…</span></>}
                  </Button>
                </div>
                <Textarea
                  placeholder="Descripción (opcional)"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </>
            )}

            {parsed?.kind === 'ausencia' && parsed.tipo && (
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
                  if (!parsed.tipo.afectaSaldo || !saldo) return null
                  const solicitados = diasHabiles(ausForm.fechaInicio, ausForm.fechaFin)
                  if (solicitados === 0) return null
                  const restantes = saldo.diasTotales - saldo.diasUsados
                  if (solicitados <= restantes) {
                    return <p className="text-xs text-muted-foreground">{solicitados} día{solicitados !== 1 ? 's' : ''} hábiles · te quedarían {restantes - solicitados}</p>
                  }
                  return (
                    <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                      Estás solicitando {solicitados} días hábiles pero solo te quedan {restantes}. Podés enviar la solicitud igual; queda a criterio del administrador aprobarla.
                    </div>
                  )
                })()}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Motivo (opcional)</p>
                  <Input value={ausForm.motivo} onChange={e => setAusForm(f => ({ ...f, motivo: e.target.value }))} className="h-8 text-sm" placeholder="Ej: vacaciones familiares" />
                </div>
                <div>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 font-normal"
                    onClick={() => fileRef.current?.click()}
                  >
                    {file
                      ? <><Paperclip size={14} className="shrink-0" /><span className="truncate text-sm">{file.name}</span></>
                      : <><Upload size={14} className="shrink-0 text-muted-foreground" /><span className="text-muted-foreground">Adjuntar archivo (opcional)…</span></>}
                  </Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => { setNuevaOpen(false); setTipoSel('') }}>Cancelar</Button>
            <Button
              className="bg-green-700 hover:bg-green-800"
              disabled={!parsed || saving}
              onClick={() => parsed?.kind === 'doc' ? enviarDoc() : enviarAusencia()}
            >
              {saving ? 'Enviando…' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle */}
      <Dialog open={detalle !== null} onOpenChange={v => !v && setDetalle(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {detalle?.kind === 'doc' ? detalle.data.tipo.nombre : detalle?.kind === 'ausencia' ? detalle.data.tipoAusencia.nombre : ''}
            </DialogTitle>
          </DialogHeader>
          {detalle?.kind === 'ausencia' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{fmt(detalle.data.fechaInicio)} – {fmt(detalle.data.fechaFin)} · {detalle.data.dias} día{detalle.data.dias !== 1 ? 's' : ''}</p>
              {detalle.data.motivo && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground mb-0.5">Tu motivo</p>
                  <p>{detalle.data.motivo}</p>
                </div>
              )}
              {detalle.data.comentarioAdmin && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground mb-0.5">Comentario de RRHH</p>
                  <p>{detalle.data.comentarioAdmin}</p>
                </div>
              )}
              {detalle.data.archivoUrl && (
                <button
                  onClick={() => setPreview({ url: detalle.data.archivoUrl!, filename: detalle.data.archivoUrl!.split('/').pop() ?? undefined })}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <Paperclip size={13} /> Ver adjunto
                </button>
              )}
            </div>
          )}
          {detalle?.kind === 'doc' && (() => {
            const s = detalle.data
            const meta = (() => { try { return JSON.parse(s.metadata ?? '{}') as Record<string, string> } catch { return {} } })()
            const metaEntries = Object.entries(meta).filter(([, v]) => v)
            return (
              <div className="space-y-2">
                {s.nombreArchivo && (
                  <button
                    onClick={() => setPreview({ url: `/api/solicitudes/archivo?file=${s.nombreArchivo}`, filename: s.nombreArchivo })}
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                  >
                    <Paperclip size={13} /> {s.nombreArchivo.replace(/^\d+-/, '')}
                  </button>
                )}
                {metaEntries.length > 0 && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                    {metaEntries.map(([k, v]) => {
                      const campo = s.tipo.campos?.find(c => c.nombre === k)
                      return (
                        <div key={k} className="text-xs">
                          <span className="text-muted-foreground">{campo?.label ?? k}: </span>
                          <span>{v}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {s.descripcion && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground mb-0.5">Descripción</p>
                    <p>{s.descripcion}</p>
                  </div>
                )}
                {s.comentario && s.comentarioVisible && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground mb-0.5">Comentario de RRHH</p>
                    <p>{s.comentario}</p>
                  </div>
                )}
              </div>
            )
          })()}
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
