'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Users, FileText, CalendarDays, Star, ClipboardCheck, CalendarOff, Settings, Rocket } from 'lucide-react'

const STORAGE_KEY = 'rrhh-bienvenida-admin-vista'

const slides = [
  {
    icon: Rocket,
    title: 'Bienvenido al sistema de RRHH',
    description: 'Este es un recorrido rápido por los módulos principales. Puede cerrarlo en cualquier momento y volver al manual completo desde Configuración › General.',
  },
  {
    icon: Users,
    title: 'Personal',
    description: 'Cree y administre el registro de todos los empleados. Acceda a su ficha completa, documentos, evaluaciones y formularios desde un mismo lugar.',
  },
  {
    icon: FileText,
    title: 'Documentos y Recibos',
    description: 'Cargue documentos de forma individual o en lotes masivos. Los recibos de sueldo se gestionan por separado y quedan disponibles para cada empleado en su portal.',
  },
  {
    icon: CalendarDays,
    title: 'Calendario',
    description: 'Gestione eventos de la organización y asígnelos a empleados. Configure los tipos de evento y sus permisos desde Configuración › Calendario.',
  },
  {
    icon: Star,
    title: 'Evaluaciones',
    description: 'Diseñe plantillas con criterios personalizados y organice rondas de evaluación. Los resultados quedan registrados en la ficha de cada empleado.',
  },
  {
    icon: ClipboardCheck,
    title: 'Formularios',
    description: 'Cree formularios a medida y asígnelos a empleados para que los completen desde su portal. Puede definir qué campos completa el empleado y cuáles el administrador.',
  },
  {
    icon: CalendarOff,
    title: 'Ausencias',
    description: 'Revise y apruebe las solicitudes de ausencia. Administre los saldos de vacaciones y configure los tipos de ausencia disponibles.',
  },
  {
    icon: Settings,
    title: 'Configuración',
    description: 'Personalice el nombre y logo de la aplicación, los campos de legajo, tipos de documento, roles y permisos, y mucho más desde el menú de Configuración.',
  },
]

export function WelcomeAdmin() {
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
        {/* Progress bar */}
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

        {/* Content */}
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

        {/* Footer */}
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

        {/* Dot indicators */}
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
