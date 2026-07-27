'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText, ClipboardList, BookOpen, Pen, Download, CheckCircle2, Circle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { FirmarDocumentoDialog } from '@/components/empleado/FirmarDocumentoDialog'
import { FormularioDialog, FormularioRespuesta } from '@/components/empleado/FormularioDialog'
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

type ItemBase = { key: string; fecha: string; titulo: string; subtitulo?: string | null; pendiente: boolean }
type ItemDoc = ItemBase & { kind: 'doc'; doc: DocApi }
type ItemForm = ItemBase & { kind: 'form'; resp: FormularioRespuesta }
type Item = ItemDoc | ItemForm

interface Props { employeeId: number }

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'formularios', label: 'Formularios' },
  { value: 'pendientes', label: 'Pendientes' },
] as const
type Filtro = typeof FILTROS[number]['value']

export function MisDocumentosYFormularios({ employeeId }: Props) {
  const [docs, setDocs] = useState<DocApi[]>([])
  const [forms, setForms] = useState<FormularioRespuesta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'' | 'pendiente' | 'firmado' | 'rechazado'>('')
  const [acting, setActing] = useState<number | null>(null)

  const [firmaDoc, setFirmaDoc] = useState<DocApi | null>(null)
  const [editForm, setEditForm] = useState<FormularioRespuesta | null>(null)
  const [viewForm, setViewForm] = useState<FormularioRespuesta | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch(`/api/documentos?employeeId=${employeeId}&recibo=false`).then(r => r.json()),
      fetch('/api/empleado/formularios').then(r => r.json()),
    ]).then(([d, f]) => {
      setDocs(d.docs ?? [])
      setForms(Array.isArray(f) ? f : [])
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [employeeId])

  async function marcarLeido(id: number) {
    setActing(id)
    const res = await fetch(`/api/documentos/${id}/marcar-leido`, { method: 'POST' })
    setActing(null)
    if (res.ok) { toast.success('Documento marcado como leído'); load() }
    else toast.error('Error al marcar como leído')
  }

  const items: Item[] = [
    ...docs.map<ItemDoc>(d => ({
      kind: 'doc',
      key: `doc-${d.id}`,
      fecha: d.fechaCarga,
      titulo: d.tipoDocumento?.nombre ?? d.nombreArchivo,
      subtitulo: d.periodo ? `Período ${d.periodo}` : d.nombreArchivo,
      pendiente: d.estado === 'ENVIADO_A_FIRMA',
      doc: d,
    })),
    ...forms.map<ItemForm>(f => ({
      kind: 'form',
      key: `form-${f.id}`,
      fecha: f.updatedAt,
      titulo: f.asignacion.nombre,
      subtitulo: f.asignacion.plantilla.nombre,
      pendiente: f.estado === 'PENDIENTE',
      resp: f,
    })),
  ]

  function estadoMatch(item: Item, target: typeof estadoFiltro): boolean {
    if (!target) return true
    if (target === 'pendiente') return item.pendiente
    if (target === 'firmado') {
      return item.kind === 'doc'
        ? item.doc.estado === 'FIRMADO'
        : item.resp.estado === 'ENVIADO'
    }
    if (target === 'rechazado') {
      return item.kind === 'doc' && item.doc.estado === 'RECHAZADO'
    }
    return true
  }

  const q = busqueda.trim().toLowerCase()

  const filtered = items.filter(i => {
    if (filtro === 'documentos' && i.kind !== 'doc') return false
    if (filtro === 'formularios' && i.kind !== 'form') return false
    if (filtro === 'pendientes' && !i.pendiente) return false
    if (!estadoMatch(i, estadoFiltro)) return false
    if (q) {
      const hay = `${i.titulo} ${i.subtitulo ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    // Pendientes primero, luego por fecha desc
    if (a.pendiente !== b.pendiente) return a.pendiente ? -1 : 1
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  })

  const counts = {
    todos: items.length,
    documentos: items.filter(i => i.kind === 'doc').length,
    formularios: items.filter(i => i.kind === 'form').length,
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
        <p className="text-sm text-muted-foreground text-center py-12">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <FileText size={32} strokeWidth={1.2} />
          <p className="text-sm">Sin resultados</p>
        </div>
      ) : (
        <div className="divide-y">
          {filtered.map(item => (
            <div key={item.key} className="flex items-center gap-3 px-5 py-4">
              {item.kind === 'doc'
                ? <FileText size={16} className="text-muted-foreground shrink-0" />
                : <ClipboardList size={16} className="text-blue-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{item.titulo}</p>
                  <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {item.kind === 'doc' ? 'PDF' : 'Formulario'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {item.subtitulo ? `${item.subtitulo} · ` : ''}
                  {new Date(item.fecha).toLocaleDateString('es-AR')}
                </p>
              </div>

              {item.kind === 'doc' ? (
                <DocActions doc={item.doc} acting={acting} onFirmar={setFirmaDoc} onMarcarLeido={marcarLeido} />
              ) : (
                <FormActions resp={item.resp} onFill={setEditForm} onView={setViewForm} />
              )}
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
      <FormularioDialog
        respuesta={editForm}
        mode="fill"
        onClose={() => setEditForm(null)}
        onSaved={load}
      />
      <FormularioDialog
        respuesta={viewForm}
        mode="view"
        onClose={() => setViewForm(null)}
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

function FormActions({ resp, onFill, onView }: {
  resp: FormularioRespuesta
  onFill: (r: FormularioRespuesta) => void
  onView: (r: FormularioRespuesta) => void
}) {
  if (resp.estado === 'PENDIENTE') {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
          <Circle size={12} /> Pendiente
        </span>
        <Button size="sm" className="bg-green-700 hover:bg-green-800 h-8 text-xs" onClick={() => onFill(resp)}>
          Completar
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 size={12} /> Enviado
      </span>
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onView(resp)}>
        Ver
      </Button>
    </div>
  )
}
