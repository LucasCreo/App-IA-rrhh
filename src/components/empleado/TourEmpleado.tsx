'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, LayoutDashboard, FileText, FolderOpen, CalendarDays, CalendarOff, UserCircle, BookOpen } from 'lucide-react'

const STORAGE_KEY = 'rrhh-tour-empleado-visto'

const slides = [
  {
    icon: LayoutDashboard,
    title: 'Bienvenido al Portal del Empleado',
    description: 'Este es un recorrido rápido por los módulos disponibles. Puede cerrarlo en cualquier momento y volver al Manual de uso desde el menú lateral.',
  },
  {
    icon: LayoutDashboard,
    title: 'Inicio',
    description: 'El panel de inicio muestra un resumen de su actividad: recibos recientes, documentos pendientes, próximos eventos y formularios asignados.',
  },
  {
    icon: FileText,
    title: 'Recibos de sueldo',
    description: 'Visualice y descargue sus recibos de haberes. Si un recibo requiere confirmación de recepción, podrá firmarlo digitalmente desde esta sección.',
  },
  {
    icon: FolderOpen,
    title: 'Documentos',
    description: 'Acceda a los documentos que Recursos Humanos ha puesto a su disposición, realice solicitudes de nuevos documentos y complete los formularios asignados.',
  },
  {
    icon: CalendarDays,
    title: 'Calendario',
    description: 'Visualice los eventos de la organización y sus eventos personales. También puede sincronizar con Google Calendar desde su perfil.',
  },
  {
    icon: CalendarOff,
    title: 'Ausencias',
    description: 'Solicite licencias, vacaciones u otros tipos de ausencia. Consulte su saldo de días disponibles y el estado de cada solicitud.',
  },
  {
    icon: UserCircle,
    title: 'Mi perfil',
    description: 'Actualice su foto de perfil, cambie su contraseña, solicite modificaciones de datos personales y vincule su cuenta de Google Calendar.',
  },
  {
    icon: BookOpen,
    title: 'Manual de uso',
    description: 'Acceda al manual completo del portal desde el enlace en la parte inferior del menú lateral. Contiene instrucciones detalladas de cada módulo.',
  },
]

export function TourEmpleado() {
  const [open, setOpen] = useState(false)
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
  }, [])

  function close() {
    localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  if (!open) return null

  const current = slides[slide]
  const Icon = current.icon
  const isLast = slide === slides.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-background rounded-xl shadow-2xl border border-border overflow-hidden">
        <div className="h-1 bg-muted">
          <div
            className="h-1 bg-green-600 transition-all duration-300"
            style={{ width: `${((slide + 1) / slides.length) * 100}%` }}
          />
        </div>

        <button
          onClick={close}
          className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>

        <div className="px-8 py-8 text-center">
          <p className="text-xs text-muted-foreground mb-4">{slide + 1} de {slides.length}</p>
          <div className="flex justify-center mb-5">
            <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
              <Icon size={26} className="text-green-700 dark:text-green-400" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-foreground mb-3">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
        </div>

        <div className="pl-4 pr-8 pb-6 flex items-center justify-between">
          <div>
            {!isLast && (
              <button
                onClick={close}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors"
              >
                Omitir
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {slide > 0 && (
              <button
                onClick={() => setSlide(s => s - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <ChevronLeft size={15} /> Anterior
              </button>
            )}
            {isLast ? (
              <button
                onClick={close}
                className="flex items-center gap-1 px-4 py-1.5 rounded-md text-sm bg-green-700 hover:bg-green-800 text-white transition-colors font-medium"
              >
                Comenzar <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={() => setSlide(s => s + 1)}
                className="flex items-center gap-1 px-4 py-1.5 rounded-md text-sm bg-green-700 hover:bg-green-800 text-white transition-colors font-medium"
              >
                Siguiente <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-1.5 pb-5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-4 bg-green-600' : 'w-1.5 bg-muted-foreground/30'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
