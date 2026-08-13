'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Download, BookOpen, Pen, Search, X } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination, paginate } from '@/components/ui/pagination'
import { FirmarDocumentoDialog } from '@/components/empleado/FirmarDocumentoDialog'
import { cn } from '@/lib/utils'

interface Doc {
  id: number; nombreArchivo: string; periodo: string | null; estado: string
  fechaCarga: string; fechaFirma?: string
  firmaConforme?: boolean | null
  firmaComentario?: string | null
  tipoDocumento?: { accion: string } | null
}

type Filtro = 'TODOS' | 'PENDIENTES' | 'CONFORMES' | 'NO_CONFORMES'
type Orden = 'DESC' | 'ASC'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function formatPeriodo(p: string | null): string {
  if (!p) return '—'
  const [year, month] = p.split('-')
  const m = parseInt(month)
  if (!year || Number.isNaN(m) || m < 1 || m > 12) return p
  return `${MESES[m - 1]} ${year}`
}

interface Props { employeeId: number }

export function MisRecibos({ employeeId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<number | null>(null)
  const [firmaDoc, setFirmaDoc] = useState<Doc | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [anio, setAnio] = useState<string>('')
  const [mes, setMes] = useState<string>('')
  const [orden, setOrden] = useState<Orden>('DESC')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => { setPage(1) }, [filtro, busqueda, anio, mes, orden])

  function load() {
    setLoading(true)
    fetch(`/api/documentos?employeeId=${employeeId}&recibo=true`)
      .then(r => r.json())
      .then(data => setDocs(data.docs ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [employeeId])

  const counts = useMemo(() => ({
    TODOS: docs.length,
    PENDIENTES: docs.filter(d => d.estado === 'ENVIADO_A_FIRMA').length,
    CONFORMES: docs.filter(d => d.estado === 'FIRMADO' && d.firmaConforme === true).length,
    NO_CONFORMES: docs.filter(d => d.estado === 'FIRMADO' && d.firmaConforme === false).length,
  }), [docs])

  const aniosDisponibles = useMemo(() => {
    const s = new Set<string>()
    for (const d of docs) {
      if (d.periodo) {
        const y = d.periodo.split('-')[0]
        if (y && /^\d{4}$/.test(y)) s.add(y)
      }
    }
    return [...s].sort((a, b) => Number(b) - Number(a))
  }, [docs])

  const filteredDocs = useMemo(() => {
    let out = docs
    if (filtro === 'PENDIENTES') out = out.filter(d => d.estado === 'ENVIADO_A_FIRMA')
    else if (filtro === 'CONFORMES') out = out.filter(d => d.estado === 'FIRMADO' && d.firmaConforme === true)
    else if (filtro === 'NO_CONFORMES') out = out.filter(d => d.estado === 'FIRMADO' && d.firmaConforme === false)

    const q = busqueda.trim().toLowerCase()
    if (q) out = out.filter(d => {
      const hay = `${d.nombreArchivo} ${d.periodo ?? ''} ${formatPeriodo(d.periodo)}`.toLowerCase()
      return hay.includes(q)
    })
    if (anio) out = out.filter(d => d.periodo?.startsWith(`${anio}-`))
    if (mes) out = out.filter(d => d.periodo?.split('-')[1] === mes)

    out = [...out].sort((a, b) => {
      const va = a.periodo ?? a.fechaCarga
      const vb = b.periodo ?? b.fechaCarga
      return orden === 'DESC' ? vb.localeCompare(va) : va.localeCompare(vb)
    })

    return out
  }, [docs, filtro, busqueda, anio, mes, orden])

  const hasActiveFilters = !!busqueda || !!anio || !!mes || orden !== 'DESC'
  function clearFilters() { setBusqueda(''); setAnio(''); setMes(''); setOrden('DESC') }

  const chips: { key: Filtro; label: string }[] = [
    { key: 'TODOS', label: 'Todos' },
    { key: 'PENDIENTES', label: 'Pendientes de firma' },
    { key: 'CONFORMES', label: 'Conformes' },
    { key: 'NO_CONFORMES', label: 'No conformes' },
  ]

  async function marcarLeido(id: number) {
    setMarking(id)
    const res = await fetch(`/api/documentos/${id}/marcar-leido`, { method: 'POST' })
    if (res.ok) { toast.success('Documento marcado como leído'); load() }
    else toast.error('Error al marcar como leído')
    setMarking(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por período o archivo…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={anio || 'todos'} onValueChange={v => setAnio(!v || v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent side="bottom" alignItemWithTrigger={false}>
            <SelectItem value="todos">Todos los años</SelectItem>
            {aniosDisponibles.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mes || 'todos'} onValueChange={v => setMes(!v || v === 'todos' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent side="bottom" alignItemWithTrigger={false}>
            <SelectItem value="todos">Todos los meses</SelectItem>
            {MESES.map((m, idx) => (
              <SelectItem key={m} value={String(idx + 1).padStart(2, '0')}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={orden} onValueChange={v => v && setOrden(v as Orden)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent side="bottom" alignItemWithTrigger={false}>
            <SelectItem value="DESC">Más nuevos primero</SelectItem>
            <SelectItem value="ASC">Más viejos primero</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X size={12} className="mr-1" /> Limpiar
          </Button>
        )}
      </div>

      <div className="flex gap-1 flex-wrap">
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => setFiltro(c.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50',
              filtro === c.key
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
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <FileText size={32} strokeWidth={1.2} />
          <p className="text-sm">
            {docs.length === 0
              ? 'No tenés recibos cargados aún.'
              : filtro === 'PENDIENTES' ? 'No tenés recibos pendientes de firma.'
              : filtro === 'CONFORMES' ? 'No firmaste ningún recibo como conforme aún.'
              : filtro === 'NO_CONFORMES' ? 'No hay recibos firmados como no conformes.'
              : 'Sin resultados para los filtros aplicados.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabla */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cargado</TableHead>
                  <TableHead>Firmado el</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginate(filteredDocs, page, pageSize).map(doc => {
                  const accion = doc.tipoDocumento?.accion
                  const pendienteFirma = accion === 'FIRMA' && doc.estado === 'ENVIADO_A_FIRMA'
                  const pendienteLectura = accion === 'LECTURA' && doc.estado === 'ENVIADO_A_FIRMA'
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>{formatPeriodo(doc.periodo)}</TableCell>
                      <TableCell>{doc.nombreArchivo}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5">
                          <StatusBadge estado={doc.estado} accion={accion} pov="empleado" />
                          {doc.estado === 'FIRMADO' && doc.firmaConforme === true && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300" title="Firmado conforme">
                              Conforme
                            </span>
                          )}
                          {doc.estado === 'FIRMADO' && doc.firmaConforme === false && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" title="Firmado no conforme">
                              No conforme
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(doc.fechaCarga).toLocaleDateString('es-AR')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.fechaFirma ? new Date(doc.fechaFirma).toLocaleDateString('es-AR') : '—'}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {pendienteLectura && (
                          <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white" onClick={() => marcarLeido(doc.id)} disabled={marking === doc.id}>
                            <BookOpen size={14} className="mr-1" />{marking === doc.id ? '...' : 'Marcar como leído'}
                          </Button>
                        )}
                        {pendienteFirma && (
                          <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white" onClick={() => setFirmaDoc(doc)}>
                            <Pen size={14} className="mr-1" /> Firmar
                          </Button>
                        )}
                        <a href={`/api/documentos/${doc.id}/archivo`} target="_blank">
                          <Button size="sm" variant="outline"><FileText size={14} /></Button>
                        </a>
                        <a href={`/api/documentos/${doc.id}/archivo`} download={doc.nombreArchivo}>
                          <Button size="sm" variant="outline"><Download size={14} /></Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Móvil: cards */}
          <div className="md:hidden space-y-2">
            {paginate(filteredDocs, page, pageSize).map(doc => {
              const accion = doc.tipoDocumento?.accion
              const pendienteFirma = accion === 'FIRMA' && doc.estado === 'ENVIADO_A_FIRMA'
              const pendienteLectura = accion === 'LECTURA' && doc.estado === 'ENVIADO_A_FIRMA'
              return (
                <div key={doc.id} className="rounded-lg border p-3 bg-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{formatPeriodo(doc.periodo)}</p>
                      <p className="text-xs text-muted-foreground truncate">{doc.nombreArchivo}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge estado={doc.estado} accion={accion} pov="empleado" />
                      {doc.estado === 'FIRMADO' && doc.firmaConforme === true && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300">Conforme</span>
                      )}
                      {doc.estado === 'FIRMADO' && doc.firmaConforme === false && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400">No conforme</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                    <p>Cargado: {new Date(doc.fechaCarga).toLocaleDateString('es-AR')}</p>
                    <p>Firmado el: {doc.fechaFirma ? new Date(doc.fechaFirma).toLocaleDateString('es-AR') : '—'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {pendienteLectura && (
                      <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white flex-1" onClick={() => marcarLeido(doc.id)} disabled={marking === doc.id}>
                        <BookOpen size={14} className="mr-1" />{marking === doc.id ? '...' : 'Marcar como leído'}
                      </Button>
                    )}
                    {pendienteFirma && (
                      <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white flex-1" onClick={() => setFirmaDoc(doc)}>
                        <Pen size={14} className="mr-1" /> Firmar
                      </Button>
                    )}
                    <a href={`/api/documentos/${doc.id}/archivo`} target="_blank" className="flex-1">
                      <Button size="sm" variant="outline" className="w-full"><FileText size={14} className="mr-1" /> Ver</Button>
                    </a>
                    <a href={`/api/documentos/${doc.id}/archivo`} download={doc.nombreArchivo} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full"><Download size={14} className="mr-1" /> Bajar</Button>
                    </a>
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination
            page={page} pageSize={pageSize} total={filteredDocs.length}
            itemLabel="recibos"
            onPageChange={setPage} onPageSizeChange={setPageSize}
          />
        </>
      )}

      <FirmarDocumentoDialog
        open={firmaDoc !== null}
        docId={firmaDoc?.id ?? null}
        titulo="Firmar recibo"
        descripcion={`Recibo del período ${firmaDoc?.periodo ?? firmaDoc?.nombreArchivo ?? ''}`}
        onClose={() => setFirmaDoc(null)}
        onFirmado={load}
      />
    </div>
  )
}
