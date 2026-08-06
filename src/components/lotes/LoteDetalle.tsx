'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Send, CheckCircle2, Clock, FileX, AlertCircle, FileQuestion, Users, Pencil, Check, X, Trash2, Plus, Eye, Upload, Search, Download, SlidersHorizontal, FileText, UserPlus, Package, MoreVertical, ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { AgregarRecibosDialog } from './AgregarRecibosDialog'
import { EmpleadoDialog } from '@/components/empleados/EmpleadoDialog'
import { handleApiError } from '@/lib/apiErrors'
import { detectarLegajoDesdeFilename, detectarLegajoPdf, runWithConcurrency } from '@/lib/recibosDetect'

interface Pendiente {
  id: number
  filePath: string
  nombreArchivo: string
  legajoDetectado: string | null
  detectando: boolean
  uploadedAt: string
}

const DETECT_CONCURRENCY = 6
const PENDIENTES_PAGE_SIZES = [20, 50, 100]

interface Documento {
  id: number
  estado: string
  fechaCarga: string
  fechaFirma: string | null
  firmaConforme: boolean | null
  firmaComentario: string | null
  nombreArchivo?: string | null
}

interface EmpleadoRow {
  id: number
  nombre: string
  apellido: string
  legajo: string
  categoria?: { id: number; nombre: string } | null
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
  pendientes: number
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
  FIRMADO:         { label: 'Firmado',    classes: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',       Icon: CheckCircle2 },
  ENVIADO_A_FIRMA: { label: 'Pendiente de firma',   classes: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',          Icon: Clock },
  BORRADOR:        { label: 'Borrador',   classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',             Icon: FileX },
  ERROR:           { label: 'Error',      classes: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',              Icon: AlertCircle },
  RECHAZADO:       { label: 'Rechazado',  classes: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',  Icon: AlertCircle },
  SIN_RECIBO:      { label: 'Sin recibo', classes: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-500',   Icon: FileQuestion },
}

type Filtro = 'todos' | 'firmados' | 'enFirma' | 'conformes' | 'noConformes' | 'borradores' | 'errores' | 'sinRecibo'

export function LoteDetalle({ loteId }: { loteId: number }) {
  const router = useRouter()
  const [lote, setLote] = useState<LoteInfo | null>(null)
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([])
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [filenamePatterns, setFilenamePatterns] = useState<string[]>([])
  const [patternsLoaded, setPatternsLoaded] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [asignacionPend, setAsignacionPend] = useState<Record<number, string>>({})
  const [creatingEmpForPend, setCreatingEmpForPend] = useState<{ pendId: number; legajo: string | null } | null>(null)
  const [pendBusqueda, setPendBusqueda] = useState('')
  const [pendPagina, setPendPagina] = useState(1)
  const [pendPageSize, setPendPageSize] = useState<number>(20)
  const [autoAsignados, setAutoAsignados] = useState(0)
  const [assignOpenId, setAssignOpenId] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ kind: 'pend' | 'doc'; id: number; nombre: string } | null>(null)
  const [analizandoIds, setAnalizandoIds] = useState<Set<number>>(new Set())
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<number>>(new Set())
  const [tabActivo, setTabActivo] = useState<'recibos' | 'pendientes'>('recibos')
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [filtCategoriaId, setFiltCategoriaId] = useState<string>('todas')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [editNombre, setEditNombre] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [envioErrors, setEnvioErrors] = useState<Array<{ id: number; empleado: string; legajo: string; message: string; code?: string }>>([])
  const [envioReporteOpen, setEnvioReporteOpen] = useState(false)
  const [replaceTargetDocId, setReplaceTargetDocId] = useState<number | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<{ id: number; empleado: string } | null>(null)
  const replaceFileRef = useRef<HTMLInputElement>(null)
  const procesadosRef = useRef<Set<number>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/lotes/${loteId}`)
      if (!r.ok) { toast.error('Error al cargar el lote'); return }
      const data = await r.json()
      setLote(data.lote)
      setEmpleados(data.empleados)
      setPendientes(data.pendientes ?? [])
      setStats(data.stats)
    } finally {
      setLoading(false)
    }
  }, [loteId])

  useEffect(() => { fetchData() }, [fetchData])

  // Cargar patrones de filename una sola vez (bloquea la detección hasta que resuelva)
  useEffect(() => {
    fetch('/api/configuracion/general')
      .then(r => r.json())
      .then(cfg => {
        try {
          const parsed = cfg?.reciboFilenamePatterns ? JSON.parse(cfg.reciboFilenamePatterns) : []
          setFilenamePatterns(Array.isArray(parsed) ? parsed : [])
        } catch { setFilenamePatterns([]) }
      })
      .finally(() => setPatternsLoaded(true))
  }, [])

  // Auto-asignar helper: si el legajo detectado matchea un empleado que NO tiene doc en el lote, asigna
  const tryAutoAsignar = useCallback(async (pendId: number, legajo: string) => {
    const emp = empleados.find(e =>
      e.legajo === legajo || e.legajo.replace(/^0+/, '') === legajo.replace(/^0+/, '')
    )
    if (!emp || emp.documento) return false
    const r = await fetch(`/api/lotes/${loteId}/pendientes/${pendId}/asignar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: emp.id }),
    })
    if (!r.ok) return false
    setPendientes(prev => prev.filter(p => p.id !== pendId))
    setAutoAsignados(n => n + 1)
    return true
  }, [empleados, loteId])

  // Detección lazy: por filename (local); si no matchea y no se detectó todavía, OCR server
  useEffect(() => {
    if (!patternsLoaded) return
    if (pendientes.length === 0 || empleados.length === 0) return
    const legajosValidos = new Set(empleados.map(e => e.legajo))
    const needsWork = pendientes.filter(p => !p.legajoDetectado && !procesadosRef.current.has(p.id))
    if (needsWork.length === 0) return
    // Marcar como procesados ANTES de iniciar el async, para que setPendientes
    // optimistas no re-disparen el efecto sobre los mismos items.
    needsWork.forEach(p => procesadosRef.current.add(p.id))

    let cancelled = false
    ;(async () => {
      // Paso 1: intento por filename para todos
      const remaining: Pendiente[] = []
      for (const p of needsWork) {
        const local = detectarLegajoDesdeFilename(p.nombreArchivo, legajosValidos, filenamePatterns)
        if (local) {
          await fetch(`/api/lotes/${loteId}/pendientes/${p.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ legajoDetectado: local }),
          })
          if (cancelled) return
          const auto = await tryAutoAsignar(p.id, local)
          if (!auto) {
            setPendientes(prev => prev.map(x => x.id === p.id ? { ...x, legajoDetectado: local, detectando: false } : x))
          }
        } else {
          remaining.push(p)
        }
      }
      // Paso 2: OCR server para el resto (con cola)
      if (remaining.length > 0) {
        if (cancelled) return
        const remainingIds = remaining.map(r => r.id)
        // Marcar OCR en progreso en un set local (no muta el pendiente)
        setAnalizandoIds(prev => {
          const next = new Set(prev)
          for (const id of remainingIds) next.add(id)
          return next
        })
        await runWithConcurrency(remaining, async (p) => {
          if (cancelled) return
          try {
            const r = await fetch(`/api/lotes/${loteId}/pendientes/${p.id}/archivo`)
            if (!r.ok) throw new Error('no se pudo leer el archivo')
            const blob = await r.blob()
            const asFile = new File([blob], p.nombreArchivo, { type: 'application/pdf' })
            const detected = await detectarLegajoPdf(asFile)
            const legajo = detected.legajo && legajosValidos.has(detected.legajo) ? detected.legajo : null
            if (cancelled) return
            await fetch(`/api/lotes/${loteId}/pendientes/${p.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ legajoDetectado: legajo }),
            })
            const auto = legajo ? await tryAutoAsignar(p.id, legajo) : false
            if (!auto) {
              setPendientes(prev => prev.map(x => x.id === p.id
                ? { ...x, legajoDetectado: legajo }
                : x))
            }
          } catch { /* silencioso — chip pasa a "sin legajo" */ }
          finally {
            setAnalizandoIds(prev => {
              if (!prev.has(p.id)) return prev
              const next = new Set(prev); next.delete(p.id); return next
            })
          }
        }, DETECT_CONCURRENCY)
      }
    })()
    return () => { cancelled = true }
  }, [pendientes, empleados, filenamePatterns, loteId, tryAutoAsignar, patternsLoaded])

  async function enviarTodos() {
    setSending(true)
    try {
      // Si hay selección, derivo los docIds enviables (solo BORRADOR/ERROR) desde los empleados seleccionados
      let body: string
      if (selectedEmpIds.size > 0) {
        const docIds = empleados
          .filter(e => selectedEmpIds.has(e.id) && e.documento && (e.documento.estado === 'BORRADOR' || e.documento.estado === 'ERROR'))
          .map(e => e.documento!.id)
        body = JSON.stringify({ documentIds: docIds })
      } else {
        body = JSON.stringify({})
      }
      const r = await fetch(`/api/lotes/${loteId}/enviar-firma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!r.ok) { await handleApiError(r, href => router.push(href)); return }
      const data = await r.json()
      const errs: typeof envioErrors = Array.isArray(data.errors) ? data.errors : []
      if (errs.length > 0) {
        setEnvioErrors(errs)
        setEnvioReporteOpen(true)
        toast.warning(`${data.sent} enviados, ${errs.length} con error`)
      } else {
        setEnvioErrors([])
        toast.success(`${data.sent} recibo(s) enviados`)
      }
      setSelectedEmpIds(new Set())
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

  async function asignarPendiente(pendId: number, employeeId: number) {
    const r = await fetch(`/api/lotes/${loteId}/pendientes/${pendId}/asignar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      toast.error(d?.error ?? 'No se pudo asignar')
      return
    }
    toast.success('Asignado')
    setPendientes(prev => prev.filter(p => p.id !== pendId))
    setAsignacionPend(prev => {
      const next = { ...prev }
      delete next[pendId]
      return next
    })
    await fetchData()
  }

  async function eliminarPendiente(pendId: number) {
    const r = await fetch(`/api/lotes/${loteId}/pendientes/${pendId}`, { method: 'DELETE' })
    if (!r.ok) { toast.error('No se pudo eliminar'); return }
    toast.success('Archivo descartado')
    setPendientes(prev => prev.filter(p => p.id !== pendId))
    await fetchData()
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

  const conformesCount = empleados.filter(e => e.documento?.estado === 'FIRMADO' && e.documento.firmaConforme === true).length
  const noConformesCount = empleados.filter(e => e.documento?.estado === 'FIRMADO' && e.documento.firmaConforme === false).length

  const asignadosCount = empleados.filter(e => !!e.documento).length
  const filtroTabs = ([
    { key: 'todos' as Filtro,     label: 'Todos',              count: asignadosCount },
    { key: 'firmados',   label: 'Firmados',            count: stats.firmados },
    { key: 'conformes',  label: 'Conformes',           count: conformesCount },
    { key: 'noConformes',label: 'No conformes',        count: noConformesCount },
    { key: 'enFirma',    label: 'Pendientes de firma', count: stats.enFirma },
    { key: 'borradores', label: 'Borrador',            count: stats.borradores },
    { key: 'errores',    label: 'Errores',             count: stats.errores + stats.rechazados },
  ] as { key: Filtro; label: string; count: number }[]).filter(t => t.key === 'todos' || t.count > 0)

  const categoriasLote = Array.from(
    new Map(empleados.filter(e => e.categoria).map(e => [e.categoria!.id, e.categoria!])).values()
  ).sort((a, b) => a.nombre.localeCompare(b.nombre))

  const activeExtraFilters = (filtCategoriaId !== 'todas' ? 1 : 0)

  const q = busqueda.trim().toLowerCase()
  const filteredEmpleados = empleados.filter(e => {
    if (!e.documento) return false
    if (q) {
      const hay = `${e.apellido} ${e.nombre} ${e.legajo}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filtCategoriaId !== 'todas' && String(e.categoria?.id ?? '') !== filtCategoriaId) return false
    if (filtro === 'todos') return true
    const estado = e.documento?.estado ?? 'SIN_RECIBO'
    if (filtro === 'firmados')    return estado === 'FIRMADO'
    if (filtro === 'conformes')   return estado === 'FIRMADO' && e.documento?.firmaConforme === true
    if (filtro === 'noConformes') return estado === 'FIRMADO' && e.documento?.firmaConforme === false
    if (filtro === 'enFirma')     return estado === 'ENVIADO_A_FIRMA'
    if (filtro === 'borradores')  return estado === 'BORRADOR'
    if (filtro === 'sinRecibo')   return !e.documento
    if (filtro === 'errores')     return estado === 'ERROR' || estado === 'RECHAZADO'
    return true
  })

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
      <header className="h-14 border-b border-border bg-background flex items-center px-6 shrink-0">
        <Link href="/admin/lotes" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} />
          Volver a lotes
        </Link>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Stats card */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {/* Header: nombre + acciones */}
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h2 className="font-semibold text-foreground leading-tight truncate">{lote.nombre}</h2>
                  <span className="text-xs text-muted-foreground">
                    {formatPeriodo(lote.periodo)}{lote.tipoDocumento ? ` · ${lote.tipoDocumento.nombre}` : ''}
                  </span>
                </div>
                {lote.descripcion && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{lote.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  className="bg-green-700 hover:bg-green-800 text-white h-8"
                  onClick={enviarTodos}
                  disabled={!canEnviarTodos || sending}
                >
                  <Send size={13} className="mr-1.5" />
                  {(() => {
                    if (sending) return 'Enviando...'
                    const label = accion === 'LECTURA' ? 'Notificar' : 'Enviar a firma'
                    if (selectedEmpIds.size === 0) return label
                    const enviables = empleados.filter(e => selectedEmpIds.has(e.id) && e.documento && (e.documento.estado === 'BORRADOR' || e.documento.estado === 'ERROR')).length
                    return `${label} (${enviables})`
                  })()}
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => setAgregando(true)}>
                  <Plus size={13} className="mr-1.5" /> Agregar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Más acciones"
                  >
                    <MoreVertical size={15} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={startEditing}>
                      <Pencil size={13} className="mr-2" /> Editar lote
                    </DropdownMenuItem>
                    {(stats?.total ?? 0) > 0 && (
                      <DropdownMenuItem onClick={() => { window.location.href = `/api/lotes/${loteId}/descargar-zip` }}>
                        <Download size={13} className="mr-2" /> Descargar ZIP
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmDelete(true)}
                      className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300"
                    >
                      <Trash2 size={13} className="mr-2" /> Eliminar lote
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          {/* Progress inline */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-foreground shrink-0">
              {stats.firmados}/{stats.total} {accion === 'LECTURA' ? 'leyeron' : 'firmaron'}
            </span>
            <span className="text-xs font-bold text-green-600 dark:text-green-400 shrink-0">{pct}%</span>
          </div>

          {(stats.enFirma > 0 || stats.sinRecibo > 0 || (stats.errores + stats.rechazados) > 0) && (
            <div className="flex gap-3 text-xs flex-wrap">
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
          )}
        </div>

        {/* Tabs Asignados / A revisión */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setTabActivo('recibos')}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tabActivo === 'recibos'
                ? 'border-green-600 text-green-700 dark:text-green-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Asignados
          </button>
          <button
            onClick={() => setTabActivo('pendientes')}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
              tabActivo === 'pendientes'
                ? 'border-yellow-600 text-yellow-700 dark:text-yellow-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            A revisión
            {pendientes.length > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-yellow-500 text-white text-[10px] font-semibold">
                {pendientes.length}
              </span>
            )}
          </button>
        </div>

        {/* Archivos sin asignar */}
        {tabActivo === 'pendientes' && pendientes.length === 0 && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-yellow-50 dark:bg-yellow-950/20">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-yellow-700 dark:text-yellow-400" />
                <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-300">
                  Archivos a revisión (0)
                </span>
              </div>
              {autoAsignados > 0 && (
                <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                  ✓ {autoAsignados} auto-asignado{autoAsignados !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No hay archivos pendientes de revisión.
            </div>
          </div>
        )}
        {tabActivo === 'pendientes' && pendientes.length > 0 && (() => {
          const q = pendBusqueda.trim().toLowerCase()
          const filtrados = pendientes.filter(p => {
            if (q && !p.nombreArchivo.toLowerCase().includes(q) && !(p.legajoDetectado ?? '').toLowerCase().includes(q)) return false
            return true
          })
          const totalPag = Math.max(1, Math.ceil(filtrados.length / pendPageSize))
          const paginaActual = Math.min(pendPagina, totalPag)
          const inicio = (paginaActual - 1) * pendPageSize
          const paginaItems = filtrados.slice(inicio, inicio + pendPageSize)
          const sinDetectar = pendientes.filter(p => !p.legajoDetectado && !analizandoIds.has(p.id)).length
          return (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-yellow-50 dark:bg-yellow-950/20">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Package size={15} className="text-yellow-700 dark:text-yellow-400" />
                  <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-300">
                    Archivos sin asignar ({pendientes.length})
                  </span>
                </div>
                {autoAsignados > 0 && (
                  <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                    ✓ {autoAsignados} auto-asignado{autoAsignados !== 1 ? 's' : ''}
                  </span>
                )}
                {sinDetectar > 0 && (
                  <span className="text-xs text-yellow-700 dark:text-yellow-500 font-medium">
                    ⚠ {sinDetectar} sin detectar
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Los detectados se asignan automáticamente.
              </span>
            </div>
            {pendientes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-muted/30">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8 h-8 text-xs"
                    placeholder="Buscar archivo o legajo…"
                    value={pendBusqueda}
                    onChange={e => { setPendBusqueda(e.target.value); setPendPagina(1) }}
                  />
                </div>
                <span className="text-xs text-muted-foreground ml-auto">
                  {filtrados.length === 0 ? '0 resultados' :
                    `${inicio + 1}-${Math.min(inicio + pendPageSize, filtrados.length)} de ${filtrados.length}`}
                </span>
              </div>
            )}
            <div className="divide-y">
              {paginaItems.map(p => {
                const legajoDet = p.legajoDetectado
                const empSugerido = legajoDet
                  ? empleados.find(e => e.legajo === legajoDet || e.legajo.replace(/^0+/, '') === legajoDet.replace(/^0+/, ''))
                  : null
                const empSel = asignacionPend[p.id] ?? (empSugerido ? String(empSugerido.id) : '')
                const asignOpen = assignOpenId === p.id
                const enOcr = analizandoIds.has(p.id)
                // Chip corto + tooltip largo
                let chipLabel = ''
                let chipClass = ''
                let tooltipText = ''
                if (enOcr) {
                  chipLabel = 'analizando'
                  chipClass = 'bg-muted text-muted-foreground'
                  tooltipText = 'Analizando el contenido del archivo…'
                } else if (empSugerido) {
                  chipLabel = `sugerido: ${empSugerido.apellido}`
                  chipClass = 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300'
                  tooltipText = `Sugerido: ${empSugerido.apellido}, ${empSugerido.nombre} — legajo ${p.legajoDetectado}`
                } else if (p.legajoDetectado) {
                  chipLabel = `legajo ${p.legajoDetectado} inexistente`
                  chipClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300'
                  tooltipText = `Se detectó el legajo ${p.legajoDetectado} pero no existe ningún empleado con ese legajo.`
                } else {
                  chipLabel = 'sin legajo'
                  chipClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300'
                  tooltipText = 'No se pudo detectar un legajo válido en el nombre del archivo.'
                }
                return (
                  <div key={p.id} className="px-4 py-2.5 space-y-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {enOcr ? (
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-muted-foreground/30 border-t-green-600 animate-spin"
                          title={tooltipText}
                        />
                      ) : empSugerido ? (
                        <CheckCircle2 size={14} className="text-green-600 dark:text-green-400 shrink-0" />
                      ) : (
                        <span className="shrink-0 inline-flex" title={tooltipText}>
                          <AlertCircle size={14} className="text-yellow-500" />
                        </span>
                      )}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText size={12} className="text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate" title={p.nombreArchivo}>{p.nombreArchivo}</span>
                        <span
                          className={cn('shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded', chipClass)}
                          title={tooltipText}
                        >
                          {chipLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreview(
                            preview?.kind === 'pend' && preview.id === p.id
                              ? null
                              : { kind: 'pend', id: p.id, nombre: p.nombreArchivo }
                          )}
                          className={cn(
                            'inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors',
                            preview?.kind === 'pend' && preview.id === p.id
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                              : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                          )}
                          title={preview?.kind === 'pend' && preview.id === p.id ? 'Cerrar vista' : 'Ver archivo'}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => eliminarPendiente(p.id)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Eliminar archivo"
                        >
                          <Trash2 size={14} />
                        </button>
                        <Button
                          size="sm"
                          className={cn(
                            'h-8 text-xs text-white',
                            asignOpen
                              ? 'bg-green-800 hover:bg-green-900'
                              : 'bg-green-700 hover:bg-green-800'
                          )}
                          onClick={() => setAssignOpenId(asignOpen ? null : p.id)}
                        >
                          Asignar
                          <ChevronDown size={12} className={cn('ml-1 transition-transform', asignOpen && 'rotate-180')} />
                        </Button>
                      </div>
                    </div>
                    {asignOpen && (
                      <div className="flex gap-2 pl-6 pt-1">
                        <Select
                          value={empSel}
                          onValueChange={v => setAsignacionPend(prev => ({ ...prev, [p.id]: v ?? '' }))}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue placeholder="Seleccioná el empleado…" />
                          </SelectTrigger>
                          <SelectContent>
                            {empleados.map(e => (
                              <SelectItem key={e.id} value={String(e.id)}>
                                {`${e.legajo} — ${e.apellido}, ${e.nombre}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!empSugerido && p.legajoDetectado && !enOcr && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs shrink-0"
                            onClick={() => setCreatingEmpForPend({ pendId: p.id, legajo: p.legajoDetectado })}
                          >
                            <UserPlus size={12} className="mr-1" /> Crear empleado
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-8 text-xs shrink-0 bg-green-700 hover:bg-green-800"
                          disabled={!empSel}
                          onClick={() => {
                            if (!empSel) return
                            asignarPendiente(p.id, Number(empSel))
                            setAssignOpenId(null)
                          }}
                        >
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs shrink-0"
                          onClick={() => setAssignOpenId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
              {paginaItems.length === 0 && pendientes.length > 0 && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Sin resultados para el filtro actual.
                </div>
              )}
            </div>
            {filtrados.length > 0 && (
              <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
                <span>{filtrados.length} archivo{filtrados.length !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span>Por página</span>
                    <Select value={String(pendPageSize)} onValueChange={v => { if (v) { setPendPageSize(Number(v)); setPendPagina(1) } }}>
                      <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PENDIENTES_PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={paginaActual <= 1} onClick={() => setPendPagina(p => Math.max(1, p - 1))}>←</Button>
                    <span className="px-1">Página {paginaActual} de {totalPag}</span>
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={paginaActual >= totalPag} onClick={() => setPendPagina(p => Math.min(totalPag, p + 1))}>→</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          )
        })()}

        {tabActivo === 'recibos' && <>
        {/* Búsqueda + filtros */}
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
          {categoriasLote.length > 1 && (
            <>
              <Button
                variant="outline"
                onClick={() => setFiltersOpen(v => !v)}
                className={cn(activeExtraFilters > 0 && 'border-green-500 text-green-700 dark:text-green-400')}
              >
                <SlidersHorizontal size={14} className="mr-1.5" />
                Filtros
                {activeExtraFilters > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-green-600 text-white text-[10px] font-semibold">
                    {activeExtraFilters}
                  </span>
                )}
              </Button>
              {activeExtraFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setFiltCategoriaId('todas')}>
                  <X size={12} className="mr-1" /> Limpiar
                </Button>
              )}
            </>
          )}
        </div>

        {filtersOpen && categoriasLote.length > 1 && (
          <div className="flex flex-wrap gap-3 items-end p-4 bg-muted/30 border border-border rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Categoría</p>
              <Select value={filtCategoriaId} onValueChange={v => setFiltCategoriaId(v ?? 'todas')}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categoriasLote.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

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

        {/* Employee table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 text-left py-3 px-4">
                  {filteredEmpleados.length > 0 && (() => {
                    const visIds = filteredEmpleados.map(e => e.id)
                    const allSel = visIds.length > 0 && visIds.every(id => selectedEmpIds.has(id))
                    return (
                      <input
                        type="checkbox"
                        checked={allSel}
                        onChange={e => {
                          setSelectedEmpIds(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) visIds.forEach(id => next.add(id))
                            else visIds.forEach(id => next.delete(id))
                            return next
                          })
                        }}
                        className="cursor-pointer accent-green-700"
                        title="Seleccionar todos los visibles"
                      />
                    )
                  })()}
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Empleado</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Legajo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Estado</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground hidden md:table-cell">Fecha carga</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Conformidad</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Comentario</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmpleados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
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
                    <td className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedEmpIds.has(emp.id)}
                        onChange={e => {
                          setSelectedEmpIds(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(emp.id)
                            else next.delete(emp.id)
                            return next
                          })
                        }}
                        className="cursor-pointer accent-green-700"
                      />
                    </td>
                    <td className="py-3 px-4 font-medium">{emp.apellido}, {emp.nombre}</td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs hidden sm:table-cell">{emp.legajo}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}>
                        <Icon size={11} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs hidden md:table-cell">
                      {emp.documento?.fechaCarga
                        ? new Date(emp.documento.fechaCarga).toLocaleDateString('es-AR')
                        : '—'}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {emp.documento?.firmaConforme === true ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                          <Check size={12} /> Conforme
                        </span>
                      ) : emp.documento?.firmaConforme === false ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <X size={12} /> No conforme
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {emp.documento?.firmaComentario ? (
                        <div className="max-w-[240px] overflow-hidden">
                          <p className="text-xs text-muted-foreground line-clamp-2 break-words" title={emp.documento.firmaComentario}>
                            {emp.documento.firmaComentario}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {docId && (
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setPreview(
                              preview?.kind === 'doc' && preview.id === docId
                                ? null
                                : { kind: 'doc', id: docId, nombre: emp.documento?.nombreArchivo ?? `${emp.apellido}, ${emp.nombre}` }
                            )}
                            className={cn(
                              'p-1.5 rounded transition-colors',
                              preview?.kind === 'doc' && preview.id === docId
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            )}
                            title={preview?.kind === 'doc' && preview.id === docId ? 'Cerrar vista' : 'Ver recibo'}
                          >
                            <Eye size={14} />
                          </button>
                          {estadoKey !== 'FIRMADO' && (
                            <button
                              onClick={() => abrirReemplazo(docId)}
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Reemplazar PDF"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
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
        </>}
      </div>
      </div>

      {/* Panel lateral derecho de preview (empuja el contenido a la izquierda) */}
      {preview !== null && (() => {
        const src = preview.kind === 'pend'
          ? `/api/lotes/${loteId}/pendientes/${preview.id}/archivo`
          : `/api/documentos/${preview.id}/archivo`
        return (
          <aside className="w-full sm:w-[420px] lg:w-[520px] shrink-0 border-l bg-card flex flex-col h-full">
            <div className="h-12 flex items-center justify-between px-4 border-b bg-muted/30 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate" title={preview.nombre}>
                  {preview.nombre}
                </span>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="p-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
            <iframe
              key={`${preview.kind}-${preview.id}`}
              src={src}
              className="flex-1 w-full bg-muted"
              title={preview.nombre}
            />
          </aside>
        )
      })()}

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

      <Dialog open={envioReporteOpen} onOpenChange={v => !v && setEnvioReporteOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Envío a firma con errores</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {envioErrors.length} recibo{envioErrors.length === 1 ? '' : 's'} no pudo{envioErrors.length === 1 ? '' : 'ieron'} enviarse.
              Podés reintentar solo los fallidos.
            </p>
          </DialogHeader>
          <ul className="max-h-64 overflow-y-auto divide-y rounded-md border">
            {envioErrors.map(err => (
              <li key={err.id} className="px-3 py-2 text-xs">
                <p className="font-medium truncate">{err.empleado}</p>
                <p className="text-muted-foreground">Legajo {err.legajo} · {err.message}</p>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEnvioReporteOpen(false)}>Cerrar</Button>
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-800"
              disabled={sending}
              onClick={async () => { setEnvioReporteOpen(false); await enviarTodos() }}
            >
              <Send size={13} className="mr-1" /> Reintentar fallidos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {creatingEmpForPend && (
        <EmpleadoDialog
          open={true}
          onClose={() => setCreatingEmpForPend(null)}
          onSaved={async () => {
            const pendId = creatingEmpForPend.pendId
            setCreatingEmpForPend(null)
            await fetchData()
            // Buscar el empleado recién creado por legajo y proponerlo en el pendiente
            const created = creatingEmpForPend.legajo
            if (created) {
              const legNorm = created.replace(/^0+/, '')
              const emp = empleados.find(e => e.legajo === created || e.legajo.replace(/^0+/, '') === legNorm)
              if (emp) setAsignacionPend(prev => ({ ...prev, [pendId]: String(emp.id) }))
            }
          }}
          empleado={{
            legajo: creatingEmpForPend.legajo ?? '',
            cuil: '', nombre: '', apellido: '',
            email: '', telefono: '', fechaIngreso: '', categoriaId: 0, estado: 'ACTIVO',
          } as any}
        />
      )}
    </div>
  )
}
