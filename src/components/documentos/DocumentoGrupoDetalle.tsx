'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, FileText, Search, Send, Trash2, Eye, X, Users, CheckCircle2, Clock, FileX, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

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

type EstadoKey = 'FIRMADO' | 'ENVIADO_A_FIRMA' | 'BORRADOR' | 'RECHAZADO'

const ESTADO_CONFIG: Record<EstadoKey, { label: string; classes: string; Icon: React.ElementType }> = {
  FIRMADO:         { label: 'Firmado',    classes: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300', Icon: CheckCircle2 },
  ENVIADO_A_FIRMA: { label: 'Pendiente de firma', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400', Icon: Clock },
  BORRADOR:        { label: 'Borrador',   classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', Icon: FileX },
  RECHAZADO:       { label: 'Rechazado',  classes: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400', Icon: AlertCircle },
}

type Filtro = 'todos' | 'firmados' | 'enFirma' | 'borradores' | 'rechazados'

export function DocumentoGrupoDetalle({ grupoId }: { grupoId: number }) {
  const router = useRouter()
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sending, setSending] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [preview, setPreview] = useState(false)

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
      setSelectedIds(new Set())
      load()
    } else toast.error('No se pudo enviar')
  }

  if (loading) return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-border shrink-0" />
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
      </div>
    </div>
  )
  if (!grupo) return <p className="text-sm text-muted-foreground p-6">No encontrado.</p>

  const accion = grupo.tipoDocumento?.accion ?? 'FIRMA'
  const stats = {
    total: grupo.asignaciones.length,
    firmados: grupo.asignaciones.filter(a => a.estado === 'FIRMADO').length,
    enFirma: grupo.asignaciones.filter(a => a.estado === 'ENVIADO_A_FIRMA').length,
    borradores: grupo.asignaciones.filter(a => a.estado === 'BORRADOR').length,
    rechazados: grupo.asignaciones.filter(a => a.estado === 'RECHAZADO').length,
  }
  const pct = stats.total > 0 ? Math.round(stats.firmados / stats.total * 100) : 0
  const borradorIds = grupo.asignaciones.filter(a => a.estado === 'BORRADOR').map(a => a.id)
  const selectedBorradores = borradorIds.filter(id => selectedIds.has(id))
  const canEnviar = accion !== 'NINGUNA' && borradorIds.length > 0

  const filtroTabs = ([
    { key: 'todos' as Filtro, label: 'Todos', count: stats.total },
    { key: 'firmados', label: accion === 'LECTURA' ? 'Leídos' : 'Firmados', count: stats.firmados },
    { key: 'enFirma', label: 'Pendientes de firma', count: stats.enFirma },
    { key: 'borradores', label: 'Borrador', count: stats.borradores },
    { key: 'rechazados', label: 'Rechazados', count: stats.rechazados },
  ] as { key: Filtro; label: string; count: number }[]).filter(t => t.key === 'todos' || t.count > 0)

  const q = busqueda.trim().toLowerCase()
  const filtradas = grupo.asignaciones.filter(a => {
    if (q && !`${a.employee.apellido} ${a.employee.nombre} ${a.employee.legajo}`.toLowerCase().includes(q)) return false
    if (filtro === 'todos') return true
    if (filtro === 'firmados') return a.estado === 'FIRMADO'
    if (filtro === 'enFirma') return a.estado === 'ENVIADO_A_FIRMA'
    if (filtro === 'borradores') return a.estado === 'BORRADOR'
    if (filtro === 'rechazados') return a.estado === 'RECHAZADO'
    return true
  })

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background flex items-center px-6 shrink-0">
          <Link href="/admin/documentos" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Volver a documentos
          </Link>
        </header>

        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Stats card */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h2 className="font-semibold text-foreground leading-tight truncate">{grupo.nombreArchivo}</h2>
                  <span className="text-xs text-muted-foreground">
                    {grupo.tipoDocumento?.nombre ?? 'Sin tipo'}{grupo.periodo ? ` · ${grupo.periodo}` : ''}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cargado por {grupo.cargadoPor.email} · {new Date(grupo.createdAt).toLocaleDateString('es-AR')}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canEnviar && (
                  <Button
                    size="sm"
                    className="bg-green-700 hover:bg-green-800 text-white h-8"
                    onClick={() => enviarFirma(selectedIds.size > 0 ? selectedBorradores : borradorIds)}
                    disabled={sending || (selectedIds.size > 0 && selectedBorradores.length === 0)}
                  >
                    <Send size={13} className="mr-1.5" />
                    {sending ? 'Enviando...' :
                      selectedIds.size > 0
                        ? `Enviar (${selectedBorradores.length})`
                        : `Enviar ${borradorIds.length} borrador${borradorIds.length !== 1 ? 'es' : ''}`}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setPreview(v => !v)}
                >
                  <Eye size={13} className="mr-1.5" /> {preview ? 'Cerrar' : 'Ver archivo'}
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={13} className="mr-1.5" /> Eliminar
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium text-foreground shrink-0">
                {stats.firmados}/{stats.total} {accion === 'LECTURA' ? 'leyeron' : 'firmaron'}
              </span>
              <span className="text-xs font-bold text-green-600 dark:text-green-400 shrink-0">{pct}%</span>
            </div>

            {(stats.enFirma > 0 || stats.rechazados > 0) && (
              <div className="flex gap-3 text-xs flex-wrap">
                {stats.enFirma > 0 && <span className="text-blue-600 dark:text-blue-400">{stats.enFirma} en firma</span>}
                {stats.rechazados > 0 && <span className="text-orange-600 dark:text-orange-400">{stats.rechazados} rechazado{stats.rechazados !== 1 ? 's' : ''}</span>}
              </div>
            )}
          </div>

          {/* Búsqueda */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Buscar por empleado o legajo…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {filtroTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFiltro(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filtro === tab.key
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label} <span className="opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Tabla */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 text-left py-3 px-4">
                    {(() => {
                      const visBorradorIds = filtradas.filter(a => a.estado === 'BORRADOR').map(a => a.id)
                      const allSel = visBorradorIds.length > 0 && visBorradorIds.every(id => selectedIds.has(id))
                      return (
                        <input
                          type="checkbox"
                          checked={allSel}
                          disabled={visBorradorIds.length === 0}
                          onChange={e => {
                            setSelectedIds(prev => {
                              const next = new Set(prev)
                              if (e.target.checked) visBorradorIds.forEach(id => next.add(id))
                              else visBorradorIds.forEach(id => next.delete(id))
                              return next
                            })
                          }}
                          className="cursor-pointer accent-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Seleccionar borradores visibles"
                        />
                      )
                    })()}
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Empleado</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Legajo</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Estado</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground hidden md:table-cell">Fecha firma</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Conformidad</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      <Users size={24} className="mx-auto mb-2 opacity-30" />
                      Sin empleados en este filtro
                    </td>
                  </tr>
                ) : filtradas.map((a, idx) => {
                  const estadoKey = a.estado as EstadoKey
                  const cfgBase = ESTADO_CONFIG[estadoKey] ?? ESTADO_CONFIG.BORRADOR
                  const cfg = accion === 'LECTURA' && estadoKey === 'FIRMADO'
                    ? { ...cfgBase, label: 'Leído' }
                    : cfgBase
                  const { Icon } = cfg
                  const isBorrador = a.estado === 'BORRADOR'
                  return (
                    <tr key={a.id} className={`border-b border-border last:border-0 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}>
                      <td className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(a.id)}
                          disabled={!isBorrador}
                          onChange={e => {
                            setSelectedIds(prev => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(a.id)
                              else next.delete(a.id)
                              return next
                            })
                          }}
                          className="cursor-pointer accent-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {a.employee.apellido}, {a.employee.nombre}
                        {a.employee.categoria && (
                          <p className="text-xs text-muted-foreground font-normal">{a.employee.categoria.nombre}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-xs hidden sm:table-cell">{a.employee.legajo}</td>
                      <td className="py-3 px-4">
                        <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', cfg.classes)}>
                          <Icon size={11} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">
                        {a.fechaFirma ? new Date(a.fechaFirma).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        {a.firmaConforme === true ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">✓ Conforme</span>
                        ) : a.firmaConforme === false ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">✗ No conforme</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        {a.firmaComentario ? (
                          <div className="max-w-[240px] overflow-hidden">
                            <p className="text-xs text-muted-foreground line-clamp-2 break-words" title={a.firmaComentario}>
                              {a.firmaComentario}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Panel lateral de preview */}
      {preview && (
        <aside className="w-full sm:w-[420px] lg:w-[520px] shrink-0 border-l bg-card flex flex-col h-full">
          <div className="h-12 flex items-center justify-between px-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={14} className="text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate" title={grupo.nombreArchivo}>{grupo.nombreArchivo}</span>
            </div>
            <button
              onClick={() => setPreview(false)}
              className="p-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
          <iframe
            src={`/api/documentos-grupos/${grupo.id}/archivo`}
            className="flex-1 w-full bg-muted"
            title={grupo.nombreArchivo}
          />
        </aside>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`¿Eliminar el documento "${grupo.nombreArchivo}"?`}
        description={`Se elimina el archivo y las ${stats.total} asignación${stats.total !== 1 ? 'es' : ''}. Esta acción no se puede deshacer.`}
        onConfirm={eliminarGrupo}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
