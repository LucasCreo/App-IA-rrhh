'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, ThumbsUp, MessageCircle, Trash2, Globe, Users, Send, Plus, Pencil, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RichEditor } from './RichEditor'
import { AvatarDisplay } from '@/components/shared/AvatarDisplay'
import { handleApiError } from '@/lib/apiErrors'

const EDIT_WINDOW_MIN = 60 * 24
function dentroDeVentanaEdicion(createdAt: string): boolean {
  return (Date.now() - new Date(createdAt).getTime()) / 60000 <= EDIT_WINDOW_MIN
}

function PostContent({ html }: { html: string }) {
  if (!html) return null
  const esHtml = /<[a-z]/i.test(html)
  if (!esHtml) return <p className="text-sm whitespace-pre-wrap">{html}</p>
  return <div className="portal-content text-sm" dangerouslySetInnerHTML={{ __html: html }} />
}

function esContenidoVacio(html: string): boolean {
  // Tiptap emite <p></p> cuando el editor está vacío
  const limpio = html.replace(/<[^>]+>/g, '').trim()
  return limpio === ''
}

interface Categoria { id: number; nombre: string }
interface Autor {
  id: number
  avatarUrl: string | null
  avatarBgColor?: string | null
  avatarTextColor?: string | null
  nombreCompleto: string
  rolNombre: string | null
}
interface Post {
  id: number
  contenido: string
  imagenUrl: string | null
  alcance: 'GLOBAL' | 'CATEGORIA'
  categoria: { id: number; nombre: string } | null
  createdAt: string
  editedAt?: string | null
  autor: Autor
  totalReacciones: number
  miReaccion: string | null
  totalComentarios: number
}

interface Comentario {
  id: number
  contenido: string
  createdAt: string
  editedAt?: string | null
  autor: {
    id: number
    avatarUrl: string | null
    avatarBgColor?: string | null
    avatarTextColor?: string | null
    nombreCompleto: string
  }
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

function Avatar({ autor, size = 40 }: { autor: { nombreCompleto: string; avatarUrl: string | null; avatarBgColor?: string | null; avatarTextColor?: string | null }; size?: number }) {
  return (
    <AvatarDisplay
      nombre={autor.nombreCompleto}
      avatarUrl={autor.avatarUrl}
      bgColor={autor.avatarBgColor}
      textColor={autor.avatarTextColor}
      size={size}
    />
  )
}

function NuevoPost({ onCreated, categorias, isAdmin }: { onCreated: () => void; categorias: Categoria[]; isAdmin: boolean }) {
  const [expandido, setExpandido] = useState(false)
  const [contenido, setContenido] = useState('')
  const [alcance, setAlcance] = useState<'GLOBAL' | 'CATEGORIA'>('GLOBAL')
  const [categoriaId, setCategoriaId] = useState<string>('')
  const [publicando, setPublicando] = useState(false)

  function cerrar() {
    setExpandido(false)
    setContenido('')
    setAlcance('GLOBAL')
    setCategoriaId('')
  }

  async function handlePublish() {
    if (esContenidoVacio(contenido)) { toast.error('Escribí algo o insertá un archivo'); return }
    if (alcance === 'CATEGORIA' && !categoriaId) { toast.error('Elegí una categoría'); return }

    setPublicando(true)
    const fd = new FormData()
    fd.append('contenido', contenido)
    fd.append('alcance', alcance)
    if (alcance === 'CATEGORIA') fd.append('categoriaId', categoriaId)

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
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded transition-colors z-10"
        title="Cerrar"
      >
        <X size={16} />
      </button>
      <RichEditor
        value={contenido}
        onChange={setContenido}
        placeholder="¿Qué querés compartir con el equipo?"
        variant="full"
        minHeight={120}
        autoFocus
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Select value={alcance} onValueChange={v => setAlcance(v as any)}>
                <SelectTrigger className="w-52 h-9 text-sm">
                  <SelectValue>
                    {alcance === 'GLOBAL' ? 'Todos los empleados' : 'Por categoría'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GLOBAL">Todos los empleados</SelectItem>
                  <SelectItem value="CATEGORIA">Por categoría</SelectItem>
                </SelectContent>
              </Select>
              {alcance === 'CATEGORIA' && (
                <Select value={categoriaId} onValueChange={v => setCategoriaId(v ?? '')}>
                  <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Elegir…" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
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
  const [likesOpen, setLikesOpen] = useState(false)
  const [likes, setLikes] = useState<Array<{ id: number; nombreCompleto: string; avatarUrl: string | null; avatarBgColor?: string | null; avatarTextColor?: string | null }> | null>(null)
  const [editando, setEditando] = useState(false)
  const [contenidoEdit, setContenidoEdit] = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [comentarioEditId, setComentarioEditId] = useState<number | null>(null)
  const [comentarioEditContenido, setComentarioEditContenido] = useState('')
  const puedeBorrar = post.autor.id === userId
  const puedeEditarPost = post.autor.id === userId && dentroDeVentanaEdicion(post.createdAt)

  function iniciarEdicionPost() {
    setContenidoEdit(post.contenido)
    setEditando(true)
  }

  async function guardarEdicionPost() {
    if (esContenidoVacio(contenidoEdit)) { toast.error('El contenido no puede quedar vacío'); return }
    setGuardandoEdit(true)
    const r = await fetch(`/api/portal/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: contenidoEdit }),
    })
    setGuardandoEdit(false)
    if (!r.ok) { await handleApiError(r); return }
    toast.success('Publicación actualizada')
    setEditando(false)
    onReaccion()
  }

  function iniciarEdicionComentario(c: Comentario) {
    setComentarioEditId(c.id)
    setComentarioEditContenido(c.contenido)
  }

  async function guardarEdicionComentario() {
    if (comentarioEditId === null) return
    if (esContenidoVacio(comentarioEditContenido)) { toast.error('El comentario no puede quedar vacío'); return }
    const cid = comentarioEditId
    const r = await fetch(`/api/portal/posts/${post.id}/comentarios/${cid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: comentarioEditContenido }),
    })
    if (!r.ok) { await handleApiError(r); return }
    setComentarioEditId(null)
    setComentarios(prev => prev?.map(c => c.id === cid ? { ...c, contenido: comentarioEditContenido, editedAt: new Date().toISOString() } : c) ?? null)
  }

  async function abrirLikes() {
    setLikesOpen(true)
    if (likes === null) {
      const r = await fetch(`/api/portal/posts/${post.id}/reaccion/lista`)
      if (r.ok) setLikes(await r.json())
      else setLikes([])
    }
  }

  async function toggleComentarios() {
    if (!comentariosVisibles && comentarios === null) {
      const r = await fetch(`/api/portal/posts/${post.id}/comentarios`)
      const data = await r.json()
      setComentarios(data.comentarios)
    }
    setComentariosVisibles(v => !v)
  }

  async function enviarComentario() {
    if (esContenidoVacio(nuevoComentario)) return
    setEnviando(true)
    const r = await fetch(`/api/portal/posts/${post.id}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: nuevoComentario }),
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
    setLikes(null) // invalidar cache
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
        <Avatar autor={post.autor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{post.autor.nombreCompleto}</p>
              {post.autor.rolNombre && (
                <p className="text-xs text-muted-foreground">{post.autor.rolNombre}</p>
              )}
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                {timeAgo(post.createdAt)}
                {post.editedAt && <span className="italic">· editado</span>}
                {' · '}
                {post.alcance === 'GLOBAL'
                  ? <><Globe size={10} /> Todos</>
                  : <><Users size={10} /> {post.categoria?.nombre}</>}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {puedeEditarPost && !editando && (
                <button
                  onClick={iniciarEdicionPost}
                  className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
              )}
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
      </div>
      {editando ? (
        <div className="px-4 pb-3 space-y-2">
          <RichEditor value={contenidoEdit} onChange={setContenidoEdit} placeholder="Editá el contenido…" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditando(false)} disabled={guardandoEdit}>
              Cancelar
            </Button>
            <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={guardarEdicionPost} disabled={guardandoEdit}>
              <Check size={13} className="mr-1" />{guardandoEdit ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      ) : post.contenido && (
        <div className="px-4 pb-3">
          <PostContent html={post.contenido} />
        </div>
      )}
      {post.imagenUrl && (
        <img src={post.imagenUrl} alt="" className="w-full max-h-[500px] object-cover border-t border-b border-border" />
      )}

      {(post.totalReacciones > 0 || post.totalComentarios > 0) && (
        <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border">
          <div className="flex items-center gap-1">
            {post.totalReacciones > 0 && (
              <button onClick={abrirLikes} className="flex items-center gap-1 hover:underline">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500">
                  <ThumbsUp size={9} className="text-white" fill="white" />
                </span>
                <span>{post.totalReacciones}</span>
              </button>
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
            comentarios.map(c => {
              const puedeEditarComentario = c.autor.id === userId && dentroDeVentanaEdicion(c.createdAt)
              const editandoEste = comentarioEditId === c.id
              return (
                <div key={c.id} className="flex items-start gap-2 group">
                  <Avatar autor={c.autor} size={28} />
                  <div className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5">
                    <div className="flex items-baseline gap-2">
                      <p className="text-xs font-semibold">{c.autor.nombreCompleto}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {timeAgo(c.createdAt)}{c.editedAt && <span className="italic"> · editado</span>}
                      </p>
                    </div>
                    {editandoEste ? (
                      <div className="mt-1 space-y-1.5">
                        <RichEditor
                          value={comentarioEditContenido}
                          onChange={setComentarioEditContenido}
                          variant="mini"
                          minHeight={40}
                          onSubmit={guardarEdicionComentario}
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => setComentarioEditId(null)}>
                            Cancelar
                          </Button>
                          <Button size="sm" className="bg-green-700 hover:bg-green-800 h-6 text-[11px] px-2" onClick={guardarEdicionComentario}>
                            Guardar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-0.5"><PostContent html={c.contenido} /></div>
                    )}
                  </div>
                  {c.autor.id === userId && !editandoEste && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {puedeEditarComentario && (
                        <button
                          onClick={() => iniciarEdicionComentario(c)}
                          className="text-muted-foreground hover:text-foreground p-1"
                          title="Editar"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                      <button
                        onClick={() => borrarComentario(c.id)}
                        className="text-muted-foreground hover:text-red-600 p-1"
                        title="Eliminar"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
          <div className="flex gap-2 items-start pt-1">
            <div className="flex-1">
              <RichEditor
                value={nuevoComentario}
                onChange={setNuevoComentario}
                placeholder="Escribí un comentario…"
                variant="mini"
                minHeight={40}
                onSubmit={enviarComentario}
              />
            </div>
            <Button
              size="sm"
              className="bg-green-700 hover:bg-green-800 shrink-0"
              onClick={enviarComentario}
              disabled={enviando || esContenidoVacio(nuevoComentario)}
            >
              <Send size={13} />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={likesOpen} onOpenChange={setLikesOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reacciones</DialogTitle>
          </DialogHeader>
          {likes === null ? (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando…</p>
          ) : likes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Todavía no hay reacciones.</p>
          ) : (
            <ul className="divide-y max-h-80 overflow-y-auto -mx-6">
              {likes.map(l => (
                <li key={l.id} className="flex items-center gap-3 px-6 py-2">
                  <AvatarDisplay
                    nombre={l.nombreCompleto}
                    avatarUrl={l.avatarUrl}
                    bgColor={l.avatarBgColor}
                    textColor={l.avatarTextColor}
                    size={32}
                  />
                  <span className="text-sm">{l.nombreCompleto}</span>
                  <span className="ml-auto inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 shrink-0">
                    <ThumbsUp size={9} className="text-white" fill="white" />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function PortalFeed() {
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<Post[]>([])
  const [userId, setUserId] = useState<number>(0)
  const [puedePublicar, setPuedePublicar] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
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
      setIsAdmin(!!data.isAdmin)
    }
    if (rCats.ok) setCategorias(await rCats.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {puedePublicar && <NuevoPost onCreated={load} categorias={categorias} isAdmin={isAdmin} />}
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
