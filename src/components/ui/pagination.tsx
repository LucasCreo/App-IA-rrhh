'use client'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  page: number
  pageSize: number
  total: number
  pageSizes?: number[]
  itemLabel?: string
  onPageChange: (p: number) => void
  onPageSizeChange?: (n: number) => void
}

export function Pagination({
  page, pageSize, total,
  pageSizes = [10, 20, 50, 100],
  itemLabel = 'registros',
  onPageChange, onPageSizeChange,
}: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const paginaActual = Math.min(page, pages)
  const inicio = (paginaActual - 1) * pageSize
  const fin = Math.min(inicio + pageSize, total)

  if (total === 0) return null

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-1 pt-3 text-xs text-muted-foreground">
      <span>
        {total === 0 ? '0' : `${inicio + 1}-${fin} de ${total}`} {itemLabel}
      </span>
      <div className="flex items-center gap-3 flex-wrap">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Por página</span>
            <Select value={String(pageSize)} onValueChange={v => { if (v) { onPageSizeChange(Number(v)); onPageChange(1) } }}>
              <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {pageSizes.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2" disabled={paginaActual <= 1} onClick={() => onPageChange(paginaActual - 1)}>‹</Button>
          <span className="px-2">Página {paginaActual} de {pages}</span>
          <Button size="sm" variant="outline" className="h-7 px-2" disabled={paginaActual >= pages} onClick={() => onPageChange(paginaActual + 1)}>›</Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Helper para paginar arrays en memoria.
 * Uso: const items = paginate(filtered, page, pageSize)
 */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const p = Math.min(Math.max(1, page), pages)
  const start = (p - 1) * pageSize
  return items.slice(start, start + pageSize)
}
