'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { AvatarDisplay } from '@/components/shared/AvatarDisplay'

interface Log {
  id: number; accion: string; entidad: string; detalle?: string; createdAt: string
  user: {
    email: string
    avatarUrl?: string | null
    avatarBgColor?: string | null
    avatarTextColor?: string | null
    employee?: { nombre: string; apellido: string } | null
  }
}

function nombreUsuario(u: Log['user']) {
  return u.employee ? `${u.employee.nombre} ${u.employee.apellido}` : u.email
}

export function TabAuditoria() {
  const [logs, setLogs] = useState<Log[]>([])
  const [q, setQ] = useState('')
  const [inputQ, setInputQ] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('q', q)
    fetch(`/api/auditoria?${params}`)
      .then(r => r.json())
      .then(d => { setLogs(d.logs); setTotal(d.total); setPages(d.pages) })
      .finally(() => setLoading(false))
  }, [q, page])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setQ(inputQ)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar acción, entidad, usuario…"
            value={inputQ}
            onChange={e => setInputQ(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">Buscar</Button>
        {q && (
          <Button type="button" variant="ghost" onClick={() => { setInputQ(''); setQ(''); setPage(1) }}>
            Limpiar
          </Button>
        )}
      </form>

      {q && !loading && (
        <p className="text-xs text-muted-foreground">{total} resultado{total !== 1 ? 's' : ''} para «{q}»</p>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      No hay registros.
                    </TableCell>
                  </TableRow>
                )}
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <AvatarDisplay
                          nombre={nombreUsuario(log.user)}
                          avatarUrl={log.user.avatarUrl}
                          bgColor={log.user.avatarBgColor}
                          textColor={log.user.avatarTextColor}
                          size={24}
                        />
                        <div className="min-w-0">
                          <p className="truncate">{nombreUsuario(log.user)}</p>
                          {log.user.employee && (
                            <p className="text-[11px] text-muted-foreground truncate">{log.user.email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-400 rounded text-xs font-mono">
                        {log.accion}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{log.entidad}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.detalle}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-2">
            {logs.length === 0 && <p className="text-center text-muted-foreground py-10">No hay registros.</p>}
            {logs.map(log => (
              <div key={log.id} className="bg-card border border-border rounded-lg px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-400 rounded text-xs font-mono">
                    {log.accion}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString('es-AR')}</span>
                </div>
                <p className="text-sm font-medium">{log.entidad}</p>
                {log.detalle && <p className="text-xs text-muted-foreground">{log.detalle}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <AvatarDisplay
                    nombre={nombreUsuario(log.user)}
                    avatarUrl={log.user.avatarUrl}
                    bgColor={log.user.avatarBgColor}
                    textColor={log.user.avatarTextColor}
                    size={20}
                  />
                  <p className="text-xs text-muted-foreground">{nombreUsuario(log.user)}</p>
                </div>
              </div>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Página {page} de {pages} · {total} registros
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                  <ChevronLeft size={14} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page === pages}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
