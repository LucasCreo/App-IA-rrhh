'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination, paginate } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Upload, Paperclip, FileText, ClipboardList, Plus, CheckCircle2, XCircle, Circle, Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'
import { FormularioDialog, FormularioRespuesta } from '@/components/empleado/FormularioDialog'

interface CampoSolicitud {
  nombre: string
  label: string
  tipo: 'texto' | 'numero' | 'fecha' | 'seleccion' | 'archivo' | 'booleano'
  opciones?: string
  requerido: boolean
}
interface TipoSolicitud { id: number; nombre: string; descripcion?: string; requiereAprobacion: boolean; campos: CampoSolicitud[] }

interface SolicitudDoc {
  id: number; nombreArchivo?: string; estado: string
  descripcion?: string; comentario?: string; comentarioVisible: boolean
  metadata?: string; createdAt: string; tipo: TipoSolicitud
}

type ItemBase = { key: string; fecha: string; estado: string; pendiente: boolean }
type ItemDoc = ItemBase & { kind: 'doc'; data: SolicitudDoc }
type ItemForm = ItemBase & { kind: 'form'; data: FormularioRespuesta }
type Item = ItemDoc | ItemForm

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'formularios', label: 'Formularios' },
  { value: 'pendientes', label: 'Pendientes' },
] as const
type Filtro = typeof FILTROS[number]['value']

export type MisSolicitudesVista = 'todo' | 'enviadas' | 'recibidas'

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

export function MisSolicitudes({ vista = 'todo' }: { vista?: MisSolicitudesVista } = {}) {
  const searchParams = useSearchParams()
  const initialTab = ((): Filtro => {
    const t = searchParams.get('tab')
    return FILTROS.some(f => f.value === t) ? (t as Filtro) : 'todos'
  })()
  const [docs, setDocs] = useState<SolicitudDoc[]>([])
  const [forms, setForms] = useState<FormularioRespuesta[]>([])
  const [editForm, setEditForm] = useState<FormularioRespuesta | null>(null)
  const [viewForm, setViewForm] = useState<FormularioRespuesta | null>(null)
  const [tiposSol, setTiposSol] = useState<TipoSolicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>(initialTab)
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'' | 'pendiente' | 'aprobada' | 'rechazada'>('')
  const [detalle, setDetalle] = useState<Item | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => { setPage(1) }, [filtro, busqueda, estadoFiltro, vista])

  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [tipoSel, setTipoSel] = useState<TipoSolicitud | null>(null)
  const [saving, setSaving] = useState(false)

  const [descripcion, setDescripcion] = useState('')
  const [campoValues, setCampoValues] = useState<Record<string, string>>({})
  const [uploadingCampo, setUploadingCampo] = useState<string | null>(null)
  const [pendingCampo, setPendingCampo] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; filename?: string } | null>(null)
  const campoFileRef = useRef<HTMLInputElement>(null)

  const _router = useRouter()

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/solicitudes').then(r => r.json()).catch(() => []),
      fetch('/api/empleado/formularios').then(r => r.json()).catch(() => []),
    ]).then(([d, f]) => {
      setDocs(Array.isArray(d) ? d : [])
      setForms(Array.isArray(f) ? f : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/solicitudes/tipos').then(r => r.json()).then(t => setTiposSol(Array.isArray(t) ? t : [])).catch(() => {})
    load()
    fetch('/api/badges/solicitudes-seen', { method: 'POST' }).catch(() => {})
  }, [])

  useEffect(() => {
    setCampoValues({})
    setDescripcion('')
    if (tipoSel) {
      const d: Record<string, string> = {}
      for (const c of tipoSel.campos) d[c.nombre] = ''
      setCampoValues(d)
    }
  }, [tipoSel])

  const items: Item[] = [
    ...docs.map<ItemDoc>(d => ({ kind: 'doc', key: `d-${d.id}`, fecha: d.createdAt, estado: d.estado, pendiente: d.estado === 'PENDIENTE', data: d })),
    ...forms.map<ItemForm>(f => ({ kind: 'form', key: `f-${f.id}`, fecha: f.updatedAt, estado: f.estado, pendiente: f.estado === 'PENDIENTE', data: f })),
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
    if (vista === 'enviadas' && i.kind === 'form') return false
    if (vista === 'recibidas' && i.kind !== 'form') return false
    if (filtro === 'documentos' && i.kind !== 'doc') return false
    if (filtro === 'formularios' && i.kind !== 'form') return false
    if (filtro === 'pendientes' && !i.pendiente) return false
    if (!estadoMatch(i.estado, estadoFiltro)) return false
    if (q) {
      const nombre =
        i.kind === 'doc' ? i.data.tipo.nombre
        : `${i.data.asignacion.nombre} ${i.data.asignacion.plantilla.nombre}`
      const desc = i.kind === 'doc' ? (i.data.descripcion ?? '') : ''
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
    formularios: items.filter(i => i.kind === 'form').length,
    pendientes: items.filter(i => i.pendiente).length,
  }

  async function subirArchivoCampo(campo: string, f: File) {
    setUploadingCampo(campo)
    try {
      const fd = new FormData(); fd.append('file', f)
      if (tipoSel) fd.append('tipoId', String(tipoSel.id))
      const up = await fetch('/api/solicitudes/archivo', { method: 'POST', body: fd })
      if (!up.ok) { toast.error('Error al subir el archivo'); return }
      const { fileName } = await up.json()
      setCampoValues(prev => ({ ...prev, [campo]: fileName }))
    } finally { setUploadingCampo(null) }
  }

  async function enviarDoc() {
    if (!tipoSel) return
    const camposValidos = tipoSel.campos.every(c => {
      if (!c.requerido) return true
      if (c.tipo === 'booleano') return true
      return campoValues[c.nombre]?.trim()
    })
    if (!camposValidos) { toast.error('Completá los campos requeridos'); return }
    setSaving(true)
    try {
      const metadata: Record<string, string> = {}
      for (const c of tipoSel.campos) {
        const v = campoValues[c.nombre]?.trim()
        if (v) metadata[c.nombre] = v
      }
      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoId: tipoSel.id,
          descripcion,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }),
      })
      if (!res.ok) { toast.error('Error al enviar'); return }
      toast.success('Solicitud enviada')
      setNuevaOpen(false); setTipoSel(null)
      load()
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por tipo o descripción…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={estadoFiltro || 'todos'} onValueChange={v => setEstadoFiltro(v === 'todos' ? '' : (v as typeof estadoFiltro))}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent side="bottom" alignItemWithTrigger={false}>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
          </SelectContent>
        </Select>
        {vista !== 'recibidas' && filtro !== 'formularios' && (
          <Button className="bg-green-700 hover:bg-green-800" onClick={() => setNuevaOpen(true)}>
            <Plus size={16} className="mr-1" /> Nueva solicitud
          </Button>
        )}
      </div>

      {vista === 'todo' && (
        <div className="flex gap-1 flex-wrap">
          {FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                filtro === f.value
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {f.label}
              <span className="opacity-60">{counts[f.value]}</span>
            </button>
          ))}
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
          {paginate(filtered, page, pageSize).map(item => {
            const vencido = item.kind === 'form' && item.estado === 'PENDIENTE' && !!item.data.asignacion.fechaLimite && new Date(item.data.asignacion.fechaLimite) < new Date()
            const clickable = !(item.kind === 'form' && vencido)
            const onRowClick = () => {
              if (item.kind === 'doc') setDetalle(item)
              else if (item.kind === 'form') {
                if (vencido) return
                if (item.estado === 'PENDIENTE') setEditForm(item.data)
                else setViewForm(item.data)
              }
            }
            return (
            <div
              key={item.key}
              className={cn(
                'flex items-start gap-3 px-4 py-3 bg-card transition-colors',
                clickable && 'cursor-pointer hover:bg-muted/50'
              )}
              onClick={clickable ? onRowClick : undefined}
            >
              {item.kind === 'doc' && <FileText size={16} className="text-muted-foreground shrink-0 mt-0.5" />}
              {item.kind === 'form' && <ClipboardList size={16} className="text-blue-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {item.kind === 'doc' && item.data.tipo.nombre}
                  {item.kind === 'form' && item.data.asignacion.nombre}
                </p>
                {item.kind === 'doc' && item.data.descripcion && (
                  <p className="text-xs text-muted-foreground truncate">{item.data.descripcion}</p>
                )}
                {item.kind === 'form' && (
                  <p className="text-xs text-muted-foreground truncate">{item.data.asignacion.plantilla.nombre}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {item.kind === 'doc' && <StatusBadge estado={item.estado} />}
                {item.kind === 'form' && (() => {
                  const vencido = item.estado === 'PENDIENTE' && item.data.asignacion.fechaLimite && new Date(item.data.asignacion.fechaLimite) < new Date()
                  if (vencido) return (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                      <XCircle size={11} /> Vencido
                    </span>
                  )
                  if (item.estado === 'PENDIENTE') return (
                    <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                      <Circle size={11} /> Pendiente
                    </span>
                  )
                  return (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 size={11} /> Completado
                    </span>
                  )
                })()}
                {item.kind === 'form' ? (() => {
                  const vencido = item.estado === 'PENDIENTE' && item.data.asignacion.fechaLimite && new Date(item.data.asignacion.fechaLimite) < new Date()
                  if (vencido) return (
                    <span className="text-xs text-muted-foreground italic" title="La fecha límite venció. Contactá al admin.">
                      No se puede completar
                    </span>
                  )
                  if (item.estado === 'PENDIENTE') return (
                    <button className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline" onClick={() => setEditForm(item.data)}>
                      Completar
                    </button>
                  )
                  return (
                    <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setViewForm(item.data)}>
                      Ver
                    </button>
                  )
                })() : (
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setDetalle(item)}>
                    Ver
                  </button>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <Pagination
          page={page} pageSize={pageSize} total={filtered.length}
          itemLabel="solicitudes"
          onPageChange={setPage} onPageSizeChange={setPageSize}
        />
      )}

      {/* Nueva solicitud */}
      <Dialog open={nuevaOpen} onOpenChange={v => { if (!v) { setNuevaOpen(false); setTipoSel(null) } }}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="shrink-0"><DialogTitle>Nueva solicitud</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {tiposSol.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText size={11} /> Tipo
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {tiposSol.map(t => {
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
                        <FileText size={13} className="shrink-0 text-muted-foreground" />
                        <span className="truncate">{t.nombre}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {tipoSel && (
              <>
                {tipoSel.descripcion && <p className="text-xs text-muted-foreground">{tipoSel.descripcion}</p>}
                {tipoSel.campos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tipoSel.campos.map(c => (
                      <div key={c.nombre} className={c.tipo === 'archivo' || c.tipo === 'booleano' ? 'sm:col-span-2' : ''}>
                        <p className="text-xs text-muted-foreground mb-1">
                          {c.label}{c.requerido && <span className="text-destructive ml-0.5">*</span>}
                        </p>
                        {c.tipo === 'seleccion' ? (
                          <Select value={campoValues[c.nombre] || undefined} onValueChange={v => setCampoValues(prev => ({ ...prev, [c.nombre]: v ?? '' }))}>
                            <SelectTrigger className="w-full h-8 text-sm"><SelectValue placeholder="Seleccioná una opción" /></SelectTrigger>
                            <SelectContent side="bottom" alignItemWithTrigger={false}>
                              {(c.opciones ?? '').split(',').map(o => o.trim()).filter(Boolean).map(o => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : c.tipo === 'archivo' ? (
                          <div className="flex items-center gap-2">
                            {campoValues[c.nombre] ? (
                              <>
                                <span className="flex-1 text-sm inline-flex items-center gap-1 truncate">
                                  <Paperclip size={13} /> {campoValues[c.nombre].replace(/^[^|]*\|\|/, '').replace(/^\d+-/, '')}
                                </span>
                                <button type="button" onClick={() => setCampoValues(prev => ({ ...prev, [c.nombre]: '' }))} className="text-muted-foreground hover:text-destructive" title="Quitar">×</button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full h-8"
                                disabled={uploadingCampo === c.nombre}
                                onClick={() => { setPendingCampo(c.nombre); campoFileRef.current?.click() }}
                              >
                                <Upload size={13} className="mr-1.5" />
                                {uploadingCampo === c.nombre ? 'Subiendo…' : 'Subir archivo'}
                              </Button>
                            )}
                          </div>
                        ) : c.tipo === 'booleano' ? (
                          <label className="flex items-center gap-2 cursor-pointer select-none h-8">
                            <input
                              type="checkbox"
                              checked={campoValues[c.nombre] === 'true'}
                              onChange={e => setCampoValues(prev => ({ ...prev, [c.nombre]: e.target.checked ? 'true' : 'false' }))}
                              className="w-4 h-4 accent-green-700"
                            />
                            <span className="text-sm">Sí</span>
                          </label>
                        ) : (
                          <Input
                            type={c.tipo === 'numero' ? 'number' : c.tipo === 'fecha' ? 'date' : 'text'}
                            value={campoValues[c.nombre] ?? ''}
                            onChange={e => setCampoValues(prev => ({ ...prev, [c.nombre]: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        )}
                      </div>
                    ))}
                    <input
                      ref={campoFileRef}
                      type="file"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f && pendingCampo) subirArchivoCampo(pendingCampo, f)
                        setPendingCampo(null)
                        e.target.value = ''
                      }}
                    />
                  </div>
                )}
                <Textarea
                  placeholder="Descripción (opcional)"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4">
            <Button variant="outline" onClick={() => { setNuevaOpen(false); setTipoSel(null) }}>Cancelar</Button>
            <Button
              className="bg-green-700 hover:bg-green-800"
              disabled={!tipoSel || saving}
              onClick={enviarDoc}
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
              {detalle?.kind === 'doc' ? detalle.data.tipo.nombre : ''}
            </DialogTitle>
          </DialogHeader>
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
                    <Paperclip size={13} /> {s.nombreArchivo.replace(/^[^|]*\|\|/, '').replace(/^\d+-/, '')}
                  </button>
                )}
                {metaEntries.length > 0 && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                    {metaEntries.map(([k, v]) => {
                      const campo = s.tipo.campos?.find(c => c.nombre === k)
                      return (
                        <div key={k} className="text-xs">
                          <span className="text-muted-foreground">{campo?.label ?? k}: </span>
                          {campo?.tipo === 'archivo' ? (
                            <button
                              onClick={() => setPreview({ url: `/api/solicitudes/archivo?file=${v}`, filename: v })}
                              className="text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1"
                            >
                              <Paperclip size={11} /> {v.replace(/^[^|]*\|\|/, '').replace(/^\d+-/, '')}
                            </button>
                          ) : campo?.tipo === 'booleano' ? (
                            <span>{v === 'true' ? 'Sí' : 'No'}</span>
                          ) : (
                            <span>{v}</span>
                          )}
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
                <p className="text-[10px] text-muted-foreground mt-2">Solicitado el {fmt(s.createdAt)}</p>
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

      <FormularioDialog
        respuesta={editForm}
        mode="fill"
        onClose={() => setEditForm(null)}
        onSaved={load}
      />
      <FormularioDialog
        respuesta={viewForm}
        mode="view"
        onClose={() => setViewForm(null)}
      />
    </div>
  )
}
