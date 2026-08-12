'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText, BookOpen, Pen, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FirmarDocumentoDialog } from '@/components/empleado/FirmarDocumentoDialog'
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
  const [acting, setActing] = useState<number | null>(null)

  const [firmaAsign, setFirmaAsign] = useState<AsignacionApi | null>(null)

  function load() {
    setLoading(true)
    const url = employeeId ? `/api/asignaciones/mis?employeeId=${employeeId}` : `/api/asignaciones/mis`
    fetch(url)
      .then(r => r.json())
      .then(d => setAsigns(d.asignaciones ?? []))
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

  const filtered = items.filter(i => {
    if (filtro === 'pendientes' && !i.pendiente) return false
    if (!estadoMatch(i, estadoFiltro)) return false
    if (q) {
      const hay = `${i.titulo} ${i.subtitulo ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    if (a.pendiente !== b.pendiente) return a.pendiente ? -1 : 1
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  })

  const counts = {
    todos: items.length,
    pendientes: items.filter(i => i.pendiente).length,
  }

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
        <Select value={estadoFiltro || 'todos'} onValueChange={v => setEstadoFiltro(v === 'todos' ? '' : (v as typeof estadoFiltro))}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent side="bottom" alignItemWithTrigger={false}>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="firmado">Firmado / Completado</SelectItem>
            <SelectItem value="rechazado">Rechazado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-1 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50',
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
        <div className="divide-y">
          {filtered.map(item => (
            <div key={item.key} className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 sm:px-5 py-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <FileText size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.subtitulo ? `${item.subtitulo} · ` : ''}
                    {new Date(item.fecha).toLocaleDateString('es-AR')}
                  </p>
                </div>
              </div>

              <div className="sm:shrink-0">
                <AsignActions asign={item.asign} acting={acting} onFirmar={setFirmaAsign} onMarcarLeido={marcarLeido} />
              </div>
            </div>
          ))}
        </div>
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
    </div>
  )
}

function AsignActions({ asign, acting, onFirmar, onMarcarLeido }: {
  asign: AsignacionApi
  acting: number | null
  onFirmar: (a: AsignacionApi) => void
  onMarcarLeido: (id: number) => void
}) {
  const accion = asign.grupo.tipoDocumento?.accion
  const pendienteFirma = accion === 'FIRMA' && asign.estado === 'ENVIADO_A_FIRMA'
  const pendienteLectura = accion === 'LECTURA' && asign.estado === 'ENVIADO_A_FIRMA'
  const url = `/api/documentos-grupos/${asign.grupo.id}/archivo`
  return (
    <div className="flex items-center gap-2 shrink-0">
      <StatusBadge estado={asign.estado} accion={accion} pov="empleado" />
      {pendienteLectura && (
        <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white h-8 text-xs" disabled={acting === asign.id} onClick={() => onMarcarLeido(asign.id)}>
          <BookOpen size={13} className="mr-1" />
          {acting === asign.id ? '...' : 'Marcar leído'}
        </Button>
      )}
      {pendienteFirma && (
        <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white h-8 text-xs" onClick={() => onFirmar(asign)}>
          <Pen size={13} className="mr-1" /> Firmar
        </Button>
      )}
      {!pendienteFirma && !pendienteLectura && (
        <div className="flex items-center gap-1">
          <a href={url} target="_blank">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><FileText size={14} /></Button>
          </a>
          <a href={url} download={asign.grupo.nombreArchivo}>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Download size={14} /></Button>
          </a>
        </div>
      )}
    </div>
  )
}

