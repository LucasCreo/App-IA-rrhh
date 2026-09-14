'use client'

import { useEffect, useRef, useState } from 'react'
import { X, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'rrhh-tour-dashboard-visto'

type Lado = 'derecha' | 'abajo' | 'arriba'

interface Paso {
  sel: string
  lado: Lado
  titulo: string
  texto: string
}

const PASOS: Paso[] = [
  {
    sel: '[data-tour="sidebar"]',
    lado: 'derecha',
    titulo: 'Bienvenido a LPA · Recursos Humanos',
    texto: 'Este es un recorrido rápido por los módulos principales. Puede cerrarlo en cualquier momento y volver al manual completo desde su perfil.',
  },
  {
    sel: '[data-tour="sidebar"]',
    lado: 'derecha',
    titulo: 'Los módulos, siempre a mano',
    texto: 'Desde acá entrás a todo: Avisos (comunicados internos), Legajos (la ficha de cada persona), Recibos (lotes y firma), Documentos, Solicitudes, Licencias y Calendario. El módulo abierto queda marcado en verde.',
  },
  {
    sel: '[data-tour="titulo"]',
    lado: 'abajo',
    titulo: 'Tu pantalla de inicio',
    texto: 'El Dashboard es lo primero que ves al entrar: el estado del equipo en un vistazo, sin abrir ningún módulo. Vamos parte por parte.',
  },
  {
    sel: '[data-tour="saludo"]',
    lado: 'abajo',
    titulo: 'Saludo y fecha del sistema',
    texto: 'Confirma con qué usuario estás trabajando y la fecha que toma el sistema para vencimientos, períodos de liquidación y licencias.',
  },
  {
    sel: '[data-tour="kpi"]',
    lado: 'abajo',
    titulo: 'Tarjetas KPI',
    texto: 'El acumulado histórico de Recibos, Documentos y Solicitudes. Hacé clic en cualquier tarjeta y caés directo al módulo, ya filtrado.',
  },
  {
    sel: '[data-tour="graficos"]',
    lado: 'arriba',
    titulo: 'Gráficos de estado',
    texto: 'Recibos por estado (firmados, enviados, borradores), empleados por área y solicitudes aprobadas o rechazadas. Pasá el mouse por una porción para ver el detalle.',
  },
  {
    sel: '[data-tour="eventos"]',
    lado: 'arriba',
    titulo: 'Próximos eventos',
    texto: 'Vista rápida de los eventos empresariales entrantes o de los propios usuarios, como faltas, vacaciones, reuniones etc. Con "Ver calendario" abrís la vista completa.',
  },
  {
    sel: '[data-tour="avisos"]',
    lado: 'arriba',
    titulo: 'Avisos',
    texto: 'Las últimas publicaciones del feed interno, con sus adjuntos. Desde el módulo Avisos publicás uno nuevo y ves reacciones y comentarios.',
  },
  {
    sel: '[data-tour="pendientes"]',
    lado: 'arriba',
    titulo: 'Pendientes de revisión',
    texto: 'Acá aparece lo que frena un lote: recibos duplicados, archivos sin legajo asignado y errores de ingesta del SFTP. Si hay algo, resolvelo desde este bloque.',
  },
  {
    sel: '[data-tour="incorporados"]',
    lado: 'arriba',
    titulo: 'Últimos incorporados',
    texto: 'Las altas más recientes con su categoría y número de legajo. Un clic en la persona abre su legajo completo.',
  },
  {
    sel: '[data-tour="personalizar"]',
    lado: 'abajo',
    titulo: 'Armá tu dashboard',
    texto: 'Con "Personalizar" arrastrás los bloques para reordenarlos y usás el ojo para mostrar u ocultar cada uno. Siempre podés restaurar por defecto.',
  },
  {
    sel: '[data-tour="cuenta"]',
    lado: 'derecha',
    titulo: 'Tu cuenta y la configuración',
    texto: 'Desde Configuración definís tipos de documento, patrones de recibos, SFTP y permisos. Abajo cambiás entre modo claro y oscuro, y cerrás sesión. El manual completo vive en tu perfil.',
  },
]

interface Rect { top: number; left: number; width: number; height: number; right: number; bottom: number }

const TIP_WIDTH = 336
const MARGEN = 16
const PAD_FOCO = 8
const MARGEN_SCROLL = 28
const OPACIDAD_SCRIM = 0.62
const ALTO_TIP_DEFAULT = 250

export function TourDashboardAdmin() {
  const [mounted, setMounted] = useState(false)
  const [activo, setActivo] = useState(false)
  const [visto, setVisto] = useState(false)          // ya vio el tour al menos una vez
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [altoTip, setAltoTip] = useState(ALTO_TIP_DEFAULT)

  const tipRef = useRef<HTMLDivElement | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tPasoRef = useRef(0)
  const activoRef = useRef(false)
  const iRef = useRef(0)
  useEffect(() => { activoRef.current = activo }, [activo])
  useEffect(() => { iRef.current = i }, [i])

  // Inicial: si nunca lo vio, abrir
  useEffect(() => {
    setMounted(true)
    const vistoLS = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1'
    setVisto(vistoLS)
    if (!vistoLS) setActivo(true)
  }, [])

  // Listeners globales y ticker
  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => {
      if (!activoRef.current) return
      if (e.key === 'Escape') cerrar()
      if (e.key === 'ArrowRight') ir(1)
      if (e.key === 'ArrowLeft') ir(-1)
    }
    const onScroll = () => { if (activoRef.current) medir() }
    const onResize = () => { if (activoRef.current) { acomodar(false); medir() } }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (activoRef.current) medir() })
      ro.observe(document.documentElement)
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      if (tickRef.current) clearInterval(tickRef.current)
      tickRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  // Cuando cambia el paso o se activa, enfocar
  useEffect(() => {
    if (!activo) return
    tPasoRef.current = Date.now()
    // dar un tick para que el DOM del target exista antes de medir
    requestAnimationFrame(() => { acomodar(false); medir(); arrancarTicker() })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, i])

  function arrancarTicker() {
    if (tickRef.current) return
    tickRef.current = setInterval(() => {
      if (!activoRef.current) return
      if (Date.now() - tPasoRef.current < 2000) acomodar(false)
      medir()
    }, 60)
  }

  function detenerTicker() {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
  }

  function scrollerDe(el: Element | null): HTMLElement | null {
    let n = el?.parentElement ?? null
    while (n && n !== document.body && n !== document.documentElement) {
      const ov = getComputedStyle(n).overflowY
      if ((ov === 'auto' || ov === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n
      n = n.parentElement
    }
    return null
  }

  function medir() {
    const paso = PASOS[iRef.current]
    if (!paso) return
    const el = document.querySelector(paso.sel) as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) return
    // altura real del tip
    const tipEl = tipRef.current
    if (tipEl) {
      const h = Math.round(tipEl.getBoundingClientRect().height)
      if (h && h < window.innerHeight && Math.abs(h - altoTip) > 2) setAltoTip(h)
    }
    setRect(prev => {
      if (
        prev &&
        Math.abs(prev.top - r.top) < 0.5 &&
        Math.abs(prev.left - r.left) < 0.5 &&
        Math.abs(prev.width - r.width) < 0.5 &&
        Math.abs(prev.height - r.height) < 0.5
      ) return prev
      return { top: r.top, left: r.left, width: r.width, height: r.height, right: r.right, bottom: r.bottom }
    })
  }

  function acomodar(suave: boolean) {
    const paso = PASOS[iRef.current]
    if (!paso) return
    const el = document.querySelector(paso.sel) as HTMLElement | null
    if (!el) return
    const sc = scrollerDe(el)
    const r = el.getBoundingClientRect()
    const topVis = sc ? sc.getBoundingClientRect().top : 0
    const botVis = sc ? sc.getBoundingClientRect().bottom : window.innerHeight
    const banda = botVis - topVis - MARGEN_SCROLL * 2
    let delta = 0
    if (r.height > banda) delta = r.top - topVis - MARGEN_SCROLL
    else if (r.top < topVis + MARGEN_SCROLL) delta = r.top - topVis - MARGEN_SCROLL
    else if (r.bottom > botVis - MARGEN_SCROLL) delta = r.bottom - botVis + MARGEN_SCROLL
    if (Math.abs(delta) < 1) return
    if (!sc) window.scrollBy({ top: delta, behavior: suave ? 'smooth' : 'auto' })
    else sc.scrollTo({ top: sc.scrollTop + delta, behavior: suave ? 'smooth' : 'auto' })
  }

  function ir(d: number) {
    setI(prev => {
      const next = prev + d
      if (next >= PASOS.length) { cerrar(); return prev }
      return Math.min(Math.max(next, 0), PASOS.length - 1)
    })
  }

  function cerrar() {
    detenerTicker()
    setActivo(false)
    setVisto(true)
    setI(0)
    setRect(null)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
  }

  function reiniciar() {
    setI(0)
    setRect(null)
    setActivo(true)
  }

  if (!mounted) return null

  const paso = PASOS[i]
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768

  const clampTop = (t: number) => Math.min(Math.max(t, MARGEN), Math.max(vh - altoTip - MARGEN, MARGEN))
  const clampLeft = (l: number) => Math.min(Math.max(l, MARGEN), Math.max(vw - TIP_WIDTH - MARGEN, MARGEN))

  let lado: Lado = paso.lado
  if (rect) {
    const cabeAbajo = rect.bottom + MARGEN + altoTip <= vh - MARGEN
    const cabeArriba = rect.top - MARGEN - altoTip >= MARGEN
    if (lado === 'abajo' && !cabeAbajo && cabeArriba) lado = 'arriba'
    if (lado === 'arriba' && !cabeArriba && cabeAbajo) lado = 'abajo'
  }

  let tipPos: { top: number; left: number }
  if (rect) {
    if (lado === 'derecha')      tipPos = { top: clampTop(rect.top), left: clampLeft(rect.right + MARGEN) }
    else if (lado === 'abajo')   tipPos = { top: clampTop(rect.bottom + MARGEN), left: clampLeft(rect.left) }
    else                          tipPos = { top: clampTop(rect.top - MARGEN - altoTip), left: clampLeft(rect.left) }
  } else {
    tipPos = { top: Math.round((vh - altoTip) / 2), left: Math.round((vw - TIP_WIDTH) / 2) }
  }

  return (
    <>
      {activo && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* Spotlight con scrim via box-shadow */}
          <div
            onClick={cerrar}
            className="fixed rounded-[14px] pointer-events-auto"
            style={{
              top:    (rect ? rect.top - PAD_FOCO : vh / 2) + 'px',
              left:   (rect ? rect.left - PAD_FOCO : vw / 2) + 'px',
              width:  (rect ? rect.width + PAD_FOCO * 2 : 0) + 'px',
              height: (rect ? rect.height + PAD_FOCO * 2 : 0) + 'px',
              boxShadow: `0 0 0 9999px rgba(10,10,10,${OPACIDAD_SCRIM})`,
              outline: '2px solid #16a34a',
              outlineOffset: '2px',
              transition: 'all .35s cubic-bezier(.4,0,.2,1)',
            }}
          />

          {/* Cartel */}
          <div
            ref={tipRef}
            className="fixed z-[51] pointer-events-auto rounded-xl border border-border bg-card shadow-xl"
            style={{
              top: tipPos.top + 'px',
              left: tipPos.left + 'px',
              width: TIP_WIDTH + 'px',
              animation: 'tourFadeIn .28s ease-out',
              transition: 'top .35s cubic-bezier(.4,0,.2,1), left .35s cubic-bezier(.4,0,.2,1)',
            }}
          >
            <div className="flex items-start justify-between px-5 pt-4">
              <span className="text-[10.5px] tracking-[.07em] font-semibold text-green-700 dark:text-green-400 whitespace-nowrap">
                PASO {i + 1} DE {PASOS.length}
              </span>
              <button
                onClick={cerrar}
                aria-label="Cerrar recorrido"
                className="p-1 -mt-1 -mr-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <h3 className="px-5 pt-2 text-base font-bold tracking-tight text-foreground">{paso.titulo}</h3>
            <p className="px-5 pt-2 text-[13px] leading-[1.55] text-muted-foreground text-pretty">{paso.texto}</p>

            {/* Progreso 12 segmentos */}
            <div className="flex items-center gap-[5px] px-5 pt-4">
              {PASOS.map((_, n) => (
                <span
                  key={n}
                  className="flex-1 h-[3px] rounded-[2px] transition-colors"
                  style={{ background: n <= i ? '#166534' : 'oklch(0.92 0.005 85)' }}
                />
              ))}
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-between gap-2 px-5 py-4">
              <button
                onClick={cerrar}
                className="px-2 py-1 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cerrar recorrido
              </button>
              <div className="flex gap-2">
                {i > 0 && (
                  <button
                    onClick={() => ir(-1)}
                    className="px-3 py-1.5 rounded-md text-sm border border-border hover:bg-muted transition-colors"
                  >
                    Anterior
                  </button>
                )}
                <button
                  onClick={() => ir(1)}
                  className="px-3 py-1.5 rounded-md text-sm bg-green-700 hover:bg-green-800 text-white transition-colors font-medium"
                >
                  {i === PASOS.length - 1 ? 'Entendido' : 'Siguiente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante para reabrir cuando ya lo vio */}
      {!activo && visto && (
        <div className="fixed right-5 bottom-5 z-40">
          <Button size="sm" className="gap-1.5 shadow-xl bg-green-700 hover:bg-green-800" onClick={reiniciar}>
            <HelpCircle size={14} /> Ver el recorrido
          </Button>
        </div>
      )}

      <style jsx>{`
        @keyframes tourFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </>
  )
}
