'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Shield, Search, ZoomIn, ZoomOut, RotateCcw, Locate } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Nodo {
  id: number
  email: string
  role: string
  managerUserId: number | null
  empleado: {
    id: number
    nombre: string
    apellido: string
    legajo: string
    categoria: string | null
  } | null
  hijos: Nodo[]
}

function matches(n: Nodo, q: string): boolean {
  if (!q) return false
  const lower = q.toLowerCase()
  if (n.empleado) {
    const full = `${n.empleado.apellido} ${n.empleado.nombre}`.toLowerCase()
    return full.includes(lower) || n.empleado.legajo.toLowerCase().includes(lower)
  }
  return n.email.toLowerCase().includes(lower)
}

function Card({ nodo, highlight }: { nodo: Nodo; highlight: boolean }) {
  const inner = (
    <div className={cn(
      'bg-card border rounded-xl px-4 py-3 shadow-sm hover:shadow-md hover:border-green-500 dark:hover:border-green-600 transition-all min-w-[200px]',
      highlight ? 'border-green-500 ring-2 ring-green-500/40' : 'border-border'
    )}>
      {nodo.empleado ? (
        <>
          <p className="text-sm font-semibold text-foreground leading-tight">
            {nodo.empleado.apellido}, {nodo.empleado.nombre}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {nodo.empleado.categoria ?? '—'} · Legajo {nodo.empleado.legajo}
          </p>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-green-700 dark:text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{nodo.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Admin sin legajo</p>
          </div>
        </div>
      )}
    </div>
  )
  return nodo.empleado
    ? <Link href={`/admin/empleados/${nodo.empleado.id}`} className="inline-block">{inner}</Link>
    : <div className="inline-block">{inner}</div>
}

function Rama({ nodo, q }: { nodo: Nodo; q: string }) {
  const tieneHijos = nodo.hijos.length > 0
  return (
    <div className="flex flex-col items-center">
      <Card nodo={nodo} highlight={matches(nodo, q)} />
      {tieneHijos && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="relative flex gap-6 pt-6">
            {nodo.hijos.length > 1 && (
              <div className="absolute top-0 h-px bg-border" style={{ left: '20%', right: '20%' }} />
            )}
            {nodo.hijos.map(h => (
              <div key={h.id} className="relative flex flex-col items-center">
                <div className="absolute -top-6 w-px h-6 bg-border" />
                <Rama nodo={h} q={q} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function contarMatches(nodo: Nodo, q: string): number {
  return (matches(nodo, q) ? 1 : 0) + nodo.hijos.reduce((s, h) => s + contarMatches(h, q), 0)
}

export function OrganigramaView() {
  const [roots, setRoots] = useState<Nodo[] | null>(null)
  const [q, setQ] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ zoom, pan })
  stateRef.current = { zoom, pan }

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const { zoom: z, pan: p } = stateRef.current
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const next = Math.max(0.5, Math.min(1.5, z * factor))
      const k = next / z
      setZoom(next)
      setPan({ x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [roots])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // No arrastrar si el click empezó sobre un link (para no romper el click en tarjetas)
    if ((e.target as HTMLElement).closest('a')) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    setDragging(true)
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
    })
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null
    setDragging(false)
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId) } catch {}
  }

  function resetVista() {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

  useEffect(() => {
    fetch('/api/organigrama')
      .then(r => r.json())
      .then((data: Omit<Nodo, 'hijos'>[]) => {
        const map = new Map<number, Nodo>()
        data.forEach(u => map.set(u.id, { ...u, hijos: [] }))
        const rs: Nodo[] = []
        map.forEach(n => {
          if (n.managerUserId && map.has(n.managerUserId)) {
            map.get(n.managerUserId)!.hijos.push(n)
          } else {
            rs.push(n)
          }
        })
        setRoots(rs)
      })
  }, [])

  const totalMatches = useMemo(
    () => (roots && q ? roots.reduce((s, r) => s + contarMatches(r, q), 0) : 0),
    [roots, q]
  )

  if (roots === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    )
  }
  if (roots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
        <Users size={32} strokeWidth={1.2} />
        <p className="text-sm">No hay usuarios activos.</p>
        <p className="text-xs">Configurá quién reporta a quién desde Configuración → Usuarios.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nombre o legajo…"
            className="pl-9 h-9 text-sm"
          />
        </div>
        {q && (
          <span className="text-xs text-muted-foreground">
            {totalMatches} coincidencia{totalMatches !== 1 ? 's' : ''}
          </span>
        )}
        <div className="flex items-center gap-1 border rounded-md">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            title="Alejar"
          >
            <ZoomOut size={14} />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
            title="Acercar"
          >
            <ZoomIn size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setZoom(1)}
            title="Restablecer zoom"
          >
            <RotateCcw size={13} />
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={resetVista}
          title="Volver al inicio"
        >
          <Locate size={13} /> Centrar
        </Button>
      </div>
      <div
        ref={canvasRef}
        className={cn(
          'relative overflow-hidden border border-dashed border-border/60 rounded-lg bg-muted/20 touch-none select-none',
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        style={{ height: 'calc(100vh - 260px)', minHeight: 400 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex gap-12 justify-center min-w-max px-6 pt-6 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: dragging ? 'none' : 'transform 0.15s',
          }}
        >
          {roots.map(r => <Rama key={r.id} nodo={r} q={q} />)}
        </div>
      </div>
    </div>
  )
}
