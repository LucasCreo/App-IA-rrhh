'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { ReactRenderer } from '@tiptap/react'
import type { SuggestionOptions } from '@tiptap/suggestion'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { AvatarDisplay } from '@/components/shared/AvatarDisplay'

interface Item {
  id: number
  label: string
  email: string
  avatarUrl: string | null
  avatarBgColor?: string | null
  avatarTextColor?: string | null
}

interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

const MentionList = forwardRef<MentionListRef, { items: Item[]; command: (item: { id: number; label: string }) => void }>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0)

    useEffect(() => { setSelected(0) }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') { setSelected(s => (s + items.length - 1) % items.length); return true }
        if (event.key === 'ArrowDown') { setSelected(s => (s + 1) % items.length); return true }
        if (event.key === 'Enter') {
          const it = items[selected]
          if (it) command({ id: it.id, label: it.label })
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">Sin resultados</div>
    }

    return (
      <div className="rounded-md border border-border bg-popover shadow-md overflow-hidden min-w-52 max-w-72">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => command({ id: it.id, label: it.label })}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors ${i === selected ? 'bg-muted' : 'hover:bg-muted/60'}`}
          >
            <AvatarDisplay
              nombre={it.label}
              avatarUrl={it.avatarUrl}
              bgColor={it.avatarBgColor}
              textColor={it.avatarTextColor}
              size={22}
            />
            <span className="truncate">{it.label}</span>
          </button>
        ))}
      </div>
    )
  }
)
MentionList.displayName = 'MentionList'

export const mentionSuggestion: Omit<SuggestionOptions, 'editor'> = {
  char: '@',
  items: async ({ query }) => {
    try {
      const res = await fetch(`/api/portal/users-search?q=${encodeURIComponent(query ?? '')}`)
      if (!res.ok) return []
      return (await res.json()) as Item[]
    } catch { return [] }
  },
  render: () => {
    let component: ReactRenderer | null = null
    let popup: TippyInstance[] = []

    return {
      onStart: props => {
        component = new ReactRenderer(MentionList, { props, editor: props.editor })
        if (!props.clientRect) return
        popup = tippy('body', {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },
      onUpdate: props => {
        component?.updateProps(props)
        if (popup[0] && props.clientRect) {
          popup[0].setProps({ getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect() })
        }
      },
      onKeyDown: props => {
        if (props.event.key === 'Escape') { popup[0]?.hide(); return true }
        const ref = component?.ref as MentionListRef | null
        return ref?.onKeyDown(props) ?? false
      },
      onExit: () => {
        popup[0]?.destroy()
        component?.destroy()
        popup = []
        component = null
      },
    }
  },
}
