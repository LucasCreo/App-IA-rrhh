'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText, BookOpen, Pen, Download, Search, Eye, Tag, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination, paginate } from '@/components/ui/pagination'
import { FirmarDocumentoDialog } from '@/components/empleado/FirmarDocumentoDialog'
import { ArchivoPreviewDialog } from '@/components/shared/ArchivoPreviewDialog'
import { cn } from '@/lib/utils'

interface AsignacionApi {
  id: number
  estado: string
  firmaConforme: boolean | null
  fechaCarga: string
  fechaFirma?: string
  grupo: {
    id: number
    nombreArchivo: string
    periodo: string | null
    tipoDocumento?: { nombre: string; accion: string } | null
  }
}

type Item = { kind: 'doc'; key: string; fecha: string; titulo: string; subtitulo?: string | null; pendiente: boolean; asign: AsignacionApi }

interface Props {
  /** Si se pasa, actúa como vista admin del legajo (usa ?employeeId=X). Si no, es la vista del empleado logueado. */
  employeeId?: number
}

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendientes', label: 'Pendientes' },
] as const
type Filtro = typeof FILTROS[number]['value']

export function MisDocumentos({ employeeId }: Props) {
  const [asigns, setAsigns] = useState<AsignacionApi[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'' | 'pendiente' | 'firmado' | 'rechazado'>('')
  const [desde, setDesde] = useState<string>('')
  const [hasta, setHasta] = useState<string>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [acting, setActing] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [preview, setPreview] = useState<{ grupoId: number; nombre: string } | null>(null)

  useEffect(() => { setPage(1) }, [filtro, busqueda, estadoFiltro, desde, hasta])

  const activeFiltersCount =
    (filtro !== 'todos' ? 1 : 0) +
    (estadoFiltro ? 1 : 0) +
    (desde ? 1 : 0) +
    (hasta ? 1 : 0)

  function clearAllFilters() {
    setFiltro('todos'); setEstadoFiltro(''); setDesde(''); setHasta('')
  }

  const [firmaAsign, setFirmaAsign] = useState<AsignacionApi | null>(null)

  function load() {
    setLoading(true)
    const url = employeeId ? `/api/asignaciones/mis?employeeId=${employeeId}` : `/api/asignaciones/mis`
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => setAsigns(d.asignaciones ?? []))
      .catch(() => toast.error('No se pudieron cargar los documentos'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [employeeId])

  async function marcarLeido(id: number) {
    setActing(id)
    const res = await fetch(`/api/asignaciones/${id}/marcar-leido`, { method: 'POST' })
    setActing(null)
    if (res.ok) { toast.success('Documento marcado como leído'); load() }
    else toast.error('Error al marcar como leído')
  }

  const items: Item[] = asigns.map<Item>(a => ({
    kind: 'doc',
    key: `asign-${a.id}`,
    fecha: a.fechaCarga,
    titulo: a.grupo.tipoDocumento?.nombre ?? a.grupo.nombreArchivo,
    subtitulo: a.grupo.periodo ? `Período ${a.grupo.periodo}` : a.grupo.nombreArchivo,
    pendiente: a.estado === 'ENVIADO_A_FIRMA',
    asign: a,
  }))

  function estadoMatch(item: Item, target: typeof estadoFiltro): boolean {
    if (!target) return true
    if (target === 'pendiente') return item.pendiente
    if (target === 'firmado') return item.asign.estado === 'FIRMADO'
    if (target === 'rechazado') return item.asign.estado === 'RECHAZADO'
    return true
  }

  const q = busqueda.trim().toLowerCase()

  const rangoInvalido = !!desde && !!hasta && hasta < desde
  const filtered = (rangoInvalido ? [] : items).filter(i => {
    if (filtro === 'pendientes' && !i.pendiente) return false
    if (!estadoMatch(i, estadoFiltro)) return false
    const fecha = i.fecha.slice(0, 10)
    if (desde && fecha < desde) return false
    if (hasta && fecha > hasta) return false
    if (q) {
      const hay = `${i.titulo} ${i.subtitulo ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    if (a.pendiente !== b.pendiente) return a.pendiente ? -1 : 1
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por título…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
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
      </div>

      {filtersOpen && (
        <div className="flex flex-wrap gap-3 items-end p-4 bg-muted/30 border border-border rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Vista</p>
            <Select value={filtro} onValueChange={v => v && setFiltro(v as Filtro)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" alignItemWithTrigger={false}>
                {FILTROS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Estado</p>
            <Select value={estadoFiltro || 'todos'} onValueChange={v => setEstadoFiltro(!v || v === 'todos' ? '' : (v as typeof estadoFiltro))}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent side="bottom" alignItemWithTrigger={false}>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="firmado">Firmado / Completado</SelectItem>
                <SelectItem value="rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Desde</p>
            <Input type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Hasta</p>
            <Input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} className="h-9 w-40" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <FileText size={32} strokeWidth={1.2} />
          <p className="text-sm">{rangoInvalido ? 'La fecha "Desde" no puede ser posterior a "Hasta"' : 'Sin resultados'}</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Documento</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Fecha</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginate(filtered, page, pageSize).map(item => {
                const accion = item.asign.grupo.tipoDocumento?.accion
                const url = `/api/documentos-grupos/${item.asign.grupo.id}/archivo`
                return (
                  <tr key={item.key} className="border-t hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2 font-medium min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={13} className="text-muted-foreground shrink-0" />
                        <span className="truncate" title={item.titulo}>{item.titulo}</span>
                      </div>
                      {item.subtitulo && (
                        <p className="text-[11px] text-muted-foreground pl-5 truncate">{item.subtitulo}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      {item.asign.grupo.tipoDocumento?.nombre ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          <Tag size={10} />
                          {item.asign.grupo.tipoDocumento.nombre}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(item.fecha).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge estado={item.asign.estado} accion={accion} pov="empleado" />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {accion === 'LECTURA' && item.asign.estado === 'ENVIADO_A_FIRMA' && (
                          <Button
                            size="sm"
                            className="bg-green-700 hover:bg-green-800 text-white h-7 text-xs"
                            disabled={acting === item.asign.id}
                            onClick={() => marcarLeido(item.asign.id)}
                          >
                            <BookOpen size={12} className="mr-1" />
                            {acting === item.asign.id ? '...' : 'Marcar leído'}
                          </Button>
                        )}
                        {accion === 'FIRMA' && item.asign.estado === 'ENVIADO_A_FIRMA' && (
                          <Button
                            size="sm"
                            className="bg-green-700 hover:bg-green-800 text-white h-7 text-xs"
                            onClick={() => setFirmaAsign(item.asign)}
                          >
                            <Pen size={12} className="mr-1" /> Firmar
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          className={`h-7 w-7 p-0 ${preview?.grupoId === item.asign.grupo.id ? 'bg-muted' : ''}`}
                          onClick={() => setPreview({ grupoId: item.asign.grupo.id, nombre: item.asign.grupo.nombreArchivo })}
                          title="Ver archivo"
                          aria-label="Ver archivo"
                        >
                          <Eye size={13} />
                        </Button>
                        <a href={url} download={item.asign.grupo.nombreArchivo} aria-label="Descargar documento">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Descargar" aria-label="Descargar documento">
                            <Download size={13} />
                          </Button>
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <Pagination
          page={page} pageSize={pageSize} total={filtered.length}
          itemLabel="documentos"
          onPageChange={setPage} onPageSizeChange={setPageSize}
        />
      )}

      <FirmarDocumentoDialog
        open={firmaAsign !== null}
        docId={firmaAsign?.id ?? null}
        endpoint="asignaciones"
        archivoUrl={firmaAsign ? `/api/documentos-grupos/${firmaAsign.grupo.id}/archivo` : undefined}
        titulo="Firmar documento"
        descripcion={firmaAsign?.grupo.tipoDocumento?.nombre ?? firmaAsign?.grupo.nombreArchivo ?? ''}
        onClose={() => setFirmaAsign(null)}
        onFirmado={load}
      />

      <ArchivoPreviewDialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        url={preview ? `/api/documentos-grupos/${preview.grupoId}/archivo` : null}
        filename={preview?.nombre ?? null}
      />
    </div>
  )
}
