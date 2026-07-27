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
import { Pencil, Trash2, Plus, Search, SlidersHorizontal, X, Download, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BloqueoEliminacionDialog } from '@/components/shared/BloqueoEliminacionDialog'

interface Categoria { id: number; nombre: string }
interface Empleado {
  id: number; legajo: string; nombre: string; apellido: string; cuil: string
  email: string; telefono?: string; fechaIngreso: string; estado: string
  categoria: { nombre: string }; categoriaId: number
  _count?: { solicitudesModificacion: number }
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
  const [cats, setCats] = useState<Categoria[]>([])
  const [page, setPage] = useState(() => Number(searchParams.get('page') ?? '1') || 1)
  const [dialog, setDialog] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; legajo: string } | null>(null)
  const [blockedDelete, setBlockedDelete] = useState<{ id: number; legajo: string; dependencias: { label: string; count: number; href: string }[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => {
    fetch('/api/categorias').then(r => r.json()).then(setCats)
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
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [qDebounced, estado, categoriaId, page, pathname, router])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ q: qDebounced, page: String(page) })
    if (estado) params.set('estado', estado)
    if (categoriaId) params.set('categoriaId', categoriaId)
    fetch(`/api/empleados?${params}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [qDebounced, estado, categoriaId, page])

  useEffect(() => { load() }, [load])

  // Al cambiar de página o filtros, limpiar selección
  useEffect(() => { setSelected(new Set()) }, [qDebounced, estado, categoriaId, page])

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
      'Categoría': e.categoria.nombre, 'Estado': e.estado,
      'Fecha Ingreso': e.fechaIngreso,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Empleados')
    XLSX.writeFile(wb, `empleados_seleccionados.xlsx`)
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    setBulkDeleting(true)
    let ok = 0, fail = 0
    for (const id of selected) {
      const res = await fetch(`/api/empleados/${id}`, { method: 'DELETE' })
      if (res.ok) ok++
      else fail++
    }
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    setSelected(new Set())
    if (ok > 0) toast.success(`${ok} empleado(s) eliminado(s)`)
    if (fail > 0) toast.error(`${fail} no se pudo(ieron) eliminar (tienen datos asociados)`)
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
    categoriaId && { key: 'cat', label: cats.find(c => String(c.id) === categoriaId)?.nombre ?? '', clear: () => { setCategoriaId(''); setPage(1) } },
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

                {filterCount > 0 && (
                  <button
                    onClick={() => { setEstado(''); setCategoriaId(''); setPage(1) }}
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
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30"
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
          onClick={async () => {
            const rows = await fetch('/api/empleados/export').then(r => r.json())
            const ws = XLSX.utils.json_to_sheet(rows.map((e: Record<string, string>) => ({
              'Legajo': e.legajo, 'Apellido': e.apellido, 'Nombre': e.nombre,
              'CUIL': e.cuil, 'Email': e.email, 'Teléfono': e.telefono,
              'Categoría': e.categoria, 'Estado': e.estado, 'Fecha Ingreso': e.fechaIngreso,
            })))
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Empleados')
            XLSX.writeFile(wb, 'legajos.xlsx')
          }}
        >
          <Download size={14} className="mr-1" /> Exportar
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
            onClick={() => { setEstado(''); setCategoriaId(''); setPage(1) }}
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
                <TableHead>Legajo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>CUIL</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
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
                    <span className="flex items-center gap-2">
                      {emp.apellido}, {emp.nombre}
                      {(emp._count?.solicitudesModificacion ?? 0) > 0 && (
                        <span className="h-2 w-2 rounded-full bg-yellow-400 shrink-0" title="Solicitud de modificación pendiente" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{emp.cuil}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{emp.email}</TableCell>
                  <TableCell>{emp.categoria.nombre}</TableCell>
                  <TableCell>
                    <Badge variant={emp.estado === 'ACTIVO' ? 'default' : 'secondary'} className={emp.estado === 'ACTIVO' ? 'bg-green-600' : ''}>
                      {emp.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={e => { e.stopPropagation(); router.push(`/admin/empleados/${emp.id}`) }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={e => { e.stopPropagation(); setDeleteTarget({ id: emp.id, legajo: emp.legajo }) }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{data.total} empleado{data.total !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</Button>
              <span className="px-2">Página {page} de {data.pages}</span>
              <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>→</Button>
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
    </div>
  )
}
