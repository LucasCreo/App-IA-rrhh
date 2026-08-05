'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const VALID_KEYS = new Set(['legajo', 'cuil', 'año', 'ano', 'mes', 'apellido', 'nombre', '*'])
const CHIP_VALID = 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 border-green-300 dark:border-green-700'
const CHIP_INVALID = 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300 border-red-300 dark:border-red-700'

function renderHighlighted(value: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const parts: string[] = []
  const re = /\{([a-zA-Z*ñáéíóú_-]+)\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) parts.push(escape(value.slice(last, m.index)))
    const key = m[1].toLowerCase()
    const cls = VALID_KEYS.has(key) ? CHIP_VALID : CHIP_INVALID
    parts.push(
      `<span contenteditable="false" class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono border ${cls} mx-0.5 select-none">${escape(m[0])}</span>`
    )
    last = m.index + m[0].length
  }
  if (last < value.length) parts.push(escape(value.slice(last)))
  return parts.join('') || '<br>'
}

interface Props {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
}

/**
 * Input estilo "chip" para plantillas con placeholders.
 * Muestra los tokens {legajo}, {mes}, etc. como chips coloreados.
 * Acepta drop de texto (los placeholders arrastrables).
 */
export function PatternInput({ value, onChange, placeholder, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)

  // Sincroniza HTML cuando cambia el value desde afuera y no estamos editando
  useEffect(() => {
    if (!ref.current) return
    if (document.activeElement === ref.current) return
    ref.current.innerHTML = renderHighlighted(value)
  }, [value])

  function handleInput() {
    if (!ref.current) return
    // textContent (no innerText) para evitar espacios agregados alrededor de los chips (inline-flex)
    onChange(ref.current.textContent ?? '')
  }

  function insertAtCursor(text: string) {
    const el = ref.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      onChange(value + text)
      return
    }
    const range = sel.getRangeAt(0)
    if (!el.contains(range.commonAncestorContainer)) {
      onChange(value + text)
      return
    }
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    onChange(el.innerText)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const text = e.dataTransfer.getData('text/plain')
    if (!text) return
    // Ubicar el cursor donde soltaron (fallback: final)
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY)
    if (range && ref.current?.contains(range.commonAncestorContainer)) {
      const sel = window.getSelection()
      if (sel) { sel.removeAllRanges(); sel.addRange(range) }
    }
    insertAtCursor(text)
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      onDrop={handleDrop}
      data-placeholder={placeholder}
      className={cn(
        'min-h-9 rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none transition-colors',
        'focus:ring-2 focus:ring-green-500/40 focus:border-green-500',
        'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground',
        !value && !focused && 'text-muted-foreground',
        className,
      )}
    />
  )
}
