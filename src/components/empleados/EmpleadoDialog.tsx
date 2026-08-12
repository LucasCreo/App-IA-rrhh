'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { parseApiError, showApiError } from '@/lib/apiErrors'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { Paperclip, X, ChevronDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { SolicitudesModificacionAdmin } from './SolicitudesModificacionAdmin'
import { validarCuil, maskCuilInput } from '@/lib/cuil'

interface Categoria { id: number; nombre: string }
interface Empleado {
  id?: number; legajo: string; nombre: string; apellido: string; cuil: string
  email: string; telefono?: string; fechaIngreso: string; categoriaId: number; estado: string
}
interface FieldConfig { campo: string; visible: boolean; requerido: boolean; eliminado: boolean; visibleEnAlta: boolean }
interface CampoPersonalizado { id: number; nombre: string; tipo: string; visible: boolean; requerido: boolean; visibleEnAlta: boolean }
interface Props { open: boolean; onClose: () => void; onSaved: () => void; empleado?: Empleado }

const empty: Empleado = {
  legajo: '', nombre: '', apellido: '', cuil: '', email: '',
  telefono: '', fechaIngreso: '', categoriaId: 0, estado: 'ACTIVO',
}

const TEXT_FIELDS: Array<[keyof Empleado, string]> = [
  ['legajo', 'Legajo'], ['cuil', 'CUIL'], ['email', 'Email'], ['telefono', 'Teléfono'],
]

export function EmpleadoDialog({ open, onClose, onSaved, empleado }: Props) {
  const router = useRouter()
  const isNew = !empleado?.id
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState<Empleado>(empleado ?? empty)
  const [cats, setCats] = useState<Categoria[]>([])
  const [catsLoaded, setCatsLoaded] = useState(false)
  const [fieldConfig, setFieldConfig] = useState<FieldConfig[]>([])
  const [camposCustom, setCamposCustom] = useState<CampoPersonalizado[]>([])
  const [valoresCustom, setValoresCustom] = useState<Record<number, string>>({})
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [crearUsuario, setCrearUsuario] = useState(false)
  const [modoAcceso, setModoAcceso] = useState<'password' | 'invitacion'>('invitacion')
  const [existingUser, setExistingUser] = useState<{ id: number; email: string; username: string | null } | null>(null)
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const [showAdicional, setShowAdicional] = useState(false)

  useEffect(() => {
    if (!open) return
    setCatsLoaded(false)
    setStep(1)
    fetch('/api/categorias').then(r => r.json()).then(data => { setCats(data); setCatsLoaded(true) })
    fetch('/api/configuracion/empleados-campos').then(r => r.json()).then(setFieldConfig)
    fetch('/api/configuracion/campos-personalizados').then(r => r.json()).then(setCamposCustom)
    setForm(empleado ?? empty)
    setPassword('')
    setUsername('')
    setCrearUsuario(false)
    setModoAcceso('invitacion')
    setExistingUser(null)
    setErrors(new Set())
    if (empleado?.id) {
      fetch(`/api/empleados/${empleado.id}`)
        .then(r => r.json())
        .then(data => {
          const map: Record<number, string> = {}
          for (const v of data.valoresCampos ?? []) map[v.campoId] = v.valor
          setValoresCustom(map)
          setExistingUser(data.user ?? null)
          setUsername(data.user?.username ?? '')
        })
    } else {
      setValoresCustom({})
    }
  }, [empleado, open])

  function isVisible(campo: string) {
    const cfg = fieldConfig.find(f => f.campo === campo)
    if (!cfg) return true
    return cfg.visible && !cfg.eliminado
  }

  function isRequired(campo: string) {
    const cfg = fieldConfig.find(f => f.campo === campo)
    return cfg ? cfg.requerido : false
  }

  function isEnAlta(campo: string) {
    const cfg = fieldConfig.find(f => f.campo === campo)
    return cfg ? cfg.visibleEnAlta : true
  }

  // Un campo estándar se muestra en la sección principal si es visible y (estamos editando y va en alta, o creando y va en alta).
  // En la sección "Información adicional" (solo edición) van los visibles que no estén marcados como "en alta".
  function isInMain(campo: string) {
    return isVisible(campo) && isEnAlta(campo)
  }
  function isInAdicional(campo: string) {
    return !isNew && isVisible(campo) && !isEnAlta(campo)
  }

  function clearError(key: string) {
    setErrors(prev => { const s = new Set(prev); s.delete(key); return s })
  }

  const set = (k: keyof Empleado) => (val: string) => {
    setForm(f => ({ ...f, [k]: val }))
    clearError(k as string)
  }

  function validateStep1() {
    const errs = new Set<string>()
    if (!form.email.trim()) errs.add('email')
    if (modoAcceso === 'password' && !password) errs.add('password')
    setErrors(errs)
    return errs.size === 0
  }

  function validateStep2() {
    const errs = new Set<string>()
    if (!form.nombre.trim()) errs.add('nombre')
    if (!form.apellido.trim()) errs.add('apellido')
    for (const [k] of TEXT_FIELDS) {
      if (k === 'email') continue
      if (isVisible(k as string) && isRequired(k as string) && !(form[k] as string)?.trim())
        errs.add(k as string)
    }
    if (isVisible('fechaIngreso') && isRequired('fechaIngreso') && !form.fechaIngreso) errs.add('fechaIngreso')
    if (isVisible('categoria') && isRequired('categoria') && !form.categoriaId) errs.add('categoria')
    if (isVisible('cuil') && form.cuil?.trim() && !validarCuil(form.cuil)) errs.add('cuil')
    for (const c of camposCustom.filter(c => c.visible && c.requerido)) {
      const val = valoresCustom[c.id]
      if (c.tipo === 'booleano') continue
      if (!val || val.trim() === '') errs.add(`custom_${c.id}`)
    }
    setErrors(errs)
    return errs.size === 0
  }

  function validateEdit() {
    const errs = new Set<string>()
    if (!form.nombre.trim()) errs.add('nombre')
    if (!form.apellido.trim()) errs.add('apellido')
    for (const [k] of TEXT_FIELDS) {
      if (isVisible(k as string) && isRequired(k as string) && !(form[k] as string)?.trim())
        errs.add(k as string)
    }
    if (isVisible('fechaIngreso') && isRequired('fechaIngreso') && !form.fechaIngreso) errs.add('fechaIngreso')
    if (isVisible('categoria') && isRequired('categoria') && !form.categoriaId) errs.add('categoria')
    if (isVisible('cuil') && form.cuil?.trim() && !validarCuil(form.cuil)) errs.add('cuil')
    for (const c of camposCustom.filter(c => c.visible && c.requerido)) {
      const val = valoresCustom[c.id]
      if (c.tipo === 'booleano') continue
      if (!val || val.trim() === '') errs.add(`custom_${c.id}`)
    }
    if (crearUsuario && !password) errs.add('password')
    setErrors(errs)
    return errs.size === 0
  }

  function handleNext() {
    if (!validateStep1()) { toast.error(modoAcceso === 'password' ? 'Completá email y contraseña' : 'Completá el email'); return }
    setStep(2)
  }

  async function handleSave() {
    const valid = isNew ? validateStep2() : validateEdit()
    if (!valid) { toast.error('Completá los campos obligatorios'); return }

    if (form.id && existingUser && form.email && form.email !== existingUser.email) {
      const ok = window.confirm(
        `Esto cambiará el email de acceso al portal de "${existingUser.email}" a "${form.email}". El empleado deberá iniciar sesión con el nuevo email. ¿Continuar?`
      )
      if (!ok) return
    }

    const url = form.id ? `/api/empleados/${form.id}` : '/api/empleados'
    const method = form.id ? 'PUT' : 'POST'
    const camposPersonalizados = Object.entries(valoresCustom)
      .filter(([, v]) => v.trim() !== '')
      .map(([campoId, valor]) => ({ campoId: Number(campoId), valor }))

    const crearConPassword = form.id ? crearUsuario : modoAcceso === 'password'
    const payload = form.id
      ? { ...form, camposPersonalizados, username, crearUsuario: crearConPassword, password: crearConPassword ? password : undefined }
      : crearConPassword
        ? { ...form, crearUsuario: true, username: username || undefined, password, camposPersonalizados }
        : { ...form, crearUsuario: false, camposPersonalizados }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) {
      const payloadErr = await parseApiError(res)
      if (payloadErr.field) {
        setErrors(prev => new Set(prev).add(payloadErr.field!))
        if (isNew && payloadErr.field === 'email') setStep(1)
      }
      showApiError(payloadErr, href => router.push(href))
      return
    }
    // Nuevo empleado en modo invitación: disparar envío de invitación
    if (isNew && modoAcceso === 'invitacion') {
      const created = await res.json().catch(() => ({}))
      const empId = created?.id ?? created?.employeeId
      if (empId) {
        const inv = await fetch('/api/invitaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: Number(empId) }),
        })
        if (inv.ok) toast.success('Invitación enviada por email')
        else {
          const err = await inv.json().catch(() => ({}))
          toast.error(err?.error ?? 'Empleado creado, pero no se pudo enviar la invitación')
        }
      }
    }
    onSaved()
    onClose()
  }

  const err = (key: string) => errors.has(key)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="px-1 shrink-0">
          <DialogTitle>
            {form.id ? 'Editar registro' : (
              <span className="flex items-center gap-3">
                Nuevo registro
                <span className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold', step === 1 ? 'bg-green-700 text-white' : 'bg-muted text-muted-foreground')}>1</span>
                  <span className={step === 1 ? 'text-foreground' : ''}>Acceso</span>
                  <span className="mx-1">→</span>
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold', step === 2 ? 'bg-green-700 text-white' : 'bg-muted text-muted-foreground')}>2</span>
                  <span className={step === 2 ? 'text-foreground' : ''}>Datos</span>
                </span>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1 py-2 space-y-4">

          {/* ── NUEVO: Step 1 (credenciales) ── */}
          {isNew && step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Cómo va a acceder este empleado al portal:</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModoAcceso('invitacion')}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-md border text-sm text-left transition-colors',
                    modoAcceso === 'invitacion'
                      ? 'border-green-600 bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 font-medium'
                      : 'border-border hover:border-green-400 hover:bg-muted/50',
                  )}
                >
                  Enviar invitación por email
                  <p className={cn('text-xs mt-0.5 font-normal', modoAcceso === 'invitacion' ? 'text-green-700/80 dark:text-green-400/70' : 'text-muted-foreground')}>
                    El empleado elige su usuario y contraseña.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setModoAcceso('password')}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-md border text-sm text-left transition-colors',
                    modoAcceso === 'password'
                      ? 'border-green-600 bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 font-medium'
                      : 'border-border hover:border-green-400 hover:bg-muted/50',
                  )}
                >
                  Setear contraseña ahora
                  <p className={cn('text-xs mt-0.5 font-normal', modoAcceso === 'password' ? 'text-green-700/80 dark:text-green-400/70' : 'text-muted-foreground')}>
                    Le llega un email con las credenciales.
                  </p>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="mb-1.5">Email <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => { set('email')(e.target.value); clearError('email') }}
                    placeholder="empleado@empresa.com"
                    className={cn(err('email') && 'border-red-500 focus-visible:ring-red-500')}
                    autoFocus
                  />
                </div>
                {modoAcceso === 'password' && (
                  <>
                    <div>
                      <Label className="mb-1.5">Nombre de usuario <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
                      <Input
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Ej: jgarcía"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5">Contraseña <span className="text-xs text-muted-foreground font-normal">(temporal)</span> <span className="text-red-500">*</span></Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); clearError('password') }}
                        placeholder="Contraseña inicial"
                        className={cn(err('password') && 'border-red-500 focus-visible:ring-red-500')}
                      />
                    </div>
                  </>
                )}
                {modoAcceso === 'password' && (
                  <p className="col-span-2 text-[11px] text-muted-foreground">
                    El empleado deberá cambiar esta contraseña la primera vez que inicie sesión.
                  </p>
                )}
                {modoAcceso === 'invitacion' && (
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Al finalizar, se enviará un link de invitación válido por 7 días para que el empleado cree su usuario y contraseña.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── NUEVO: Step 2 / EDITAR: datos del legajo ── */}
          {(!isNew || step === 2) && (() => {
            const renderStandardField = (k: string) => {
              const textEntry = TEXT_FIELDS.find(([key]) => key === k)
              if (textEntry) {
                const [key, label] = textEntry
                return (
                  <div key={key}>
                    <Label className="mb-1.5">{label}{isRequired(key as string) && <span className="text-red-500 ml-1">*</span>}</Label>
                    <Input
                      value={(form[key] ?? '') as string}
                      onChange={e => set(key)(key === 'cuil' ? maskCuilInput(e.target.value) : e.target.value)}
                      inputMode={key === 'cuil' ? 'numeric' : undefined}
                      maxLength={key === 'cuil' ? 13 : undefined}
                      placeholder={key === 'cuil' ? '20-12345678-9' : undefined}
                      className={cn(err(key as string) && 'border-red-500 focus-visible:ring-red-500')}
                    />
                    {key === 'cuil' && err('cuil') && (
                      <p className="text-xs text-red-500 mt-1">CUIL inválido</p>
                    )}
                  </div>
                )
              }
              if (k === 'fechaIngreso') return (
                <div key="fechaIngreso">
                  <Label className="mb-1.5">Fecha Ingreso{isRequired('fechaIngreso') && <span className="text-red-500 ml-1">*</span>}</Label>
                  <Input
                    type="date"
                    value={form.fechaIngreso?.toString().slice(0, 10)}
                    onChange={e => set('fechaIngreso')(e.target.value)}
                    className={cn(err('fechaIngreso') && 'border-red-500 focus-visible:ring-red-500')}
                  />
                </div>
              )
              if (k === 'categoria') return (
                <div key="categoria">
                  <Label className="mb-1.5">Categoría{isRequired('categoria') && <span className="text-red-500 ml-1">*</span>}</Label>
                  {!catsLoaded ? (
                    <Skeleton className="h-9 w-full rounded-md" />
                  ) : (
                    <Select value={form.categoriaId ? String(form.categoriaId) : ''} onValueChange={v => { if (v) { set('categoriaId')(v); clearError('categoria') } }}>
                      <SelectTrigger className={cn('w-full', err('categoria') && 'border-red-500 focus:ring-red-500')}>
                        <SelectValue placeholder="Seleccionar">
                          {cats.find(c => c.id === Number(form.categoriaId))?.nombre ?? 'Seleccionar'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent side="bottom" alignItemWithTrigger={false}>
                        {cats.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )
              if (k === 'estado') return (
                <div key="estado">
                  <Label className="mb-1.5">Estado</Label>
                  <Select value={form.estado} onValueChange={v => v && set('estado')(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent side="bottom" alignItemWithTrigger={false}>
                      <SelectItem value="ACTIVO">Activo</SelectItem>
                      <SelectItem value="INACTIVO">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )
              return null
            }

            const renderCustomField = (c: CampoPersonalizado) => (
              <div key={c.id} className={c.tipo === 'archivo' ? 'col-span-2' : ''}>
                <Label className="mb-1.5">{c.nombre}{c.requerido && <span className="text-red-500 ml-1">*</span>}</Label>
                {c.tipo === 'booleano' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      checked={valoresCustom[c.id] === 'true'}
                      onCheckedChange={v => setValoresCustom(prev => ({ ...prev, [c.id]: v ? 'true' : 'false' }))}
                    />
                    <span className="text-sm text-muted-foreground">Sí</span>
                  </div>
                ) : c.tipo === 'archivo' ? (
                  <div className="space-y-1.5">
                    {valoresCustom[c.id] ? (
                      <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/40">
                        <Paperclip size={13} className="text-muted-foreground shrink-0" />
                        <a href={`/api/campos/archivo?file=${valoresCustom[c.id]}`} target="_blank" className="text-sm text-blue-600 hover:underline flex-1 truncate">
                          {valoresCustom[c.id].replace(/^\d+-/, '')}
                        </a>
                        <button type="button" onClick={() => setValoresCustom(prev => ({ ...prev, [c.id]: '' }))} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <Input
                        type="file"
                        className={cn(err(`custom_${c.id}`) && 'border-red-500')}
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const fd = new FormData()
                          fd.append('file', file)
                          const res = await fetch('/api/campos/archivo', { method: 'POST', body: fd })
                          if (res.ok) {
                            const { fileName } = await res.json()
                            setValoresCustom(prev => ({ ...prev, [c.id]: fileName }))
                            clearError(`custom_${c.id}`)
                          } else {
                            const errPayload = await parseApiError(res)
                            showApiError(errPayload, href => router.push(href))
                          }
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    type={c.tipo === 'numero' ? 'number' : c.tipo === 'fecha' ? 'date' : 'text'}
                    value={valoresCustom[c.id] ?? ''}
                    onChange={e => { setValoresCustom(v => ({ ...v, [c.id]: e.target.value })); clearError(`custom_${c.id}`) }}
                    className={cn(err(`custom_${c.id}`) && 'border-red-500 focus-visible:ring-red-500')}
                  />
                )}
              </div>
            )

            const STD_ORDER = ['legajo', 'cuil', 'email', 'telefono', 'fechaIngreso', 'categoria', 'estado']
            const stdMain = STD_ORDER.filter(k => {
              if (isNew && k === 'email') return false
              return isInMain(k)
            })
            const stdAdicional = STD_ORDER.filter(k => isInAdicional(k))
            const customMain = camposCustom.filter(c => c.visible && c.visibleEnAlta)
            const customAdicional = !isNew ? camposCustom.filter(c => c.visible && !c.visibleEnAlta) : []
            const hasAdicional = stdAdicional.length + customAdicional.length > 0

            return (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Nombre <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.nombre}
                    onChange={e => set('nombre')(e.target.value)}
                    className={cn(err('nombre') && 'border-red-500 focus-visible:ring-red-500')}
                    autoFocus={isNew && step === 2}
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Apellido <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.apellido}
                    onChange={e => set('apellido')(e.target.value)}
                    className={cn(err('apellido') && 'border-red-500 focus-visible:ring-red-500')}
                  />
                </div>
                {stdMain.map(k => renderStandardField(k))}
                {customMain.map(c => renderCustomField(c))}
              </div>

              {hasAdicional && (
                <div className="border-t pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAdicional(v => !v)}
                    className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-green-700 transition-colors"
                  >
                    <span>Información adicional</span>
                    <ChevronDown size={16} className={cn('transition-transform', showAdicional && 'rotate-180')} />
                  </button>
                  {showAdicional && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {stdAdicional.map(k => renderStandardField(k))}
                      {customAdicional.map(c => renderCustomField(c))}
                    </div>
                  )}
                </div>
              )}

              {isNew && (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  El usuario se crea como <strong className="text-foreground">Empleado</strong> por defecto.
                  Para asignarle un rol personalizado, andá a
                  {' '}<strong className="text-foreground">Configuración → Usuarios</strong>
                  {modoAcceso === 'invitacion' ? ' cuando el empleado acepte la invitación.' : ' después de guardar.'}
                </div>
              )}

              {/* Sección acceso — solo en edición */}
              {form.id && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solicitudes de modificación</p>
                  <SolicitudesModificacionAdmin employeeId={form.id} />
                </div>
              )}
              {form.id && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acceso al sistema</p>
                  {existingUser ? (
                    <div>
                      <Label className="mb-1.5">Nombre de usuario</Label>
                      <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Sin nombre de usuario" className="mt-1" />
                      <p className="text-xs text-muted-foreground mt-1">Email: {existingUser.email}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Checkbox id="crearUsuario" checked={crearUsuario} onCheckedChange={v => setCrearUsuario(!!v)} />
                        <Label htmlFor="crearUsuario" className="cursor-pointer">Crear acceso al sistema</Label>
                      </div>
                      {crearUsuario && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="mb-1.5">Nombre de usuario</Label>
                            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Opcional" className="mt-1" />
                          </div>
                          <div>
                            <Label className="mb-1.5">Contraseña <span className="text-red-500">*</span></Label>
                            <Input
                              type="password"
                              value={password}
                              onChange={e => { setPassword(e.target.value); clearError('password') }}
                              placeholder="Contraseña inicial"
                              className={cn('mt-1', err('password') && 'border-red-500 focus-visible:ring-red-500')}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
            )
          })()}
        </div>

        <DialogFooter className="px-1 shrink-0 border-t pt-4">
          {isNew && step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button className="bg-green-700 hover:bg-green-800" onClick={handleNext}>Siguiente →</Button>
            </>
          ) : isNew && step === 2 ? (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>← Atrás</Button>
              <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>Guardar</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>Guardar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
