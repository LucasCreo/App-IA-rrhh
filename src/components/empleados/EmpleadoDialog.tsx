'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { Paperclip, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { SolicitudesModificacionAdmin } from './SolicitudesModificacionAdmin'

interface Categoria { id: number; nombre: string; nivel?: number | null; rolPorDefecto?: string | null }
interface EmpleadoLite { id: number; nombre: string; apellido: string; legajo: string; categoria?: { id: number; nivel: number | null; nombre: string } | null }
interface Empleado {
  id?: number; legajo: string; nombre: string; apellido: string; cuil: string
  email: string; telefono?: string; fechaIngreso: string; categoriaId: number; estado: string
  managerId?: number | null
}
interface FieldConfig { campo: string; visible: boolean; requerido: boolean; eliminado: boolean }
interface CampoPersonalizado { id: number; nombre: string; tipo: string; visible: boolean; requerido: boolean }
interface Props { open: boolean; onClose: () => void; onSaved: () => void; empleado?: Empleado }

const empty: Empleado = {
  legajo: '', nombre: '', apellido: '', cuil: '', email: '',
  telefono: '', fechaIngreso: '', categoriaId: 0, estado: 'ACTIVO', managerId: null,
}

const TEXT_FIELDS: Array<[keyof Empleado, string]> = [
  ['legajo', 'Legajo'], ['cuil', 'CUIL'], ['email', 'Email'], ['telefono', 'Teléfono'],
]

export function EmpleadoDialog({ open, onClose, onSaved, empleado }: Props) {
  const isNew = !empleado?.id
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState<Empleado>(empleado ?? empty)
  const [cats, setCats] = useState<Categoria[]>([])
  const [catsLoaded, setCatsLoaded] = useState(false)
  const [posiblesJefes, setPosiblesJefes] = useState<EmpleadoLite[]>([])
  const [fieldConfig, setFieldConfig] = useState<FieldConfig[]>([])
  const [camposCustom, setCamposCustom] = useState<CampoPersonalizado[]>([])
  const [valoresCustom, setValoresCustom] = useState<Record<number, string>>({})
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [crearUsuario, setCrearUsuario] = useState(false)
  const [existingUser, setExistingUser] = useState<{ id: number; email: string; username: string | null } | null>(null)
  const [errors, setErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    setCatsLoaded(false)
    setStep(1)
    fetch('/api/categorias').then(r => r.json()).then(data => { setCats(data); setCatsLoaded(true) })
    fetch('/api/configuracion/empleados-campos').then(r => r.json()).then(setFieldConfig)
    fetch('/api/configuracion/campos-personalizados').then(r => r.json()).then(setCamposCustom)
    fetch('/api/empleados?all=true&estado=ACTIVO').then(r => r.json()).then(d => {
      const list: EmpleadoLite[] = d.employees ?? []
      setPosiblesJefes(list.filter(e => e.id !== empleado?.id))
    })
    setForm(empleado ?? empty)
    setPassword('')
    setUsername('')
    setCrearUsuario(false)
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
    if (!password) errs.add('password')
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
    if (!validateStep1()) { toast.error('Completá email y contraseña'); return }
    setStep(2)
  }

  async function handleSave() {
    const valid = isNew ? validateStep2() : validateEdit()
    if (!valid) { toast.error('Completá los campos obligatorios'); return }

    const url = form.id ? `/api/empleados/${form.id}` : '/api/empleados'
    const method = form.id ? 'PUT' : 'POST'
    const camposPersonalizados = Object.entries(valoresCustom)
      .filter(([, v]) => v.trim() !== '')
      .map(([campoId, valor]) => ({ campoId: Number(campoId), valor }))

    const payload = form.id
      ? { ...form, camposPersonalizados, username, crearUsuario, password: crearUsuario ? password : undefined }
      : { ...form, crearUsuario: true, username: username || undefined, password, camposPersonalizados }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { toast.error(`Error al guardar: ${await res.text()}`); return }
    onSaved()
    onClose()
  }

  const err = (key: string) => errors.has(key)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="px-1 shrink-0">
          <DialogTitle>
            {form.id ? 'Editar Legajo' : (
              <span className="flex items-center gap-3">
                Nuevo Legajo
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
              <p className="text-sm text-muted-foreground">Estas credenciales le permitirán al empleado acceder al portal.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Email <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => { set('email')(e.target.value); clearError('email') }}
                    placeholder="empleado@empresa.com"
                    className={cn(err('email') && 'border-red-500 focus-visible:ring-red-500')}
                    autoFocus
                  />
                </div>
                <div>
                  <Label>Nombre de usuario <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Ej: jgarcía"
                  />
                </div>
                <div>
                  <Label>Contraseña <span className="text-red-500">*</span></Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearError('password') }}
                    placeholder="Contraseña inicial"
                    className={cn(err('password') && 'border-red-500 focus-visible:ring-red-500')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── NUEVO: Step 2 / EDITAR: datos del legajo ── */}
          {(!isNew || step === 2) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nombre <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.nombre}
                    onChange={e => set('nombre')(e.target.value)}
                    className={cn(err('nombre') && 'border-red-500 focus-visible:ring-red-500')}
                    autoFocus={isNew && step === 2}
                  />
                </div>
                <div>
                  <Label>Apellido <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.apellido}
                    onChange={e => set('apellido')(e.target.value)}
                    className={cn(err('apellido') && 'border-red-500 focus-visible:ring-red-500')}
                  />
                </div>
                {TEXT_FIELDS.filter(([k]) => {
                  if (isNew && k === 'email') return false
                  return isVisible(k as string)
                }).map(([k, label]) => (
                  <div key={k}>
                    <Label>{label}{isRequired(k as string) && <span className="text-red-500 ml-1">*</span>}</Label>
                    <Input
                      value={(form[k] ?? '') as string}
                      onChange={e => set(k)(e.target.value)}
                      className={cn(err(k as string) && 'border-red-500 focus-visible:ring-red-500')}
                    />
                  </div>
                ))}
                {isVisible('fechaIngreso') && (
                  <div>
                    <Label>Fecha Ingreso{isRequired('fechaIngreso') && <span className="text-red-500 ml-1">*</span>}</Label>
                    <Input
                      type="date"
                      value={form.fechaIngreso?.toString().slice(0, 10)}
                      onChange={e => set('fechaIngreso')(e.target.value)}
                      className={cn(err('fechaIngreso') && 'border-red-500 focus-visible:ring-red-500')}
                    />
                  </div>
                )}
                {isVisible('categoria') && (
                  <div>
                    <Label>Categoría{isRequired('categoria') && <span className="text-red-500 ml-1">*</span>}</Label>
                    {!catsLoaded ? (
                      <Skeleton className="h-9 w-full rounded-md" />
                    ) : (
                      <Select value={form.categoriaId ? String(form.categoriaId) : ''} onValueChange={v => { if (v) { set('categoriaId')(v); clearError('categoria') } }}>
                        <SelectTrigger className={cn(err('categoria') && 'border-red-500 focus:ring-red-500')}>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {cats.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.nombre}{c.nivel != null ? ` (nivel ${c.nivel})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {isNew && crearUsuario && form.categoriaId > 0 && (() => {
                      const cat = cats.find(c => c.id === form.categoriaId)
                      if (!cat?.rolPorDefecto) return null
                      return (
                        <p className="text-xs text-muted-foreground mt-1">
                          El usuario se creará con rol: <strong>{cat.rolPorDefecto === 'ADMIN' ? 'Admin' : 'Empleado'}</strong>
                        </p>
                      )
                    })()}
                  </div>
                )}
                <div>
                  <Label>A cargo de <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Select
                    value={form.managerId ? String(form.managerId) : undefined}
                    onValueChange={v => setForm(f => ({ ...f, managerId: v === '__none__' ? null : Number(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin jefe directo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin jefe directo</SelectItem>
                      {(() => {
                        const miNivel = cats.find(c => c.id === form.categoriaId)?.nivel ?? null
                        return posiblesJefes
                          .filter(e => {
                            if (miNivel == null) return true
                            const suNivel = e.categoria?.nivel ?? null
                            if (suNivel == null) return true
                            return suNivel <= miNivel
                          })
                          .map(e => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {`${e.apellido}, ${e.nombre} — ${e.legajo}${e.categoria?.nivel != null ? ` (nivel ${e.categoria.nivel})` : ''}`}
                            </SelectItem>
                          ))
                      })()}
                    </SelectContent>
                  </Select>
                  {cats.find(c => c.id === form.categoriaId)?.nivel != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Solo se muestran empleados de nivel igual o superior al de la categoría seleccionada.
                    </p>
                  )}
                </div>
                {isVisible('estado') && (
                  <div>
                    <Label>Estado</Label>
                    <Select value={form.estado} onValueChange={v => v && set('estado')(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVO">Activo</SelectItem>
                        <SelectItem value="INACTIVO">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {camposCustom.filter(c => c.visible).map(c => (
                  <div key={c.id} className={c.tipo === 'archivo' ? 'col-span-2' : ''}>
                    <Label>{c.nombre}{c.requerido && <span className="text-red-500 ml-1">*</span>}</Label>
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
                ))}
              </div>

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
                      <Label>Nombre de usuario</Label>
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
                            <Label>Nombre de usuario</Label>
                            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Opcional" className="mt-1" />
                          </div>
                          <div>
                            <Label>Contraseña <span className="text-red-500">*</span></Label>
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
          )}
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
