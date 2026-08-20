'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/apiErrors'
import { Popover } from '@base-ui/react/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmpleadoDialog } from './EmpleadoDialog'
import { ImportEmpleadosDialog } from './ImportEmpleadosDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Trash2, Plus, Search, SlidersHorizontal, X, Download, Upload, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import { formatearCuil } from '@/lib/cuil'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import * as XLSX from 'xlsx'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BloqueoEliminacionDialog } from '@/components/shared/BloqueoEliminacionDialog'
import { AvatarDisplay } from '@/components/shared/AvatarDisplay'

interface Categoria { id: number; nombre: string }
interface Area { id: number; nombre: string }
interface Empleado {
  id: number; legajo: string; nombre: string; apellido: string; cuil: string
  email: string; telefono?: string; fechaIngreso: string; estado: string
  puesto?: string | null
  area?: { nombre: string } | null; areaId?: number
  categoria: { nombre: string }; categoriaId: number
  user?: {
    avatarUrl: string | null; avatarBgColor: string | null; avatarTextColor: string | null
    manager?: { employee: { nombre: string; apellido: string } | null } | null
  } | null
  _count?: { solicitudesModificacion: number }
}

function SortableHead({ campo, label, sortBy, sortOrder, onSort }: {
  campo: string; label: string; sortBy: string; sortOrder: 'asc' | 'desc'; onSort: (c: string) => void
}) {
  const active = sortBy === campo
  const Icon = active ? (sortOrder === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown
  return (
    <TableHead>
      <button
        onClick={() => onSort(campo)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground transition-colors',
          active ? 'text-foreground font-semibold' : 'text-muted-foreground'
        )}
      >
        {label}
        <Icon size={12} className={active ? '' : 'opacity-40'} />
      </button>
    </TableHead>
  )
}

export function EmpleadosTable() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [data, setData] = useState<{ employees: Empleado[]; total: number; pages: number }>({ employees: [], total: 0, pages: 1 })
  const [q, setQ] = useState(() => searchParams.get('q') ?? '')
  const [qDebounced, setQDebounced] = useState(q)
  const [estado, setEstado] = useState(() => searchParams.get('estado') ?? '')
  const [categoriaId, setCategoriaId] = useState(() => searchParams.get('categoriaId') ?? '')
  const [areaId, setAreaId] = useState(() => searchParams.get('areaId') ?? '')
  const [sinAcceso, setSinAcceso] = useState(() => searchParams.get('sinAcceso') === 'true')
  const [cats, setCats] = useState<Categoria[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [page, setPage] = useState(() => Number(searchParams.get('page') ?? '1') || 1)
  const [pageSize, setPageSize] = useState<number>(() => {
    const l = Number(searchParams.get('limit') ?? '20')
    return [20, 50, 100].includes(l) ? l : 20
  })
  const [sortBy, setSortBy] = useState<string>(() => searchParams.get('sortBy') ?? 'apellido')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => (searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'))
  const [dialog, setDialog] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; legajo: string } | null>(null)
  const [blockedDelete, setBlockedDelete] = useState<{ id: number; legajo: string; dependencias: { label: string; count: number; href: string }[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteErrorsOpen, setBulkDeleteErrorsOpen] = useState(false)
  const [bulkDeleteErrors, setBulkDeleteErrors] = useState<Array<{ ok: false; emp: Empleado; status: number; error: string; dependencias: { label: string; count: number }[] }>>([])

  useEffect(() => {
    fetch('/api/categorias').then(r => r.json()).then(setCats)
    fetch('/api/areas').then(r => r.json()).then(setAreas)
  }, [])

  // Debounce del input de búsqueda (300ms)
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300)
    return () => clearTimeout(t)
  }, [q])

  // Sincronizar filtros con la URL (usando qDebounced, no q, para no ensuciar el historial en cada tecla)
  useEffect(() => {
    const params = new URLSearchParams()
    if (qDebounced) params.set('q', qDebounced)
    if (estado) params.set('estado', estado)
    if (categoriaId) params.set('categoriaId', categoriaId)
    if (areaId) params.set('areaId', areaId)
    if (sinAcceso) params.set('sinAcceso', 'true')
    if (page > 1) params.set('page', String(page))
    if (pageSize !== 20) params.set('limit', String(pageSize))
    if (sortBy !== 'apellido') params.set('sortBy', sortBy)
    if (sortOrder !== 'asc') params.set('sortOrder', sortOrder)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [qDebounced, estado, categoriaId, areaId, sinAcceso, page, pageSize, sortBy, sortOrder, pathname, router])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ q: qDebounced, page: String(page), limit: String(pageSize) })
    if (estado) params.set('estado', estado)
    if (categoriaId) params.set('categoriaId', categoriaId)
    if (areaId) params.set('areaId', areaId)
    if (sinAcceso) params.set('sinAcceso', 'true')
    params.set('sortBy', sortBy)
    params.set('sortOrder', sortOrder)
    fetch(`/api/empleados?${params}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [qDebounced, estado, categoriaId, areaId, sinAcceso, page, pageSize, sortBy, sortOrder])

  useEffect(() => { load() }, [load])

  // Al cambiar de página o filtros, limpiar selección
  useEffect(() => { setSelected(new Set()) }, [qDebounced, estado, categoriaId, sinAcceso, page, pageSize, sortBy, sortOrder])

  function toggleSort(campo: string) {
    if (sortBy === campo) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(campo); setSortOrder('asc') }
    setPage(1)
  }

  const allSelected = data.employees.length > 0 && data.employees.every(e => selected.has(e.id))
  const someSelected = selected.size > 0 && !allSelected
  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(data.employees.map(e => e.id)))
  }

  async function handleBulkExport() {
    if (selected.size === 0) return
    const empsSel = data.employees.filter(e => selected.has(e.id))
    const ws = XLSX.utils.json_to_sheet(empsSel.map(e => ({
      'Legajo': e.legajo, 'Apellido': e.apellido, 'Nombre': e.nombre,
      'CUIL': e.cuil, 'Email': e.email, 'Teléfono': e.telefono ?? '',
      'Área': e.area?.nombre ?? '', 'Categoría': e.categoria.nombre,
      'Puesto': e.puesto ?? '', 'Estado': e.estado,
      'Fecha Ingreso': e.fechaIngreso,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Empleados')
    XLSX.writeFile(wb, `empleados_seleccionados.xlsx`)
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    setBulkDeleting(true)
    const empsSel = data.employees.filter(e => selected.has(e.id))
    const results = await Promise.all(
      empsSel.map(async emp => {
        const res = await fetch(`/api/empleados/${emp.id}`, { method: 'DELETE' })
        if (res.ok) return { ok: true as const, emp }
        const body = await res.clone().json().catch(() => ({}))
        return {
          ok: false as const,
          emp,
          status: res.status,
          error: body?.error ?? `Error ${res.status}`,
          dependencias: Array.isArray(body?.dependencias) ? body.dependencias as { label: string; count: number }[] : [],
        }
      })
    )
    const ok = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok) as Array<{ ok: false; emp: Empleado; status: number; error: string; dependencias: { label: string; count: number }[] }>
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    setSelected(new Set())
    if (ok > 0) toast.success(`${ok} empleado(s) eliminado(s)`)
    if (failed.length > 0) {
      setBulkDeleteErrors(failed)
      setBulkDeleteErrorsOpen(true)
    }
    load()
  }

  async function doDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    const res = await fetch(`/api/empleados/${target.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    if (!res.ok) {
      const data = await res.clone().json().catch(() => ({}))
      if (res.status === 409 && Array.isArray(data.dependencias)) {
        setBlockedDelete({ id: target.id, legajo: target.legajo, dependencias: data.dependencias })
        return
      }
      await handleApiError(res, href => router.push(href))
      return
    }
    toast.success('Empleado eliminado')
    load()
  }

  const activeFilters = [
    estado && { key: 'estado', label: estado === 'ACTIVO' ? 'Activo' : 'Inactivo', clear: () => { setEstado(''); setPage(1) } },
    areaId && { key: 'area', label: areas.find(a => String(a.id) === areaId)?.nombre ?? '', clear: () => { setAreaId(''); setPage(1) } },
    categoriaId && { key: 'cat', label: cats.find(c => String(c.id) === categoriaId)?.nombre ?? '', clear: () => { setCategoriaId(''); setPage(1) } },
    sinAcceso && { key: 'sinAcceso', label: 'Sin acceso al sistema', clear: () => { setSinAcceso(false); setPage(1) } },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]

  const filterCount = activeFilters.length

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, legajo, CUIL, email..."
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
          />
        </div>

        {/* Filter popover */}
        <Popover.Root>
          <Popover.Trigger
            className={cn(
              'inline-flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium transition-colors',
              'bg-background hover:bg-muted border-input',
              filterCount > 0 && 'border-green-600 text-green-700 dark:text-green-400',
            )}
          >
            <SlidersHorizontal size={15} />
            Filtros
            {filterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">
                {filterCount}
              </span>
            )}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="start" sideOffset={6}>
              <Popover.Popup className="z-50 w-64 rounded-xl border bg-background shadow-lg p-4 space-y-4 outline-none">
                {/* Estado */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</p>
                  <div className="flex gap-2">
                    {['', 'ACTIVO', 'INACTIVO'].map(v => (
                      <button
                        key={v}
                        onClick={() => { setEstado(v); setPage(1) }}
                        className={cn(
                          'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                          estado === v
                            ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                            : 'border-input hover:bg-muted text-muted-foreground',
                        )}
                      >
                        {v === '' ? 'Todos' : v === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Área */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Área</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => { setAreaId(''); setPage(1) }}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        areaId === ''
                          ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                          : 'border-input hover:bg-muted text-muted-foreground',
                      )}
                    >
                      Todas
                    </button>
                    {areas.map(a => (
                      <button
                        key={a.id}
                        onClick={() => { setAreaId(String(a.id)); setPage(1) }}
                        className={cn(
                          'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                          areaId === String(a.id)
                            ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                            : 'border-input hover:bg-muted text-muted-foreground',
                        )}
                      >
                        {a.nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categoría */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoría</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => { setCategoriaId(''); setPage(1) }}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        categoriaId === ''
                          ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                          : 'border-input hover:bg-muted text-muted-foreground',
                      )}
                    >
                      Todas
                    </button>
                    {cats.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setCategoriaId(String(c.id)); setPage(1) }}
                        className={cn(
                          'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                          categoriaId === String(c.id)
                            ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                            : 'border-input hover:bg-muted text-muted-foreground',
                        )}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sin acceso al sistema */}
                <div className="space-y-2 border-t pt-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sinAcceso}
                      onChange={e => { setSinAcceso(e.target.checked); setPage(1) }}
                      className="w-3.5 h-3.5 accent-green-700"
                    />
                    <span className="font-medium">Solo sin acceso al sistema</span>
                  </label>
                </div>

                {filterCount > 0 && (
                  <button
                    onClick={() => { setEstado(''); setCategoriaId(''); setAreaId(''); setSinAcceso(false); setPage(1) }}
                    className="w-full rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Limpiar filtros
                  </button>
                )}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>

        {selected.size > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={handleBulkExport}>
              <Download size={14} className="mr-1" /> Exportar {selected.size}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 dark:border-red-900 dark:hover:bg-red-950/30"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 size={14} className="mr-1" /> Eliminar {selected.size}
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          title={filterCount > 0 || qDebounced ? 'Exportar con los filtros actuales' : 'Exportar todos'}
          onClick={async () => {
            const params = new URLSearchParams()
            if (qDebounced) params.set('q', qDebounced)
            if (estado) params.set('estado', estado)
            if (categoriaId) params.set('categoriaId', categoriaId)
            if (areaId) params.set('areaId', areaId)
            const qs = params.toString()
            const data = await fetch(`/api/empleados/export${qs ? `?${qs}` : ''}`).then(r => r.json())
            const campos: Array<{ nombre: string }> = data.campos ?? []
            const rows: Array<Record<string, string> & { valores?: Record<string, string> }> = data.rows ?? data ?? []
            const ws = XLSX.utils.json_to_sheet(rows.map(e => {
              const base: Record<string, string> = {
                'Legajo': e.legajo, 'Apellido': e.apellido, 'Nombre': e.nombre,
                'CUIL': e.cuil, 'Email': e.email, 'Teléfono': e.telefono,
                'Área': (e as Record<string, string>).area ?? '',
                'Categoría': e.categoria,
                'Puesto': (e as Record<string, string>).puesto ?? '',
                'Estado': e.estado, 'Fecha Ingreso': e.fechaIngreso,
              }
              for (const c of campos) base[c.nombre] = e.valores?.[c.nombre] ?? ''
              return base
            }))
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Empleados')
            XLSX.writeFile(wb, filterCount > 0 || qDebounced ? 'legajos_filtrados.xlsx' : 'legajos.xlsx')
          }}
        >
          <Download size={14} className="mr-1" />
          {filterCount > 0 || qDebounced ? 'Exportar filtrados' : 'Exportar'}
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload size={14} className="mr-1" /> Importar
        </Button>
        <Button className="bg-green-700 hover:bg-green-800 shrink-0" onClick={() => setDialog(true)}>
          <Plus size={15} className="mr-1" /> Nuevo
        </Button>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map(f => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-500/15 dark:text-green-300"
            >
              {f.label}
              <button onClick={f.clear} className="hover:text-green-900 dark:hover:text-green-200 ml-0.5">
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            onClick={() => { setEstado(''); setCategoriaId(''); setAreaId(''); setSinAcceso(false); setPage(1) }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <SortableHead campo="legajo" label="Legajo" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} />
                <SortableHead campo="apellido" label="Nombre" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} />
                <TableHead>CUIL</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Área</TableHead>
                <SortableHead campo="categoria" label="Categoría" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} />
                <TableHead>Puesto</TableHead>
                <TableHead>Reporta a</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-muted-foreground text-sm">
                    No se encontraron empleados
                  </TableCell>
                </TableRow>
              ) : data.employees.map(emp => (
                <TableRow
                  key={emp.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/empleados/${emp.id}`)}
                >
                  <TableCell className="w-10" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(emp.id)}
                      onCheckedChange={() => toggleOne(emp.id)}
                      aria-label={`Seleccionar ${emp.apellido}, ${emp.nombre}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{emp.legajo}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <AvatarDisplay
                        nombre={`${emp.nombre} ${emp.apellido}`}
                        iniciales={`${emp.nombre[0] ?? ''}${emp.apellido[0] ?? ''}`}
                        avatarUrl={emp.user?.avatarUrl ?? null}
                        bgColor={emp.user?.avatarBgColor ?? null}
                        textColor={emp.user?.avatarTextColor ?? null}
                        size={28}
                      />
                      <span>{emp.apellido}, {emp.nombre}</span>
                      {(emp._count?.solicitudesModificacion ?? 0) > 0 && (
                        <span className="h-2 w-2 rounded-full bg-yellow-400 shrink-0" title="Solicitud de modificación pendiente" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{emp.cuil ? formatearCuil(emp.cuil) : ''}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{emp.email}</TableCell>
                  <TableCell className="text-sm">{emp.area?.nombre ?? <span className="text-muted-foreground italic">—</span>}</TableCell>
                  <TableCell>{emp.categoria.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[160px]">
                    {emp.puesto ?? <span className="italic text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[180px]">
                    {emp.user?.manager?.employee
                      ? `${emp.user.manager.employee.apellido}, ${emp.user.manager.employee.nombre}`
                      : <span className="italic text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={emp.estado === 'ACTIVO' ? 'default' : 'secondary'} className={emp.estado === 'ACTIVO' ? 'bg-green-600' : ''}>
                      {emp.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-red-600"
                      onClick={e => { e.stopPropagation(); setDeleteTarget({ id: emp.id, legajo: emp.legajo }) }}
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground gap-3 flex-wrap">
            <span>{data.total} empleado{data.total !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">Por página</span>
                <Select value={String(pageSize)} onValueChange={v => { if (v) { setPageSize(Number(v)); setPage(1) } }}>
                  <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</Button>
                <span className="px-2">Página {page} de {data.pages}</span>
                <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>→</Button>
              </div>
            </div>
          </div>
        </>
      )}

      {dialog && (
        <EmpleadoDialog
          open
          onClose={() => { setDialog(false); load() }}
          onSaved={() => { toast.success('Empleado guardado'); load() }}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`¿Eliminar empleado ${deleteTarget?.legajo}?`}
        description="Si tiene un usuario asociado, también se eliminará. Esta acción no se puede deshacer."
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ImportEmpleadosDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
      <BloqueoEliminacionDialog
        open={!!blockedDelete}
        onClose={() => setBlockedDelete(null)}
        title={blockedDelete ? `No se puede eliminar el empleado ${blockedDelete.legajo}` : ''}
        dependencias={blockedDelete?.dependencias ?? []}
        suggest="También podés marcarlo como INACTIVO en su lugar."
        forceDeleteUrl={blockedDelete ? `/api/empleados/${blockedDelete.id}` : undefined}
        confirmToken={blockedDelete?.legajo}
        onDeleted={load}
      />
      <AlertDialog open={bulkDeleteOpen} onOpenChange={open => { if (!open && !bulkDeleting) setBulkDeleteOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selected.size} empleado{selected.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Los que tengan datos asociados (documentos, solicitudes, etc.) no se podrán eliminar.
              Esta acción no se puede deshacer.
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

      <Dialog open={bulkDeleteErrorsOpen} onOpenChange={setBulkDeleteErrorsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Eliminación incompleta</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-2">
            {bulkDeleteErrors.length === 1
              ? '1 empleado no pudo eliminarse.'
              : `${bulkDeleteErrors.length} empleados no pudieron eliminarse.`}
          </div>
          <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
            {bulkDeleteErrors.map(f => (
              <div key={f.emp.id} className="p-2 text-xs">
                <div className="font-medium">{f.emp.apellido}, {f.emp.nombre} ({f.emp.legajo})</div>
                {f.dependencias.length > 0 ? (
                  <ul className="text-red-600 dark:text-red-400 list-disc list-inside">
                    {f.dependencias.map((d, i) => <li key={i}>{d.label}: {d.count}</li>)}
                  </ul>
                ) : (
                  <div className="text-red-600 dark:text-red-400">{f.error}</div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteErrorsOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
