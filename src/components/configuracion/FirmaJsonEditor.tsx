'use client'

import { useRef, useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import { FIRMA_PLACEHOLDERS } from '@/lib/firmaProvider'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  invalid?: boolean
  minRows?: number
}

/**
 * Textarea con:
 * - Drop de placeholders del sistema (colored tags)
 * - Botón para expandir a modal (tipo n8n)
 * - Highlight visual del texto para distinguir {placeholders} conocidos vs texto plano
 */
export function FirmaJsonEditor({ value, onChange, placeholder, invalid, minRows = 5 }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div className="relative">
        <FirmaTextArea value={value} onChange={onChange} placeholder={placeholder} invalid={invalid} minRows={minRows} />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="Expandir"
          className="absolute bottom-1.5 right-1.5 p-1 rounded bg-background/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Maximize2 size={12} />
        </button>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <p className="text-sm font-medium">Editar JSON</p>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="p-1 rounded hover:bg-accent"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-3 flex-1 min-h-0 flex flex-col gap-2">
              <FirmaTextArea value={value} onChange={onChange} placeholder={placeholder} invalid={invalid} large />
              <PlaceholderPalette compact />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface TAProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  invalid?: boolean
  minRows?: number
  large?: boolean
}

function FirmaTextArea({ value, onChange, placeholder, invalid, minRows = 5, large }: TAProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault()
    const tag = e.dataTransfer.getData('text/plain')
    if (!tag) return
    const ta = ref.current
    if (!ta) { onChange(value + tag); return }
    const start = ta.selectionStart ?? value.length
    const end = ta.selectionEnd ?? value.length
    const next = value.slice(0, start) + tag + value.slice(end)
    onChange(next)
    // reposicionar caret al final del tag insertado
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + tag.length
      ta.setSelectionRange(pos, pos)
    })
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      onDrop={handleDrop}
      placeholder={placeholder}
      rows={large ? undefined : minRows}
      className={cn(
        'w-full font-mono text-xs rounded-md border bg-background px-3 py-2',
        large ? 'flex-1 min-h-[300px] resize-y' : `resize-none min-h-[${minRows * 20}px]`,
        invalid ? 'border-red-500 dark:border-red-400' : 'border-input',
      )}
    />
  )
}

/**
 * Paleta de placeholders arrastrables (colored). Se importa donde se necesite.
 */
export function PlaceholderPalette({ compact }: { compact?: boolean }) {
  return (
    <div>
      {!compact && <p className="text-[11px] text-muted-foreground mb-1.5">Arrastrá al campo o clickeá para copiar.</p>}
      <div className="flex flex-wrap gap-1">
        {FIRMA_PLACEHOLDERS.map(tag => {
          const t = `{${tag}}`
          const color = colorFor(tag)
          return (
            <div
              key={tag}
              draggable
              onDragStart={e => { e.dataTransfer.setData('text/plain', t); e.dataTransfer.effectAllowed = 'copy' }}
              onClick={() => { navigator.clipboard.writeText(t).catch(() => {}) }}
              className={cn(
                'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-mono border cursor-grab active:cursor-grabbing select-none',
                color,
              )}
              title="Arrastrá al campo, o click para copiar"
            >
              {t}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Color por prefijo/categoría del placeholder, para poder distinguirlos rápido. */
function colorFor(tag: string): string {
  if (tag.startsWith('empleado.')) return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'
  if (tag.startsWith('lote.'))     return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800'
  if (tag === 'apiKey' || tag === 'apiSecret')
                                   return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
  return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800'
}
