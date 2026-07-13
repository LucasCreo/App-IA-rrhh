'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DocumentoUploadDialog } from './DocumentoUploadDialog'
import { DocumentoMasivoDialog } from './DocumentoMasivoDialog'
import { DocumentoCargarDialog } from './DocumentoCargarDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Send, Trash2, Plus, RefreshCw, Download, Users } from 'lucide-react'

interface Props { esRecibo?: boolean; employeeId?: number }
import { StatusBadge } from '@/components/ui/status-badge'

interface Doc {
  id: number; nombreArchivo: string; periodo: string | null; estado: string
  fechaCarga: string; fechaFirma?: string; firmaExternalId?: string
  employee: { nombre: string; apellido: string; legajo: string }
  cargadoPor: { email: string }
  tipoDocumento?: { id: number; nombre: string; accion: string } | null
}

const ESTADOS = ['BORRADOR', 'ENVIADO_A_FIRMA', 'FIRMADO', 'RECHAZADO', 'ERROR']
const MESES = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - 2 + i))

export function DocumentosTable({ esRecibo, employeeId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [masivoOpen, setMasivoOpen] = useState(false)
  const [cargarOpen, setCargarOpen] = useState(false)
  const [sending, setSending] = useState<number | null>(null)
  const [sendingBulk, setSendingBulk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalEmpleados, setTotalEmpleados] = useState(0)
  const [filtMes, setFiltMes] = useState('')
  const [filtAno, setFiltAno] = useState('')
  const [filtEstado, setFiltEstado] = useState('todos')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const filtPeriodo = filtAno && filtMes ? `${filtAno}-${filtMes}` : filtAno || ''

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtPeriodo) params.set('periodo', filtPeriodo)
    if (filtEstado !== 'todos') params.set('estado', filtEstado)
    if (esRecibo !== undefined) params.set('recibo', String(esRecibo))
    if (employeeId) params.set('employeeId', String(employeeId))
    params.set('page', String(page))
    fetch(`/api/documentos?${params}`)
      .then(r => r.json())
      .then(data => { setDocs(data.docs ?? []); setTotal(data.total ?? 0); setPages(data.pages ?? 1) })
      .finally(() => setLoading(false))
  }, [filtPeriodo, filtEstado, esRecibo, employeeId, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/empleados?all=true&estado=ACTIVO')
      .then(r => r.json())
      .then(d => setTotalEmpleados(d.total))
  }, [])

  async function handleSendToSign(id: number) {
    setSending(id)
    const res = await fetch(`/api/documentos/${id}/enviar-firma`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) toast.error(`Error: ${data.error}`)
    else toast.success('Enviado a firma')
    setSending(null)
    load()
  }

  async function handleBulkSend() {
    const pendientes = docs.filter(d => d.estado === 'BORRADOR' || d.estado === 'ERROR')
    if (!pendientes.length) return
    setSendingBulk(true)
    let ok = 0, fail = 0
    for (const doc of pendientes) {
      const res = await fetch(`/api/documentos/${doc.id}/enviar-firma`, { method: 'POST' })
      if (res.ok) ok++; else fail++
    }
    setSendingBulk(false)
    if (fail > 0) toast.error(`${fail} envío(s) fallaron`)
    if (ok > 0) toast.success(`${ok} enviado(s) a firma`)
    load()
  }

  async function handleCheckStatus(id: number) {
    const res = await fetch(`/api/documentos/${id}/enviar-firma`, { method: 'PATCH' })
    const data = await res.json()
    if (!res.ok) toast.error(`Error: ${data.error}`)
    else toast.success(`Estado actualizado: ${data.estado ?? 'OK'}`)
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
    await fetch(`/api/documentos/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null)
    load()
  }

  const borradores = docs.filter(d =>
    (d.estado === 'BORRADOR' || d.estado === 'ERROR') && d.tipoDocumento?.accion !== 'NINGUNA'
  )
  const firmados = docs.filter(d => d.estado === 'FIRMADO').length
  const enviados = docs.filter(d => d.estado === 'ENVIADO_A_FIRMA').length
  const empleadosConRecibo = new Set(docs.map(d => d.employee.legajo)).size
  const sinRecibo = filtPeriodo ? Math.max(0, totalEmpleados - empleadosConRecibo) : null

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
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
          <Select value={filtAno} onValueChange={v => { if (v != null) { setFiltAno(v === 'todos' ? '' : v); setPage(1) } }}>
            <SelectTrigger className="w-24"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Estado</p>
          <Select value={filtEstado} onValueChange={v => { setFiltEstado(v ?? 'todos'); setPage(1) }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {ESTADOS.map(e => <SelectItem key={e} value={e}>{e.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2">
          {borradores.length > 0 && (
            <Button variant="outline" className="text-blue-600 border-blue-200" onClick={handleBulkSend} disabled={sendingBulk}>
              <Send size={14} className="mr-1" />
              {sendingBulk ? 'Enviando...' : `Notificar/Enviar ${borradores.length}`}
            </Button>
          )}
          {docs.length > 0 && (
            <Button variant="outline" onClick={exportCSV}>
              <Download size={14} className="mr-1" /> CSV
            </Button>
          )}
          {esRecibo === true && !employeeId && (
            <Button variant="outline" onClick={() => setMasivoOpen(true)}>
              <Users size={14} className="mr-1" /> Distribución masiva
            </Button>
          )}
          <Button className="bg-green-700 hover:bg-green-800" onClick={() => esRecibo === true ? setUploadOpen(true) : setCargarOpen(true)}>
            <Plus size={16} className="mr-1" /> {esRecibo === true ? 'Cargar Recibo' : 'Cargar Documento'}
          </Button>
        </div>
      </div>

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
            <span className="text-muted-foreground">En firma: </span>
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
          {/* Vista mobile — cards */}
          <div className="md:hidden space-y-3">
            {docs.map(doc => (
              <div key={doc.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {!employeeId && <p className="font-medium text-sm">{doc.employee.apellido}, {doc.employee.nombre}</p>}
                    <p className="text-xs text-muted-foreground">{!employeeId && doc.employee.legajo}{doc.periodo ? `${!employeeId ? ' · ' : ''}${doc.periodo}` : ''}</p>
                  </div>
                  <StatusBadge estado={doc.estado} accion={doc.tipoDocumento?.accion} />
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
                        return <Button size="sm" variant="outline" className="text-blue-600 flex-1" onClick={() => handleSendToSign(doc.id)} disabled={sending === doc.id}><Send size={14} className="mr-1" />{sending === doc.id ? '...' : 'Notificar'}</Button>
                      return null
                    }
                    return <>
                      {(doc.estado === 'BORRADOR' || doc.estado === 'ERROR') && (
                        <Button size="sm" variant="outline" className="text-blue-600 flex-1" onClick={() => handleSendToSign(doc.id)} disabled={sending === doc.id}>
                          <Send size={14} className="mr-1" />{sending === doc.id ? '...' : 'Enviar a firma'}
                        </Button>
                      )}
                      {doc.estado === 'ENVIADO_A_FIRMA' && (
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
            ))}
          </div>

          {/* Vista desktop — tabla */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {!employeeId && <TableHead>Empleado</TableHead>}
                  <TableHead>Período</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cargado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map(doc => (
                  <TableRow key={doc.id}>
                    {!employeeId && (
                      <TableCell>
                        <div className="font-medium">{doc.employee.apellido}, {doc.employee.nombre}</div>
                        <div className="text-xs text-muted-foreground">{doc.employee.legajo}</div>
                      </TableCell>
                    )}
                    <TableCell className="font-mono">{doc.periodo ?? '—'}</TableCell>
                    <TableCell>
                      {doc.tipoDocumento
                        ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 dark:bg-green-950 dark:text-green-400 dark:border-green-800">{doc.tipoDocumento.nombre}</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <a href={`/api/documentos/${doc.id}/archivo`} target="_blank" className="flex items-center gap-1 text-green-700 dark:text-green-400 hover:underline text-sm">
                        <FileText size={14} /> {doc.nombreArchivo}
                      </a>
                    </TableCell>
                    <TableCell><StatusBadge estado={doc.estado} accion={doc.tipoDocumento?.accion} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(doc.fechaCarga).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {(() => {
                        const accion = doc.tipoDocumento?.accion ?? 'FIRMA'
                        if (accion === 'NINGUNA') return null
                        if (accion === 'LECTURA') {
                          if (doc.estado === 'BORRADOR' || doc.estado === 'ERROR')
                            return <Button size="sm" variant="outline" className="text-blue-600" onClick={() => handleSendToSign(doc.id)} disabled={sending === doc.id}><Send size={14} className="mr-1" />{sending === doc.id ? '...' : 'Notificar'}</Button>
                          return null
                        }
                        return <>
                          {(doc.estado === 'BORRADOR' || doc.estado === 'ERROR') && (
                            <Button size="sm" variant="outline" className="text-blue-600" onClick={() => handleSendToSign(doc.id)} disabled={sending === doc.id}>
                              <Send size={14} className="mr-1" />{sending === doc.id ? '...' : 'Firmar'}
                            </Button>
                          )}
                          {doc.estado === 'ENVIADO_A_FIRMA' && (
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
                ))}
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

      {uploadOpen && <DocumentoUploadDialog open onClose={() => setUploadOpen(false)} onSaved={load} esRecibo={esRecibo} />}
      {masivoOpen && <DocumentoMasivoDialog open onClose={() => setMasivoOpen(false)} onSaved={load} />}
      {cargarOpen && <DocumentoCargarDialog open onClose={() => setCargarOpen(false)} onSaved={load} />}
    </div>
  )
}
