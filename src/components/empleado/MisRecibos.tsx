'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, Download, BookOpen, Pen, Search, X } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { FirmarDocumentoDialog } from '@/components/empleado/FirmarDocumentoDialog'
import { cn } from '@/lib/utils'

interface Doc {
  id: number; nombreArchivo: string; periodo: string | null; estado: string
  fechaCarga: string; fechaFirma?: string
  tipoDocumento?: { accion: string } | null
}

type Filtro = 'TODOS' | 'PENDIENTES' | 'FIRMADOS'
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
  const [marking, setMarking] = useState<number | null>(null)
  const [firmaDoc, setFirmaDoc] = useState<Doc | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [anio, setAnio] = useState<string>('')
  const [mes, setMes] = useState<string>('')
  const [orden, setOrden] = useState<Orden>('DESC')

  function load() {
    fetch(`/api/documentos?employeeId=${employeeId}&recibo=true`)
      .then(r => r.json())
      .then(data => setDocs(data.docs ?? []))
  }

  useEffect(() => { load() }, [employeeId])

  const counts = useMemo(() => ({
    TODOS: docs.length,
    PENDIENTES: docs.filter(d => d.estado === 'ENVIADO_A_FIRMA').length,
    FIRMADOS: docs.filter(d => d.estado === 'FIRMADO').length,
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
    else if (filtro === 'FIRMADOS') out = out.filter(d => d.estado === 'FIRMADO')

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
    { key: 'PENDIENTES', label: 'Pendientes' },
    { key: 'FIRMADOS', label: 'Firmados' },
  ]

  async function marcarLeido(id: number) {
    setMarking(id)
    const res = await fetch(`/api/documentos/${id}/marcar-leido`, { method: 'POST' })
    if (res.ok) { toast.success('Documento marcado como leído'); load() }
    else toast.error('Error al marcar como leído')
    setMarking(null)
  }

  return (
    <>
      <div className="flex gap-1 flex-wrap mb-3">
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => setFiltro(c.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50',
              filtro === c.key
                ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {c.label}
            <span className="opacity-60">{counts[c.key]}</span>
          </button>
        ))}
      </div>

      {filtro === 'TODOS' && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Buscar por período o archivo…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <select
            value={anio}
            onChange={e => setAnio(e.target.value)}
            className="h-8 text-xs px-2 rounded-md border border-input bg-background text-foreground"
          >
            <option value="">Todos los años</option>
            {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="h-8 text-xs px-2 rounded-md border border-input bg-background text-foreground"
          >
            <option value="">Todos los meses</option>
            {MESES.map((m, idx) => (
              <option key={m} value={String(idx + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
          <select
            value={orden}
            onChange={e => setOrden(e.target.value as Orden)}
            className="h-8 text-xs px-2 rounded-md border border-input bg-background text-foreground"
          >
            <option value="DESC">Más nuevos primero</option>
            <option value="ASC">Más viejos primero</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 h-8 rounded-md"
            >
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Período</TableHead>
            <TableHead>Archivo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredDocs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                {docs.length === 0
                  ? 'No tenés recibos cargados aún.'
                  : filtro === 'PENDIENTES' ? 'No tenés recibos pendientes.'
                  : filtro === 'FIRMADOS' ? 'No tenés recibos firmados aún.'
                  : 'Sin resultados para los filtros aplicados.'}
              </TableCell>
            </TableRow>
          )}
          {filteredDocs.map(doc => {
            const accion = doc.tipoDocumento?.accion
            const pendienteFirma = accion === 'FIRMA' && doc.estado === 'ENVIADO_A_FIRMA'
            const pendienteLectura = accion === 'LECTURA' && doc.estado === 'ENVIADO_A_FIRMA'
            return (
              <TableRow key={doc.id}>
                <TableCell>{formatPeriodo(doc.periodo)}</TableCell>
                <TableCell>{doc.nombreArchivo}</TableCell>
                <TableCell>
                  <StatusBadge estado={doc.estado} accion={accion} pov="empleado" />
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

      <FirmarDocumentoDialog
        open={firmaDoc !== null}
        docId={firmaDoc?.id ?? null}
        titulo="Firmar recibo"
        descripcion={`Recibo del período ${firmaDoc?.periodo ?? firmaDoc?.nombreArchivo ?? ''}`}
        onClose={() => setFirmaDoc(null)}
        onFirmado={load}
      />
    </>
  )
}
