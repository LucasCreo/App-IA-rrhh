'use client'

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { mentionSuggestion } from './MentionSuggestion'
import { Node, mergeAttributes } from '@tiptap/core'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Bold as BoldIcon, Italic as ItalicIcon, List, ListOrdered, Link as LinkIcon,
  Image as ImageIcon, Mic, Video as VideoIcon, Undo2, Redo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ---------- Nodes custom para audio y video ---------- */

const Audio = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() { return { src: { default: null } } },
  parseHTML() { return [{ tag: 'audio[src]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['audio', mergeAttributes(HTMLAttributes, { controls: 'true' })]
  },
})

const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() { return { src: { default: null } } },
  parseHTML() { return [{ tag: 'video[src]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, { controls: 'true', style: 'max-width:100%;' })]
  },
})

/* ---------- Toolbar ---------- */

function ToolbarBtn({ onClick, active, disabled, title, children }: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
        active && 'bg-muted text-foreground'
      )}
    >
      {children}
    </button>
  )
}

async function subirArchivo(file: File, accept: 'image' | 'audio' | 'video'): Promise<string | null> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/portal/media', { method: 'POST', body: fd })
  if (!res.ok) {
    const text = await res.text()
    let msg = 'Error al subir'
    try { msg = JSON.parse(text).error ?? msg } catch { msg = text || msg }
    toast.error(msg)
    return null
  }
  const { url, tipo } = await res.json()
  if (tipo !== accept) {
    toast.error(`Se esperaba ${accept}, se subió ${tipo}`)
    return null
  }
  return url
}

function Toolbar({ editor, variant = 'full' }: { editor: Editor; variant?: 'full' | 'mini' }) {
  const imgRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  async function agregarMedia(kind: 'image' | 'audio' | 'video', file?: File) {
    if (!file) return
    const url = await subirArchivo(file, kind)
    if (!url) return
    if (kind === 'image') editor.chain().focus().setImage({ src: url }).run()
    else if (kind === 'audio') editor.chain().focus().insertContent({ type: 'audio', attrs: { src: url } }).run()
    else editor.chain().focus().insertContent({ type: 'video', attrs: { src: url } }).run()
  }

  function insertarLink() {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL del enlace', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b border-input px-2 py-1 bg-muted/30 rounded-t-md">
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita (Ctrl+B)">
        <BoldIcon size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva (Ctrl+I)">
        <ItalicIcon size={14} />
      </ToolbarBtn>
      <span className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista">
        <List size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
        <ListOrdered size={14} />
      </ToolbarBtn>
      <span className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn onClick={insertarLink} active={editor.isActive('link')} title="Enlace">
        <LinkIcon size={14} />
      </ToolbarBtn>
      {variant === 'full' && (
        <>
          <span className="w-px h-4 bg-border mx-1" />
          <ToolbarBtn onClick={() => imgRef.current?.click()} title="Imagen">
            <ImageIcon size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => audioRef.current?.click()} title="Audio">
            <Mic size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => videoRef.current?.click()} title="Video">
            <VideoIcon size={14} />
          </ToolbarBtn>
          <input ref={imgRef} type="file" accept="image/*" className="hidden"
            onChange={e => { agregarMedia('image', e.target.files?.[0]); e.target.value = '' }} />
          <input ref={audioRef} type="file" accept="audio/*" className="hidden"
            onChange={e => { agregarMedia('audio', e.target.files?.[0]); e.target.value = '' }} />
          <input ref={videoRef} type="file" accept="video/*" className="hidden"
            onChange={e => { agregarMedia('video', e.target.files?.[0]); e.target.value = '' }} />
        </>
      )}
      <span className="flex-1" />
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer (Ctrl+Z)">
        <Undo2 size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer (Ctrl+Y)">
        <Redo2 size={14} />
      </ToolbarBtn>
    </div>
  )
}

/* ---------- Componente principal ---------- */

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  variant?: 'full' | 'mini'
  minHeight?: number
  autoFocus?: boolean
  onSubmit?: () => void
}

export function RichEditor({
  value, onChange, placeholder = 'Escribí algo...', variant = 'full',
  minHeight = 100, autoFocus = false, onSubmit,
}: Props) {
  const [focus, setFocus] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: variant === 'full' ? { levels: [1, 2, 3] } : false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, HTMLAttributes: { class: 'rounded-md max-w-full' } }),
      Audio,
      Video,
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        renderHTML: ({ options, node }) => [
          'span',
          { ...options.HTMLAttributes, 'data-mention': 'true', 'data-id': node.attrs.id },
          `@${node.attrs.label ?? node.attrs.id}`,
        ],
        suggestion: mentionSuggestion,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2',
          '[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-1',
        ),
        style: `min-height:${minHeight}px`,
        'data-placeholder': placeholder,
      },
      handleKeyDown: (_view, event) => {
        if (onSubmit && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          onSubmit()
          return true
        }
        return false
      },
    },
    autofocus: autoFocus,
    immediatelyRender: false,
  })

  if (!editor) return null

  return (
    <div className={cn('rounded-md border border-input bg-background transition-colors', focus && 'ring-2 ring-ring/40')}>
      <Toolbar editor={editor} variant={variant} />
      <EditorContent editor={editor} />
    </div>
  )
}
