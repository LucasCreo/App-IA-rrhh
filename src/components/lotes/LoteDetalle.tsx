'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Send, RefreshCw, CheckCircle2, Clock, FileX, AlertCircle, FileQuestion, Users, Pencil, Check, X, Trash2, Plus, UsersRound, Eye, Upload } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { AgregarRecibosDialog } from './AgregarRecibosDialog'
import { EditarRosterDialog } from './EditarRosterDialog'
import { handleApiError } from '@/lib/apiErrors'

interface Documento {
  id: number
  estado: string
  fechaFirma: string | null
  firmaExternalId: string | null
}

interface EmpleadoRow {
  id: number
  nombre: string
  apellido: string
  legajo: string
  documento: Documento | null
}

interface Stats {
  total: number
  firmados: number
  enFirma: number
  borradores: number
  errores: number
  rechazados: number
  sinRecibo: number
}

interface LoteInfo {
  id: number
  nombre: string
  descripcion: string | null
  periodo: string
  createdAt: string
  tipoDocumento: { id: number; nombre: string; accion: string } | null
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatPeriodo(p: string) {
  const [year, month] = p.split('-')
  return `${MESES[parseInt(month) - 1]} ${year}`
}

type EstadoKey = 'FIRMADO' | 'ENVIADO_A_FIRMA' | 'BORRADOR' | 'ERROR' | 'RECHAZADO' | 'SIN_RECIBO'

const ESTADO_CONFIG: Record<EstadoKey, { label: string; classes: string; Icon: React.ElementType }> = {
  FIRMADO:         { label: 'Firmado',    classes: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',       Icon: CheckCircle2 },
  ENVIADO_A_FIRMA: { label: 'En firma',   classes: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',          Icon: Clock },
  BORRADOR:        { label: 'Borrador',   classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',             Icon: FileX },
  ERROR:           { label: 'Error',      classes: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',              Icon: AlertCircle },
  RECHAZADO:       { label: 'Rechazado',  classes: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',  Icon: AlertCircle },
  SIN_RECIBO:      { label: 'Sin recibo', classes: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-500',   Icon: FileQuestion },
}

type Filtro = 'todos' | 'firmados' | 'enFirma' | 'borradores' | 'errores' | 'sinRecibo'

export function LoteDetalle({ loteId }: { loteId: number }) {
  const router = useRouter()
  const [lote, setLote] = useState<LoteInfo | null>(null)
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [sending, setSending] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [editNombre, setEditNombre] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [editandoRoster, setEditandoRoster] = useState(false)
  const [replaceTargetDocId, setReplaceTargetDocId] = useState<number | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<{ id: number; empleado: string } | null>(null)
  const replaceFileRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/lotes/${loteId}`)
      if (!r.ok) { toast.error('Error al cargar el lote'); return }
      const data = await r.json()
      setLote(data.lote)
      setEmpleados(data.empleados)
      setStats(data.stats)
    } finally {
      setLoading(false)
    }
  }, [loteId])

  useEffect(() => { fetchData() }, [fetchData])

  async function enviarTodos() {
    setSending(true)
    try {
      const r = await fetch(`/api/lotes/${loteId}/enviar-firma`, { method: 'POST' })
      if (!r.ok) { await handleApiError(r, href => router.push(href)); return }
      const data = await r.json()
      if (data.errors?.length > 0) {
        toast.warning(`${data.sent} enviados, ${data.errors.length} con error`)
      } else {
        toast.success(`${data.sent} recibo(s) enviados`)
      }
      await fetchData()
    } finally {
      setSending(false)
    }
  }

  async function enviarDoc(docId: number) {
    setActionLoading(docId)
    try {
      const r = await fetch(`/api/documentos/${docId}/enviar-firma`, { method: 'POST' })
      if (!r.ok) { await handleApiError(r, href => router.push(href)); return }
      toast.success('Enviado')
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  function startEditing() {
    setEditNombre(lote?.nombre ?? '')
    setEditDescripcion(lote?.descripcion ?? '')
    setEditing(true)
  }

  async function doDeleteLote() {
    const r = await fetch(`/api/lotes/${loteId}`, { method: 'DELETE' })
    setConfirmDelete(false)
    if (!r.ok) { await handleApiError(r, href => router.push(href)); return }
    toast.success('Lote eliminado')
    router.push('/admin/lotes')
  }

  async function saveEdit() {
    if (!editNombre.trim()) { toast.error('El nombre no puede estar vacío'); return }
    setSaving(true)
    try {
      const r = await fetch(`/api/lotes/${loteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editNombre.trim(), descripcion: editDescripcion.trim() || null }),
      })
      if (!r.ok) { await handleApiError(r, href => router.push(href)); return }
      toast.success('Lote actualizado')
      setEditing(false)
      await fetchData()
    } finally {
      setSaving(false)
    }
  }

  function abrirReemplazo(docId: number) {
    setReplaceTargetDocId(docId)
    replaceFileRef.current?.click()
  }

  async function onFileReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || replaceTargetDocId == null) return
    const docId = replaceTargetDocId
    setReplaceTargetDocId(null)
    setActionLoading(docId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`/api/documentos/${docId}/reemplazar`, { method: 'POST', body: fd })
      if (!r.ok) { await handleApiError(r, href => router.push(href)); return }
      toast.success('Recibo reemplazado')
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  async function doDeleteDoc() {
    if (!deleteDoc) return
    const docId = deleteDoc.id
    setDeleteDoc(null)
    setActionLoading(docId)
    try {
      const r = await fetch(`/api/documentos/${docId}`, { method: 'DELETE' })
      if (!r.ok) { await handleApiError(r, href => router.push(href)); return }
      toast.success('Recibo eliminado')
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  async function verificarDoc(docId: number) {
    setActionLoading(docId)
    try {
      const r = await fetch(`/api/documentos/${docId}/enviar-firma`, { method: 'PATCH' })
      if (!r.ok) { await handleApiError(r, href => router.push(href)); return }
      const data = await r.json()
      toast.info(`Estado actualizado: ${data.estado}`)
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-14 border-b border-border shrink-0" />
        <div className="p-6 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!lote || !stats) return null

  const accion = lote.tipoDocumento?.accion ?? 'FIRMA'
  const pct = stats.total > 0 ? Math.round(stats.firmados / stats.total * 100) : 0
  const canEnviarTodos = accion !== 'NINGUNA' && (stats.borradores + stats.errores) > 0

  const filtroTabs = ([
    { key: 'todos' as Filtro,     label: 'Todos',     count: empleados.length },
    { key: 'firmados',  label: 'Firmados',  count: stats.firmados },
    { key: 'enFirma',   label: 'En Firma',  count: stats.enFirma },
    { key: 'borradores',label: 'Borrador',  count: stats.borradores },
    { key: 'sinRecibo', label: 'Sin Recibo',count: stats.sinRecibo },
    { key: 'errores',   label: 'Errores',   count: stats.errores + stats.rechazados },
  ] as { key: Filtro; label: string; count: number }[]).filter(t => t.key === 'todos' || t.count > 0)

  const filteredEmpleados = empleados.filter(e => {
    if (filtro === 'todos') return true
    const estado = e.documento?.estado ?? 'SIN_RECIBO'
    if (filtro === 'firmados')   return estado === 'FIRMADO'
    if (filtro === 'enFirma')    return estado === 'ENVIADO_A_FIRMA'
    if (filtro === 'borradores') return estado === 'BORRADOR'
    if (filtro === 'sinRecibo')  return !e.documento
    if (filtro === 'errores')    return estado === 'ERROR' || estado === 'RECHAZADO'
    return true
  })

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6 shrink-0">
        <Link href="/admin/lotes" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} />
          Volver a lotes
        </Link>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Stats card */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          {/* Name / description (editable) */}
          {editing ? (
            <div className="space-y-2">
              <Input
                className="h-8 text-sm font-semibold"
                value={editNombre}
                onChange={e => setEditNombre(e.target.value)}
                autoFocus
              />
              <Textarea
                className="resize-none text-xs h-14"
                placeholder="Descripción (opcional)…"
                value={editDescripcion}
                onChange={e => setEditDescripcion(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="text-xs text-green-700 dark:text-green-400 hover:underline disabled:opacity-50 flex items-center gap-1">
                  <Check size={12} />{saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <X size={12} />Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2 group">
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground leading-tight">{lote.nombre}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatPeriodo(lote.periodo)}{lote.tipoDocumento ? ` · ${lote.tipoDocumento.nombre}` : ''}
                </p>
                {lote.descripcion && (
                  <p className="text-xs text-muted-foreground mt-1">{lote.descripcion}</p>
                )}
              </div>
              <button
                onClick={startEditing}
                className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                title="Editar"
              >
                <Pencil size={13} />
              </button>
            </div>
          )}

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">
                {stats.firmados} de {stats.total} empleados {accion === 'LECTURA' ? 'leyeron' : 'firmaron'}
              </p>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">{pct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              {stats.enFirma > 0 && (
                <span className="text-blue-600 dark:text-blue-400">{stats.enFirma} en firma</span>
              )}
              {stats.sinRecibo > 0 && (
                <span className="text-yellow-600 dark:text-yellow-500">{stats.sinRecibo} sin recibo</span>
              )}
              {(stats.errores + stats.rechazados) > 0 && (
                <span className="text-red-600 dark:text-red-400">{stats.errores + stats.rechazados} con error</span>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditandoRoster(true)}
            >
              <UsersRound size={14} className="mr-1.5" />
              Editar empleados
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAgregando(true)}
            >
              <Plus size={14} className="mr-1.5" />
              Agregar recibos
            </Button>
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-800 text-white"
              onClick={enviarTodos}
              disabled={!canEnviarTodos || sending}
            >
              <Send size={14} className="mr-1.5" />
              {sending ? 'Enviando...' : accion === 'LECTURA' ? 'Notificar a todos' : 'Enviar todos a firma'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 dark:border-red-900 dark:hover:bg-red-950/30"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} className="mr-1.5" />
              Eliminar lote
            </Button>
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
                  ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label} <span className="opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Employee table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Empleado</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Legajo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Estado</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmpleados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                    <Users size={24} className="mx-auto mb-2 opacity-30" />
                    Sin empleados en este filtro
                  </td>
                </tr>
              ) : filteredEmpleados.map((emp, idx) => {
                const estadoKey = (emp.documento?.estado ?? 'SIN_RECIBO') as EstadoKey
                const cfgBase = ESTADO_CONFIG[estadoKey] ?? ESTADO_CONFIG.SIN_RECIBO
                const cfg = accion === 'LECTURA' && estadoKey === 'FIRMADO'
                  ? { ...cfgBase, label: 'Leído' }
                  : cfgBase
                const { Icon } = cfg
                const docId = emp.documento?.id
                const isLoading = actionLoading === docId
                return (
                  <tr
                    key={emp.id}
                    className={`border-b border-border last:border-0 ${idx % 2 !== 0 ? 'bg-muted/20' : ''}`}
                  >
                    <td className="py-3 px-4 font-medium">{emp.apellido}, {emp.nombre}</td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs hidden sm:table-cell">{emp.legajo}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}>
                        <Icon size={11} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {docId && (
                        <div className="inline-flex items-center gap-0.5">
                          <a
                            href={`/api/documentos/${docId}/archivo`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Ver recibo"
                          >
                            <Eye size={14} />
                          </a>
                          <button
                            onClick={() => abrirReemplazo(docId)}
                            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Reemplazar PDF"
                          >
                            <Pencil size={14} />
                          </button>
                          {(estadoKey === 'BORRADOR' || estadoKey === 'ERROR') && accion !== 'NINGUNA' && (
                            <button
                              onClick={() => enviarDoc(docId)}
                              disabled={isLoading}
                              className="p-1.5 rounded text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50 transition-colors"
                              title={accion === 'LECTURA' ? 'Notificar' : 'Enviar a firma'}
                            >
                              <Send size={14} />
                            </button>
                          )}
                          {estadoKey === 'ENVIADO_A_FIRMA' && accion === 'FIRMA' && (
                            <button
                              onClick={() => verificarDoc(docId)}
                              disabled={isLoading}
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                              title="Verificar estado"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                          <span className="w-px h-4 bg-border mx-0.5" />
                          <button
                            onClick={() => setDeleteDoc({ id: docId, empleado: `${emp.apellido}, ${emp.nombre}` })}
                            className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            title="Eliminar recibo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={`¿Eliminar el lote "${lote?.nombre}"?`}
        description="Los recibos asociados no se eliminarán."
        onConfirm={doDeleteLote}
        onCancel={() => setConfirmDelete(false)}
      />
      <AgregarRecibosDialog
        open={agregando}
        loteId={loteId}
        onClose={() => setAgregando(false)}
        onSaved={() => { setAgregando(false); fetchData() }}
      />
      <EditarRosterDialog
        open={editandoRoster}
        loteId={loteId}
        onClose={() => setEditandoRoster(false)}
        onSaved={() => { setEditandoRoster(false); fetchData() }}
      />
      <input
        ref={replaceFileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFileReplace}
      />
      <ConfirmDialog
        open={!!deleteDoc}
        title={`¿Eliminar el recibo de ${deleteDoc?.empleado}?`}
        description="El archivo se borra del sistema. Esta acción no se puede deshacer."
        onConfirm={doDeleteDoc}
        onCancel={() => setDeleteDoc(null)}
      />
    </div>
  )
}
