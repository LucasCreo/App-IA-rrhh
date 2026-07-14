'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImagePlus, X, ThumbsUp, MessageCircle, Trash2, Globe, Users, Send, Plus } from 'lucide-react'

interface Categoria { id: number; nombre: string }
interface Autor { id: number; avatarUrl: string | null; nombreCompleto: string; rolNombre: string | null }
interface Post {
  id: number
  contenido: string
  imagenUrl: string | null
  alcance: 'GLOBAL' | 'CATEGORIA'
  categoria: { id: number; nombre: string } | null
  createdAt: string
  autor: Autor
  totalReacciones: number
  miReaccion: string | null
  totalComentarios: number
}

interface Comentario {
  id: number
  contenido: string
  createdAt: string
  autor: { id: number; avatarUrl: string | null; nombreCompleto: string }
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime()
  const diff = (Date.now() - d) / 1000
  if (diff < 60) return 'hace instantes'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Avatar({ nombre, avatarUrl, size = 40 }: { nombre: string; avatarUrl: string | null; size?: number }) {
  const initials = nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  if (avatarUrl) {
    return <img src={avatarUrl} alt={nombre} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  }
  return (
    <div
      className="rounded-full bg-green-700 text-white flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || '?'}
    </div>
  )
}

function NuevoPost({ onCreated, categorias }: { onCreated: () => void; categorias: Categoria[] }) {
  const [expandido, setExpandido] = useState(false)
  const [contenido, setContenido] = useState('')
  const [imagen, setImagen] = useState<File | null>(null)
  const [imagenPreview, setImagenPreview] = useState<string | null>(null)
  const [alcance, setAlcance] = useState<'GLOBAL' | 'CATEGORIA'>('GLOBAL')
  const [categoriaId, setCategoriaId] = useState<string>('')
  const [publicando, setPublicando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function cerrar() {
    setExpandido(false)
    setContenido('')
    handleImagen(null)
    setAlcance('GLOBAL')
    setCategoriaId('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleImagen(f: File | null) {
    setImagen(f)
    if (imagenPreview) URL.revokeObjectURL(imagenPreview)
    setImagenPreview(f ? URL.createObjectURL(f) : null)
  }

  async function handlePublish() {
    if (!contenido.trim() && !imagen) { toast.error('Escribí algo o subí una imagen'); return }
    if (alcance === 'CATEGORIA' && !categoriaId) { toast.error('Elegí una categoría'); return }

    setPublicando(true)
    const fd = new FormData()
    fd.append('contenido', contenido.trim())
    fd.append('alcance', alcance)
    if (alcance === 'CATEGORIA') fd.append('categoriaId', categoriaId)
    if (imagen) fd.append('imagen', imagen)

    const r = await fetch('/api/portal/posts', { method: 'POST', body: fd })
    setPublicando(false)
    if (!r.ok) {
      const text = await r.text()
      let msg = 'Error al publicar'
      try { msg = JSON.parse(text).error ?? msg } catch { msg = text || `HTTP ${r.status}` }
      toast.error(msg)
      return
    }
    toast.success('Publicado')
    cerrar()
    onCreated()
  }

  if (!expandido) {
    return (
      <button
        onClick={() => setExpandido(true)}
        className="w-full bg-card border border-border rounded-xl p-3 shadow-sm hover:border-green-500 dark:hover:border-green-600 transition-colors flex items-center gap-3 text-left group"
      >
        <span className="w-9 h-9 rounded-full bg-green-700 text-white flex items-center justify-center shrink-0 group-hover:bg-green-800 transition-colors">
          <Plus size={18} />
        </span>
        <span className="text-sm text-muted-foreground">Compartir algo con el equipo…</span>
      </button>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm relative">
      <button
        onClick={cerrar}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
        title="Cerrar"
      >
        <X size={16} />
      </button>
      <Textarea
        value={contenido}
        onChange={e => setContenido(e.target.value)}
        placeholder="¿Qué querés compartir con el equipo?"
        className="resize-none min-h-[80px] pr-8"
        autoFocus
      />
      {imagenPreview && (
        <div className="relative inline-block">
          <img src={imagenPreview} alt="preview" className="max-h-60 rounded-lg border border-border" />
          <button
            onClick={() => handleImagen(null)}
            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => handleImagen(e.target.files?.[0] ?? null)}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={14} className="mr-1.5" /> Imagen
          </Button>
          <Select value={alcance} onValueChange={v => setAlcance(v as any)}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GLOBAL">Todos los empleados</SelectItem>
              <SelectItem value="CATEGORIA">Por categoría</SelectItem>
            </SelectContent>
          </Select>
          {alcance === 'CATEGORIA' && (
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Elegir…" /></SelectTrigger>
              <SelectContent>
                {categorias.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button
          className="bg-green-700 hover:bg-green-800"
          onClick={handlePublish}
          disabled={publicando}
        >
          <Send size={14} className="mr-1.5" />
          {publicando ? 'Publicando…' : 'Publicar'}
        </Button>
      </div>
    </div>
  )
}

function PostCard({ post, userId, onDeleted, onReaccion }: {
  post: Post
  userId: number
  onDeleted: () => void
  onReaccion: () => void
}) {
  const [comentariosVisibles, setComentariosVisibles] = useState(false)
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null)
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const puedeBorrar = post.autor.id === userId

  async function toggleComentarios() {
    if (!comentariosVisibles && comentarios === null) {
      const r = await fetch(`/api/portal/posts/${post.id}/comentarios`)
      const data = await r.json()
      setComentarios(data.comentarios)
    }
    setComentariosVisibles(v => !v)
  }

  async function enviarComentario() {
    if (!nuevoComentario.trim()) return
    setEnviando(true)
    const r = await fetch(`/api/portal/posts/${post.id}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: nuevoComentario.trim() }),
    })
    setEnviando(false)
    if (!r.ok) { toast.error('Error al comentar'); return }
    setNuevoComentario('')
    // Recargar comentarios
    const rr = await fetch(`/api/portal/posts/${post.id}/comentarios`)
    const data = await rr.json()
    setComentarios(data.comentarios)
    onReaccion() // refresca contador
  }

  async function borrarComentario(cid: number) {
    await fetch(`/api/portal/posts/${post.id}/comentarios/${cid}`, { method: 'DELETE' })
    setComentarios(prev => prev?.filter(c => c.id !== cid) ?? null)
    onReaccion()
  }

  async function darLike() {
    await fetch(`/api/portal/posts/${post.id}/reaccion`, { method: 'POST' })
    onReaccion()
  }

  async function borrarPost() {
    if (!confirm('¿Eliminar esta publicación?')) return
    const r = await fetch(`/api/portal/posts/${post.id}`, { method: 'DELETE' })
    if (!r.ok) { toast.error('Error al eliminar'); return }
    toast.success('Publicación eliminada')
    onDeleted()
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm">
      <div className="p-4 flex items-start gap-3">
        <Avatar nombre={post.autor.nombreCompleto} avatarUrl={post.autor.avatarUrl} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{post.autor.nombreCompleto}</p>
              {post.autor.rolNombre && (
                <p className="text-xs text-muted-foreground">{post.autor.rolNombre}</p>
              )}
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                {timeAgo(post.createdAt)}
                {' · '}
                {post.alcance === 'GLOBAL'
                  ? <><Globe size={10} /> Todos</>
                  : <><Users size={10} /> {post.categoria?.nombre}</>}
              </p>
            </div>
            {puedeBorrar && (
              <button
                onClick={borrarPost}
                className="text-muted-foreground hover:text-red-600 p-1 rounded transition-colors"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
      {post.contenido && (
        <div className="px-4 pb-3">
          <p className="text-sm whitespace-pre-wrap">{post.contenido}</p>
        </div>
      )}
      {post.imagenUrl && (
        <img src={post.imagenUrl} alt="" className="w-full max-h-[500px] object-cover border-t border-b border-border" />
      )}

      {(post.totalReacciones > 0 || post.totalComentarios > 0) && (
        <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border">
          <div className="flex items-center gap-1">
            {post.totalReacciones > 0 && (
              <>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500">
                  <ThumbsUp size={9} className="text-white" fill="white" />
                </span>
                <span>{post.totalReacciones}</span>
              </>
            )}
          </div>
          {post.totalComentarios > 0 && (
            <button onClick={toggleComentarios} className="hover:underline">
              {post.totalComentarios} comentario{post.totalComentarios !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      <div className="px-2 py-1 border-t border-border flex items-center gap-1">
        <button
          onClick={darLike}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm hover:bg-muted transition-colors ${
            post.miReaccion ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-muted-foreground'
          }`}
        >
          <ThumbsUp size={15} fill={post.miReaccion ? 'currentColor' : 'none'} />
          {post.miReaccion ? 'Te gusta' : 'Me gusta'}
        </button>
        <button
          onClick={toggleComentarios}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm hover:bg-muted text-muted-foreground transition-colors"
        >
          <MessageCircle size={15} />
          Comentar
        </button>
      </div>

      {comentariosVisibles && (
        <div className="border-t border-border p-3 space-y-2 bg-muted/30">
          {comentarios === null ? (
            <p className="text-xs text-muted-foreground text-center py-2">Cargando…</p>
          ) : comentarios.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Sé el primero en comentar</p>
          ) : (
            comentarios.map(c => (
              <div key={c.id} className="flex items-start gap-2 group">
                <Avatar nombre={c.autor.nombreCompleto} avatarUrl={c.autor.avatarUrl} size={28} />
                <div className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5">
                  <div className="flex items-baseline gap-2">
                    <p className="text-xs font-semibold">{c.autor.nombreCompleto}</p>
                    <p className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</p>
                  </div>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.contenido}</p>
                </div>
                {c.autor.id === userId && (
                  <button
                    onClick={() => borrarComentario(c.id)}
                    className="text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))
          )}
          <div className="flex gap-2 items-start pt-1">
            <Textarea
              value={nuevoComentario}
              onChange={e => setNuevoComentario(e.target.value)}
              placeholder="Escribí un comentario…"
              rows={1}
              className="resize-none min-h-[36px] text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComentario() }
              }}
            />
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-800 shrink-0"
              onClick={enviarComentario}
              disabled={enviando || !nuevoComentario.trim()}
            >
              <Send size={13} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PortalFeed() {
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<Post[]>([])
  const [userId, setUserId] = useState<number>(0)
  const [puedePublicar, setPuedePublicar] = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])

  async function load() {
    setLoading(true)
    const [rPosts, rCats] = await Promise.all([
      fetch('/api/portal/posts'),
      fetch('/api/categorias'),
    ])
    if (rPosts.ok) {
      const data = await rPosts.json()
      setPosts(data.posts)
      setUserId(data.userId)
      setPuedePublicar(data.puedePublicar)
    }
    if (rCats.ok) setCategorias(await rCats.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {puedePublicar && <NuevoPost onCreated={load} categorias={categorias} />}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-xl" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-sm text-muted-foreground">Todavía no hay publicaciones en el portal.</p>
          {puedePublicar && <p className="text-xs text-muted-foreground mt-1">¡Sé el primero en publicar algo!</p>}
        </div>
      ) : (
        posts.map(p => (
          <PostCard
            key={p.id}
            post={p}
            userId={userId}
            onDeleted={load}
            onReaccion={load}
          />
        ))
      )}
    </div>
  )
}
