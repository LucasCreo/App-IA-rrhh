'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/apiErrors'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DocumentoUploadDialog } from './DocumentoUploadDialog'
import { DocumentoCargarDialog } from './DocumentoCargarDialog'
import { EmpleadoPicker } from './EmpleadoPicker'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Send, Trash2, Plus, RefreshCw, Download, Search, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface Props { esRecibo?: boolean; employeeId?: number; sinLote?: boolean }
import { StatusBadge } from '@/components/ui/status-badge'

interface Doc {
  id: number; nombreArchivo: string; periodo: string | null; estado: string
  fechaCarga: string; fechaFirma?: string; firmaExternalId?: string
  firmaConforme?: boolean | null
  employee: { nombre: string; apellido: string; legajo: string }
  cargadoPor: { email: string }
  tipoDocumento?: { id: number; nombre: string; accion: string } | null
}

const ESTADOS: { value: string; label: string }[] = [
  { value: 'BORRADOR',        label: 'Borrador' },
  { value: 'ENVIADO_A_FIRMA', label: 'Enviado' },
  { value: 'FIRMADO',         label: 'Firmado' },
  { value: 'RECHAZADO',       label: 'Rechazado' },
  { value: 'ERROR',           label: 'Error' },
]
const MESES = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]

export function DocumentosTable({ esRecibo, employeeId, sinLote }: Props) {
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [cargarOpen, setCargarOpen] = useState(false)
  const [sending, setSending] = useState<number | null>(null)
  const [sendingBulk, setSendingBulk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalEmpleados, setTotalEmpleados] = useState(0)
  const [filtMes, setFiltMes] = useState('')
  const [filtAno, setFiltAno] = useState('')
  const [filtEstado, setFiltEstado] = useState('todos')
  const [filtConformidad, setFiltConformidad] = useState<'todos' | 'conforme' | 'no_conforme'>('todos')
  const [filtTipoId, setFiltTipoId] = useState('todos')
  const [filtEmpleadoId, setFiltEmpleadoId] = useState('todos')
  const [filtCategoriaId, setFiltCategoriaId] = useState('todos')
  const [filtQ, setFiltQ] = useState('')
  const [filtQDebounced, setFiltQDebounced] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [tipos, setTipos] = useState<{ id: number; nombre: string }[]>([])
  const [empleados, setEmpleados] = useState<{ id: number; nombre: string; apellido: string; legajo: string; categoria?: { id: number; nombre: string } | null }[]>([])
  const [categorias, setCategorias] = useState<{ id: number; nombre: string }[]>([])
  const [aniosDisponibles, setAniosDisponibles] = useState<string[]>([])
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const filtPeriodo = filtAno && filtMes ? `${filtAno}-${filtMes}` : filtAno || ''

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtPeriodo) params.set('periodo', filtPeriodo)
    if (filtEstado !== 'todos') params.set('estado', filtEstado)
    if (filtTipoId !== 'todos') params.set('tipoDocumentoId', filtTipoId)
    if (filtEmpleadoId !== 'todos') params.set('employeeId', filtEmpleadoId)
    if (filtCategoriaId !== 'todos') params.set('categoriaId', filtCategoriaId)
    if (filtQDebounced.trim()) params.set('q', filtQDebounced.trim())
    if (esRecibo !== undefined) params.set('recibo', String(esRecibo))
    if (employeeId) params.set('employeeId', String(employeeId))
    if (sinLote) params.set('sinLote', 'true')
    if (filtConformidad !== 'todos') params.set('conformidad', filtConformidad === 'conforme' ? 'true' : 'false')
    params.set('page', String(page))
    fetch(`/api/documentos?${params}`)
      .then(r => r.json())
      .then(data => {
        setDocs(data.docs ?? [])
        setTotal(data.total ?? 0)
        setPages(data.pages ?? 1)
        setSelected(new Set())
      })
      .finally(() => setLoading(false))
  }, [filtPeriodo, filtEstado, filtTipoId, filtEmpleadoId, filtCategoriaId, filtQDebounced, filtConformidad, esRecibo, employeeId, sinLote, page])

  useEffect(() => { load() }, [load])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setFiltQDebounced(filtQ), 300)
    return () => clearTimeout(t)
  }, [filtQ])

  useEffect(() => {
    fetch('/api/empleados?all=true&estado=ACTIVO')
      .then(r => r.json())
      .then(d => {
        setTotalEmpleados(d.total)
        setEmpleados(d.employees ?? [])
      })
    fetch('/api/categorias').then(r => r.json()).then(d => setCategorias(Array.isArray(d) ? d : []))
    fetch('/api/configuracion/tipos-documento').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : []
      setTipos(esRecibo === true
        ? list.filter((t: { nombre: string }) => t.nombre === 'Recibo de Sueldo')
        : esRecibo === false
          ? list.filter((t: { nombre: string }) => t.nombre !== 'Recibo de Sueldo')
          : list)
    })
    const p = new URLSearchParams()
    if (esRecibo !== undefined) p.set('recibo', String(esRecibo))
    if (employeeId) p.set('employeeId', String(employeeId))
    if (sinLote) p.set('sinLote', 'true')
    fetch(`/api/documentos/anios?${p}`).then(r => r.json()).then(d => setAniosDisponibles(d.anios ?? []))
  }, [esRecibo, employeeId, sinLote])

  async function handleSendToSign(id: number) {
    setSending(id)
    const res = await fetch(`/api/documentos/${id}/enviar-firma`, { method: 'POST' })
    if (!res.ok) {
      await handleApiError(res, href => router.push(href))
    } else {
      toast.success('Enviado')
    }
    setSending(null)
    load()
  }

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  async function handleBulkDelete() {
    if (selectedDocs.length === 0) return
    setBulkDeleting(true)
    let ok = 0, fail = 0
    for (const doc of selectedDocs) {
      const res = await fetch(`/api/documentos/${doc.id}`, { method: 'DELETE' })
      if (res.ok) ok++
      else fail++
    }
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    if (ok > 0) toast.success(`${ok} eliminado(s)`)
    if (fail > 0) toast.error(`${fail} no se pudo(ieron) eliminar`)
    load()
  }

  function handleBulkDownload() {
    if (selectedDocs.length === 0) return
    for (const doc of selectedDocs) {
      const a = document.createElement('a')
      a.href = `/api/documentos/${doc.id}/archivo`
      a.download = doc.nombreArchivo
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  async function handleBulkSend() {
    // Si hay seleccionados, usar solo los enviables de esa lista; si no, todos los enviables
    const todosEnviables = docs.filter(d =>
      (d.estado === 'BORRADOR' || d.estado === 'ERROR') && d.tipoDocumento?.accion !== 'NINGUNA'
    )
    const target = selected.size > 0 ? enviablesSelected : todosEnviables
    if (!target.length) return
    setSendingBulk(true)
    let ok = 0, fail = 0
    let configError: Awaited<ReturnType<typeof handleApiError>> | null = null
    for (const doc of target) {
      const res = await fetch(`/api/documentos/${doc.id}/enviar-firma`, { method: 'POST' })
      if (res.ok) { ok++; continue }
      fail++
      // Si el error es de configuración, detenemos e informamos una sola vez
      const payload = await res.clone().json().catch(() => null)
      if (payload?.code === 'SIGNATURE_NOT_CONFIGURED' || payload?.code === 'SIGNATURE_INCOMPLETE') {
        configError = payload
        break
      }
    }
    setSendingBulk(false)
    if (configError) {
      // Reusar el helper para mostrar con acción "Configurar firma"
      const { showApiError } = await import('@/lib/apiErrors')
      showApiError(configError, href => router.push(href))
    } else if (fail > 0) toast.error(`${fail} envío(s) fallaron`)
    if (ok > 0) toast.success(`${ok} enviado(s)`)
    load()
  }

  const seleccionables = docs
  const allSelected = seleccionables.length > 0 && seleccionables.every(d => selected.has(d.id))
  const someSelected = selected.size > 0 && !allSelected
  // Subconjuntos según acción
  const selectedDocs = docs.filter(d => selected.has(d.id))
  const enviablesSelected = selectedDocs.filter(d =>
    (d.estado === 'BORRADOR' || d.estado === 'ERROR') && d.tipoDocumento?.accion !== 'NINGUNA'
  )

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(seleccionables.map(d => d.id)))
  }

  async function handleCheckStatus(id: number) {
    const res = await fetch(`/api/documentos/${id}/enviar-firma`, { method: 'PATCH' })
    if (!res.ok) {
      await handleApiError(res, href => router.push(href))
    } else {
      const data = await res.json()
      toast.success(`Estado actualizado: ${data.estado ?? 'OK'}`)
    }
    load()
  }

  function exportCSV() {
    const BOM = '﻿'
    const headers = ['Empleado', 'Legajo', 'Período', 'Tipo', 'Archivo', 'Estado', 'Fecha Carga']
    const rows = docs.map(d => [
      `${d.employee.apellido}, ${d.employee.nombre}`,
      d.employee.legajo,
      d.periodo ?? '',
      d.tipoDocumento?.nombre ?? '',
      d.nombreArchivo,
      d.estado,
      new Date(d.fechaCarga).toLocaleDateString('es-AR'),
    ])
    const csv = BOM + [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${esRecibo === true ? 'recibos' : 'documentos'}${filtPeriodo ? `-${filtPeriodo}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function confirmDelete() {
    if (deleteId === null) return
    const res = await fetch(`/api/documentos/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null)
    if (!res.ok) {
      await handleApiError(res, href => router.push(href))
    } else {
      toast.success('Documento eliminado')
    }
    load()
  }

  const borradores = docs.filter(d =>
    (d.estado === 'BORRADOR' || d.estado === 'ERROR') && d.tipoDocumento?.accion !== 'NINGUNA'
  )
  const firmados = docs.filter(d => d.estado === 'FIRMADO').length
  const enviados = docs.filter(d => d.estado === 'ENVIADO_A_FIRMA').length
  const empleadosConRecibo = new Set(docs.map(d => d.employee.legajo)).size
  const sinRecibo = filtPeriodo ? Math.max(0, totalEmpleados - empleadosConRecibo) : null

  const activeFiltersCount = [
    filtMes, filtAno,
    filtEstado !== 'todos' ? filtEstado : '',
    filtTipoId !== 'todos' ? filtTipoId : '',
    filtEmpleadoId !== 'todos' ? filtEmpleadoId : '',
    filtCategoriaId !== 'todos' ? filtCategoriaId : '',
    filtConformidad !== 'todos' ? filtConformidad : '',
    filtQDebounced.trim(),
  ].filter(Boolean).length

  function clearAllFilters() {
    setFiltMes(''); setFiltAno('')
    setFiltEstado('todos'); setFiltTipoId('todos')
    setFiltEmpleadoId('todos'); setFiltCategoriaId('todos')
    setFiltConformidad('todos')
    setFiltQ(''); setPage(1)
  }

  return (
    <div>
      {/* Barra superior: búsqueda + toggle de filtros + acciones */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por archivo, empleado o legajo…"
            value={filtQ}
            onChange={e => { setFiltQ(e.target.value); setPage(1) }}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setFiltersOpen(v => !v)}
          className={cn(activeFiltersCount > 0 && 'border-green-500 text-green-700 dark:text-green-400')}
        >
          <SlidersHorizontal size={14} className="mr-1.5" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-green-600 text-white text-[10px] font-semibold">
              {activeFiltersCount}
            </span>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <X size={12} className="mr-1" /> Limpiar
          </Button>
        )}
        <div className="ml-auto flex gap-2 flex-wrap">
          {/* Acciones sobre los seleccionados */}
          {selected.size > 0 && (
            <>
              <Button variant="outline" onClick={handleBulkDownload} title="Descargar los seleccionados">
                <Download size={14} className="mr-1" /> Descargar {selected.size}
              </Button>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 size={14} className="mr-1" /> Eliminar {selected.size}
              </Button>
            </>
          )}
          {/* Envío masivo: si hay seleccionados, usa los enviables de esa selección; si no, todos los borradores/error */}
          {(selected.size > 0 ? enviablesSelected.length > 0 : borradores.length > 0) && (
            <Button variant="outline" className="text-blue-600 border-blue-200" onClick={handleBulkSend} disabled={sendingBulk}>
              <Send size={14} className="mr-1" />
              {sendingBulk
                ? 'Enviando...'
                : selected.size > 0
                  ? `Enviar ${enviablesSelected.length}`
                  : `Enviar ${borradores.length}`}
            </Button>
          )}
          {docs.length > 0 && (
            <Button variant="outline" onClick={exportCSV}>
              <Download size={14} className="mr-1" /> CSV
            </Button>
          )}
          <Button className="bg-green-700 hover:bg-green-800" onClick={() => esRecibo === true ? setUploadOpen(true) : setCargarOpen(true)}>
            <Plus size={16} className="mr-1" /> {esRecibo === true ? 'Cargar Recibo' : 'Cargar Documento'}
          </Button>
        </div>
      </div>

      {/* Panel de filtros colapsable */}
      {filtersOpen && (
      <div className="flex flex-wrap gap-3 mb-4 items-end p-4 bg-muted/30 border border-border rounded-lg">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Mes</p>
          <Select value={filtMes} onValueChange={v => { if (v != null) { setFiltMes(v === 'todos' ? '' : v); setPage(1) } }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Año</p>
          <Select value={filtAno || 'todos'} onValueChange={v => { if (v != null) { setFiltAno(v === 'todos' ? '' : v); setPage(1) } }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {aniosDisponibles.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Estado</p>
          <Select value={filtEstado} onValueChange={v => { setFiltEstado(v ?? 'todos'); setPage(1) }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Conformidad</p>
          <Select value={filtConformidad} onValueChange={v => { setFiltConformidad((v as typeof filtConformidad) ?? 'todos'); setPage(1) }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="conforme">Conformes</SelectItem>
              <SelectItem value="no_conforme">No conformes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {tipos.length > 0 && esRecibo !== true && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tipo</p>
            <Select value={filtTipoId} onValueChange={v => { setFiltTipoId(v ?? 'todos'); setPage(1) }}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {tipos.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {!employeeId && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Empleado</p>
            <div className="flex items-center gap-1">
              <EmpleadoPicker
                value={filtEmpleadoId === 'todos' ? '' : filtEmpleadoId}
                onChange={v => { setFiltEmpleadoId(v || 'todos'); setPage(1) }}
                empleados={empleados}
                placeholder="Todos"
                className="w-56"
              />
              {filtEmpleadoId !== 'todos' && (
                <button
                  onClick={() => { setFiltEmpleadoId('todos'); setPage(1) }}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
                  title="Quitar filtro"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        )}
        {!employeeId && categorias.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Categoría</p>
            <Select value={filtCategoriaId} onValueChange={v => { setFiltCategoriaId(v ?? 'todos'); setPage(1) }}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      )}

      {/* Resumen de cobertura */}
      {filtPeriodo && !loading && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="bg-muted rounded-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold">{docs.length}</span>
          </div>
          <div className="bg-green-50 dark:bg-green-950 rounded-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">Firmados: </span>
            <span className="font-semibold text-green-700 dark:text-green-400">{firmados}</span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">Pendientes de firma: </span>
            <span className="font-semibold text-blue-700 dark:text-blue-400">{enviados}</span>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">Borrador: </span>
            <span className="font-semibold text-yellow-700 dark:text-yellow-400">{borradores.length}</span>
          </div>
          {sinRecibo !== null && sinRecibo > 0 && (
            <div className="bg-red-50 dark:bg-red-950 rounded-lg px-4 py-2 text-sm">
              <span className="text-muted-foreground">Sin recibo: </span>
              <span className="font-semibold text-red-700 dark:text-red-400">{sinRecibo} empleados</span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No hay documentos con esos filtros.</p>
      ) : (
        <>
          {/* Master select mobile */}
          {seleccionables.length > 0 && (
            <div className="md:hidden flex items-center gap-2 px-1">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground">
                {selected.size > 0 ? `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}` : 'Seleccionar todos'}
              </span>
            </div>
          )}

          {/* Vista mobile — cards */}
          <div className="md:hidden space-y-3">
            {docs.map(doc => {
              return (
              <div key={doc.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Checkbox
                      className="mt-0.5"
                      checked={selected.has(doc.id)}
                      onCheckedChange={() => toggleOne(doc.id)}
                    />
                    <div className="min-w-0">
                      {!employeeId && <p className="font-medium text-sm">{doc.employee.apellido}, {doc.employee.nombre}</p>}
                      <p className="text-xs text-muted-foreground">{!employeeId && doc.employee.legajo}{doc.periodo ? `${!employeeId ? ' · ' : ''}${doc.periodo}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge estado={doc.estado} accion={doc.tipoDocumento?.accion} />
                    {doc.estado === 'FIRMADO' && doc.firmaConforme === true && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300">Conforme</span>
                    )}
                    {doc.estado === 'FIRMADO' && doc.firmaConforme === false && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400">No conforme</span>
                    )}
                  </div>
                </div>
                <a href={`/api/documentos/${doc.id}/archivo`} target="_blank" className="flex items-center gap-1 text-green-700 dark:text-green-400 hover:underline text-sm">
                  <FileText size={14} /> <span className="truncate">{doc.nombreArchivo}</span>
                </a>
                {doc.tipoDocumento && (
                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                    {doc.tipoDocumento.nombre}
                  </span>
                )}
                <div className="flex gap-2 pt-1">
                  {(() => {
                    const accion = doc.tipoDocumento?.accion ?? 'FIRMA'
                    if (accion === 'NINGUNA') return null
                    if (accion === 'LECTURA') {
                      if (doc.estado === 'BORRADOR' || doc.estado === 'ERROR')
                        return <Button size="sm" variant="outline" className="text-blue-600 flex-1" onClick={() => handleSendToSign(doc.id)} disabled={sending === doc.id}><Send size={14} className="mr-1" />{sending === doc.id ? '...' : 'Enviar'}</Button>
                      return null
                    }
                    return <>
                      {(doc.estado === 'BORRADOR' || doc.estado === 'ERROR') && (
                        <Button size="sm" variant="outline" className="text-blue-600 flex-1" onClick={() => handleSendToSign(doc.id)} disabled={sending === doc.id}>
                          <Send size={14} className="mr-1" />{sending === doc.id ? '...' : 'Enviar'}
                        </Button>
                      )}
                      {doc.estado === 'ENVIADO_A_FIRMA' && doc.firmaExternalId && (
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleCheckStatus(doc.id)}>
                          <RefreshCw size={14} className="mr-1" />Ver estado
                        </Button>
                      )}
                    </>
                  })()}
                  <Button size="sm" variant="destructive" onClick={() => setDeleteId(doc.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              )
            })}
          </div>

          {/* Vista desktop — tabla */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    {seleccionables.length > 0 && (
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Seleccionar todos"
                      />
                    )}
                  </TableHead>
                  {!employeeId && <TableHead>Empleado</TableHead>}
                  {esRecibo !== false && <TableHead>Período</TableHead>}
                  {esRecibo !== true && <TableHead>Tipo</TableHead>}
                  <TableHead>Archivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cargado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map(doc => {
                  return (
                  <TableRow key={doc.id}>
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selected.has(doc.id)}
                        onCheckedChange={() => toggleOne(doc.id)}
                        aria-label={`Seleccionar ${doc.nombreArchivo}`}
                      />
                    </TableCell>
                    {!employeeId && (
                      <TableCell>
                        <div className="font-medium">{doc.employee.apellido}, {doc.employee.nombre}</div>
                        <div className="text-xs text-muted-foreground">{doc.employee.legajo}</div>
                      </TableCell>
                    )}
                    {esRecibo !== false && (
                      <TableCell className="font-mono">{doc.periodo ?? '—'}</TableCell>
                    )}
                    {esRecibo !== true && (
                      <TableCell>
                        {doc.tipoDocumento
                          ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 dark:bg-green-950 dark:text-green-400 dark:border-green-800">{doc.tipoDocumento.nombre}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    <TableCell>
                      <a href={`/api/documentos/${doc.id}/archivo`} target="_blank" className="flex items-center gap-1 text-green-700 dark:text-green-400 hover:underline text-sm">
                        <FileText size={14} /> {doc.nombreArchivo}
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-1.5 flex-wrap">
                        <StatusBadge estado={doc.estado} accion={doc.tipoDocumento?.accion} />
                        {doc.estado === 'FIRMADO' && doc.firmaConforme === true && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300" title="Firmado conforme">Conforme</span>
                        )}
                        {doc.estado === 'FIRMADO' && doc.firmaConforme === false && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" title="Firmado no conforme">No conforme</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(doc.fechaCarga).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {(() => {
                        const accion = doc.tipoDocumento?.accion ?? 'FIRMA'
                        if (accion === 'NINGUNA') return null
                        if (accion === 'LECTURA') {
                          if (doc.estado === 'BORRADOR' || doc.estado === 'ERROR')
                            return <Button size="sm" variant="outline" className="text-blue-600" onClick={() => handleSendToSign(doc.id)} disabled={sending === doc.id}><Send size={14} className="mr-1" />{sending === doc.id ? '...' : 'Enviar'}</Button>
                          return null
                        }
                        return <>
                          {(doc.estado === 'BORRADOR' || doc.estado === 'ERROR') && (
                            <Button size="sm" variant="outline" className="text-blue-600" onClick={() => handleSendToSign(doc.id)} disabled={sending === doc.id}>
                              <Send size={14} className="mr-1" />{sending === doc.id ? '...' : 'Enviar'}
                            </Button>
                          )}
                          {doc.estado === 'ENVIADO_A_FIRMA' && doc.firmaExternalId && (
                            <Button size="sm" variant="outline" onClick={() => handleCheckStatus(doc.id)}>
                              <RefreshCw size={14} className="mr-1" />Estado
                            </Button>
                          )}
                        </>
                      })()}
                      <Button size="sm" variant="destructive" onClick={() => setDeleteId(doc.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between px-1 pt-2">
          <p className="text-xs text-muted-foreground">{total} documentos</p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</Button>
            <span className="text-xs px-2">{page} / {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</Button>
          </div>
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El archivo será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={open => { if (!open && !bulkDeleting) setBulkDeleteOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selected.size} documento{selected.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los archivos serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {uploadOpen && <DocumentoUploadDialog open onClose={() => setUploadOpen(false)} onSaved={load} esRecibo={esRecibo} employeeId={employeeId} />}
      {cargarOpen && <DocumentoCargarDialog open onClose={() => setCargarOpen(false)} onSaved={load} />}
    </div>
  )
}
