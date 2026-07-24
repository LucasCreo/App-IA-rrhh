'use client'

import { useMemo, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Input } from '@/components/ui/input'
import { Search, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Empleado {
  id: number
  nombre: string
  apellido: string
  legajo: string
  categoria?: { id: number; nombre: string } | null
}

interface Props {
  value: string
  onChange: (id: string) => void
  empleados: Empleado[]
  placeholder?: string
  className?: string
}

export function EmpleadoPicker({ value, onChange, empleados, placeholder = 'Empleado…', className }: Props) {
  const [q, setQ] = useState('')
  const [categoriaId, setCategoriaId] = useState<string>('')

  const categorias = useMemo(() => {
    const map = new Map<number, string>()
    for (const e of empleados) if (e.categoria) map.set(e.categoria.id, e.categoria.nombre)
    return Array.from(map, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [empleados])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return empleados.filter(e => {
      if (categoriaId && String(e.categoria?.id) !== categoriaId) return false
      if (!query) return true
      return `${e.apellido} ${e.nombre} ${e.legajo}`.toLowerCase().includes(query)
    })
  }, [empleados, q, categoriaId])

  const selected = empleados.find(e => String(e.id) === value)

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'inline-flex items-center justify-between gap-1.5 h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs text-left outline-none transition-colors dark:bg-input/30 dark:hover:bg-input/50',
          !selected && 'text-muted-foreground',
          className,
        )}
      >
        <span className="truncate">
          {selected ? `${selected.apellido}, ${selected.nombre} (${selected.legajo})` : placeholder}
        </span>
        <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={4} className="z-50">
          <Popover.Popup className="w-72 rounded-xl border bg-popover text-popover-foreground shadow-lg outline-none flex flex-col max-h-80">
            <div className="p-2 border-b space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-7 h-8 text-xs"
                  placeholder="Buscar por nombre o legajo…"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  autoFocus
                />
              </div>
              {categorias.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setCategoriaId('')}
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                      categoriaId === ''
                        ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                        : 'border-input text-muted-foreground hover:bg-muted',
                    )}
                  >
                    Todas
                  </button>
                  {categorias.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCategoriaId(String(c.id))}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                        categoriaId === String(c.id)
                          ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                          : 'border-input text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sin resultados</p>
              ) : (
                filtered.map(e => {
                  const activo = String(e.id) === value
                  return (
                    <Popover.Close
                      key={e.id}
                      render={
                        <button
                          onClick={() => onChange(String(e.id))}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors',
                            activo && 'bg-accent/50',
                          )}
                        >
                          <span className="flex-1 truncate">
                            {e.apellido}, {e.nombre}
                            <span className="text-muted-foreground ml-1">({e.legajo})</span>
                          </span>
                          {activo && <Check size={13} className="text-green-600 shrink-0" />}
                        </button>
                      }
                    />
                  )
                })
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
