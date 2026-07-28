'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText, BookOpen, Pen, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { FirmarDocumentoDialog } from '@/components/empleado/FirmarDocumentoDialog'
import { cn } from '@/lib/utils'

interface DocApi {
  id: number
  nombreArchivo: string
  periodo: string | null
  estado: string
  fechaCarga: string
  fechaFirma?: string
  tipoDocumento?: { nombre: string; accion: string } | null
}

type Item = { kind: 'doc'; key: string; fecha: string; titulo: string; subtitulo?: string | null; pendiente: boolean; doc: DocApi }

interface Props { employeeId: number }

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendientes', label: 'Pendientes' },
] as const
type Filtro = typeof FILTROS[number]['value']

export function MisDocumentos({ employeeId }: Props) {
  const [docs, setDocs] = useState<DocApi[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'' | 'pendiente' | 'firmado' | 'rechazado'>('')
  const [acting, setActing] = useState<number | null>(null)

  const [firmaDoc, setFirmaDoc] = useState<DocApi | null>(null)

  function load() {
    setLoading(true)
    fetch(`/api/documentos?employeeId=${employeeId}&recibo=false`)
      .then(r => r.json())
      .then(d => setDocs(d.docs ?? []))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [employeeId])

  async function marcarLeido(id: number) {
    setActing(id)
    const res = await fetch(`/api/documentos/${id}/marcar-leido`, { method: 'POST' })
    setActing(null)
    if (res.ok) { toast.success('Documento marcado como leído'); load() }
    else toast.error('Error al marcar como leído')
  }

  const items: Item[] = docs.map<Item>(d => ({
    kind: 'doc',
    key: `doc-${d.id}`,
    fecha: d.fechaCarga,
    titulo: d.tipoDocumento?.nombre ?? d.nombreArchivo,
    subtitulo: d.periodo ? `Período ${d.periodo}` : d.nombreArchivo,
    pendiente: d.estado === 'ENVIADO_A_FIRMA',
    doc: d,
  }))

  function estadoMatch(item: Item, target: typeof estadoFiltro): boolean {
    if (!target) return true
    if (target === 'pendiente') return item.pendiente
    if (target === 'firmado') return item.doc.estado === 'FIRMADO'
    if (target === 'rechazado') return item.doc.estado === 'RECHAZADO'
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
      <div className="flex gap-1 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50',
              filtro === f.value
                ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {f.label}
            <span className="opacity-60">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      {filtro === 'todos' && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Buscar por título…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <select
            value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value as typeof estadoFiltro)}
            className="h-8 text-xs px-2 rounded-md border border-input bg-background text-foreground"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="firmado">Firmado / Completado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>
      )}

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
                <DocActions doc={item.doc} acting={acting} onFirmar={setFirmaDoc} onMarcarLeido={marcarLeido} />
              </div>
            </div>
          ))}
        </div>
      )}

      <FirmarDocumentoDialog
        open={firmaDoc !== null}
        docId={firmaDoc?.id ?? null}
        titulo="Firmar documento"
        descripcion={firmaDoc?.tipoDocumento?.nombre ?? firmaDoc?.nombreArchivo ?? ''}
        onClose={() => setFirmaDoc(null)}
        onFirmado={load}
      />
    </div>
  )
}

function DocActions({ doc, acting, onFirmar, onMarcarLeido }: {
  doc: DocApi
  acting: number | null
  onFirmar: (d: DocApi) => void
  onMarcarLeido: (id: number) => void
}) {
  const accion = doc.tipoDocumento?.accion
  const pendienteFirma = accion === 'FIRMA' && doc.estado === 'ENVIADO_A_FIRMA'
  const pendienteLectura = accion === 'LECTURA' && doc.estado === 'ENVIADO_A_FIRMA'
  return (
    <div className="flex items-center gap-2 shrink-0">
      <StatusBadge estado={doc.estado} accion={accion} pov="empleado" />
      {pendienteLectura && (
        <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white h-8 text-xs" disabled={acting === doc.id} onClick={() => onMarcarLeido(doc.id)}>
          <BookOpen size={13} className="mr-1" />
          {acting === doc.id ? '...' : 'Marcar leído'}
        </Button>
      )}
      {pendienteFirma && (
        <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white h-8 text-xs" onClick={() => onFirmar(doc)}>
          <Pen size={13} className="mr-1" /> Firmar
        </Button>
      )}
      {!pendienteFirma && !pendienteLectura && (
        <div className="flex items-center gap-1">
          <a href={`/api/documentos/${doc.id}/archivo`} target="_blank">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><FileText size={14} /></Button>
          </a>
          <a href={`/api/documentos/${doc.id}/archivo`} download={doc.nombreArchivo}>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Download size={14} /></Button>
          </a>
        </div>
      )}
    </div>
  )
}

