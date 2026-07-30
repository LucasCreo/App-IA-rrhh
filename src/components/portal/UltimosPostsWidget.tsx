'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Newspaper, ThumbsUp, MessageCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface Post {
  id: number
  contenido: string
  imagenUrl: string | null
  createdAt: string
  autor: { nombreCompleto: string; avatarUrl: string | null }
  totalReacciones: number
  totalComentarios: number
}

function preview(html: string): string {
  if (!html) return ''
  const soloTexto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (soloTexto) return soloTexto
  if (/<img/i.test(html)) return '[Imagen]'
  if (/<video/i.test(html)) return '[Video]'
  if (/<audio/i.test(html)) return '[Audio]'
  return ''
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime()
  const diff = (Date.now() - d) / 1000
  if (diff < 60) return 'hace instantes'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export function UltimosPostsWidget({ baseHref }: { baseHref: string }) {
  const [posts, setPosts] = useState<Post[] | null>(null)

  useEffect(() => {
    fetch('/api/portal/posts?limit=3')
      .then(r => r.json())
      .then(d => setPosts(d.posts ?? []))
      .catch(() => setPosts([]))
  }, [])

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold">Avisos</span>
        </div>
        <Link href={baseHref} className="text-xs text-green-700 dark:text-green-400 hover:underline">Ver todo</Link>
      </div>
      {posts === null ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded" />)}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8 px-4">
          No hay publicaciones aún.
        </p>
      ) : (
        <ul className="divide-y">
          {posts.map(p => (
            <li key={p.id}>
              <Link href={baseHref} className="block px-5 py-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {p.autor.nombreCompleto} · {timeAgo(p.createdAt)}
                    </p>
                    <p className="text-sm mt-0.5 line-clamp-2">
                      {preview(p.contenido) || (p.imagenUrl ? '[Imagen]' : '')}
                    </p>
                    {(p.totalReacciones > 0 || p.totalComentarios > 0) && (
                      <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                        {p.totalReacciones > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp size={10} />{p.totalReacciones}
                          </span>
                        )}
                        {p.totalComentarios > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle size={10} />{p.totalComentarios}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {p.imagenUrl && (
                    <img src={p.imagenUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
