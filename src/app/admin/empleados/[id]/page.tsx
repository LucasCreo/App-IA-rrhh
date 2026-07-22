'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { parseApiError, showApiError } from '@/lib/apiErrors'
import { EVALUACIONES_ENABLED } from '@/lib/features'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { SolicitudesModificacionAdmin } from '@/components/empleados/SolicitudesModificacionAdmin'
import { DocumentosTable } from '@/components/documentos/DocumentosTable'
import { EmpleadoEvaluacionesTab } from '@/components/empleados/EmpleadoEvaluacionesTab'
import { EmpleadoFormulariosTab } from '@/components/empleados/EmpleadoFormulariosTab'
import { EmpleadoCalendarioTab } from '@/components/empleados/EmpleadoCalendarioTab'
import { AvatarDisplay } from '@/components/shared/AvatarDisplay'
import { validarCuil } from '@/lib/cuil'
import { cn } from '@/lib/utils'
import { Paperclip, X, ArrowLeft } from 'lucide-react'

interface Categoria { id: number; nombre: string }
interface Empleado {
  id: number; legajo: string; nombre: string; apellido: string; cuil: string
  email: string; telefono?: string; fechaIngreso: string; categoriaId: number; estado: string
}
interface FieldConfig { campo: string; visible: boolean; requerido: boolean; eliminado: boolean }
interface CampoPersonalizado { id: number; nombre: string; tipo: string; visible: boolean; requerido: boolean }

const TEXT_FIELDS: Array<[keyof Empleado, string]> = [
  ['legajo', 'Legajo'], ['cuil', 'CUIL'], ['email', 'Email'], ['telefono', 'Teléfono'],
]

export default function EmpleadoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState<Empleado | null>(null)
  const [cats, setCats] = useState<Categoria[]>([])
  const [fieldConfig, setFieldConfig] = useState<FieldConfig[]>([])
  const [camposCustom, setCamposCustom] = useState<CampoPersonalizado[]>([])
  const [valoresCustom, setValoresCustom] = useState<Record<number, string>>({})
  const [existingUser, setExistingUser] = useState<{ id: number; email: string; username: string | null; avatarUrl: string | null; avatarBgColor: string | null; avatarTextColor: string | null } | null>(null)
  const [username, setUsername] = useState('')
  const [crearUsuario, setCrearUsuario] = useState(false)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'datos' | 'documentos' | 'recibos' | 'evaluaciones' | 'formularios' | 'calendario'>('datos')

  useEffect(() => {
    Promise.all([
      fetch('/api/categorias').then(r => r.json()),
      fetch('/api/configuracion/empleados-campos').then(r => r.json()),
      fetch('/api/configuracion/campos-personalizados').then(r => r.json()),
      fetch(`/api/empleados/${id}`).then(r => r.json()),
    ]).then(([catsData, fieldCfg, camposCfg, empData]) => {
      setCats(catsData)
      setFieldConfig(fieldCfg)
      setCamposCustom(camposCfg)
      setForm({
        id: empData.id,
        legajo: empData.legajo,
        nombre: empData.nombre,
        apellido: empData.apellido,
        cuil: empData.cuil,
        email: empData.email,
        telefono: empData.telefono ?? '',
        fechaIngreso: empData.fechaIngreso,
        categoriaId: empData.categoriaId,
        estado: empData.estado,
      })
      const map: Record<number, string> = {}
      for (const v of empData.valoresCampos ?? []) map[v.campoId] = v.valor
      setValoresCustom(map)
      setExistingUser(empData.user ?? null)
      setUsername(empData.user?.username ?? '')
      setLoading(false)
    })
  }, [id])

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

  const setField = (k: keyof Empleado) => (val: string) => {
    setForm(f => f ? { ...f, [k]: val } : f)
    clearError(k as string)
  }

  function validate() {
    if (!form) return false
    const errs = new Set<string>()
    if (!form.nombre.trim()) errs.add('nombre')
    if (!form.apellido.trim()) errs.add('apellido')
    for (const [k] of TEXT_FIELDS) {
      if (isVisible(k as string) && isRequired(k as string) && !(form[k] as string)?.trim())
        errs.add(k as string)
    }
    if (isVisible('cuil') && form.cuil?.trim() && !validarCuil(form.cuil)) errs.add('cuil')
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

  async function handleSave() {
    if (!form || !validate()) {
      toast.error('Completá los campos obligatorios')
      return
    }
    setSaving(true)
    const camposPersonalizados = Object.entries(valoresCustom)
      .filter(([, v]) => v.trim() !== '')
      .map(([campoId, valor]) => ({ campoId: Number(campoId), valor }))
    const payload = { ...form, camposPersonalizados, username, crearUsuario, password: crearUsuario ? password : undefined }
    const res = await fetch(`/api/empleados/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) {
      const payloadErr = await parseApiError(res)
      if (payloadErr.field) setErrors(prev => new Set(prev).add(payloadErr.field!))
      showApiError(payloadErr, href => router.push(href))
      return
    }
    toast.success('Empleado guardado')
    router.push('/admin/empleados')
  }

  const err = (key: string) => errors.has(key)

  if (loading) return (
    <>
      <AdminHeader title="Empleado" />
      <div className="p-6 max-w-3xl space-y-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
      </div>
    </>
  )

  if (!form) return null

  return (
    <>
      <AdminHeader title={`${form.apellido}, ${form.nombre}`} />
      <div className="p-4 sm:p-6">
        <button
          onClick={() => router.push('/admin/empleados')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={15} /> Volver a empleados
        </button>

        {/* Pestañas */}
        <div className="flex border-b mb-6 overflow-x-auto">
          {([
            { id: 'datos', label: 'Datos' },
            { id: 'documentos', label: 'Documentos' },
            { id: 'recibos', label: 'Recibos' },
            ...(EVALUACIONES_ENABLED ? [{ id: 'evaluaciones' as const, label: 'Evaluaciones' }] : []),
            { id: 'formularios', label: 'Formularios' },
            { id: 'calendario', label: 'Calendario' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.id
                  ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'documentos' && <DocumentosTable employeeId={form.id} esRecibo={false} />}
        {tab === 'recibos' && <DocumentosTable employeeId={form.id} esRecibo={true} />}
        {EVALUACIONES_ENABLED && tab === 'evaluaciones' && <EmpleadoEvaluacionesTab employeeId={form.id} />}
        {tab === 'formularios' && <EmpleadoFormulariosTab employeeId={form.id} />}
        {tab === 'calendario' && <EmpleadoCalendarioTab employeeId={form.id} userId={existingUser?.id ?? null} />}
        {tab === 'datos' && <div className="max-w-3xl space-y-6">

        {/* Datos personales */}
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datos personales</p>
            <div className="flex items-center gap-2">
              <AvatarDisplay
                nombre={`${form.nombre} ${form.apellido}`}
                iniciales={`${form.nombre[0] ?? ''}${form.apellido[0] ?? ''}`}
                avatarUrl={existingUser?.avatarUrl ?? null}
                bgColor={existingUser?.avatarBgColor ?? null}
                textColor={existingUser?.avatarTextColor ?? null}
                size={48}
              />
              <span className="text-xs text-muted-foreground">
                {existingUser?.avatarUrl ? 'Foto elegida por el usuario' : 'Iniciales'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5">Nombre <span className="text-red-500">*</span></Label>
              <Input value={form.nombre} onChange={e => setField('nombre')(e.target.value)} className={cn('mt-1', err('nombre') && 'border-red-500 focus-visible:ring-red-500')} />
            </div>
            <div>
              <Label className="mb-1.5">Apellido <span className="text-red-500">*</span></Label>
              <Input value={form.apellido} onChange={e => setField('apellido')(e.target.value)} className={cn('mt-1', err('apellido') && 'border-red-500 focus-visible:ring-red-500')} />
            </div>
            {TEXT_FIELDS.filter(([k]) => isVisible(k as string)).map(([k, label]) => (
              <div key={k}>
                <Label className="mb-1.5">{label}{isRequired(k as string) && <span className="text-red-500 ml-1">*</span>}</Label>
                <Input
                  value={(form[k] ?? '') as string}
                  onChange={e => setField(k)(e.target.value)}
                  className={cn('mt-1', err(k as string) && 'border-red-500 focus-visible:ring-red-500')}
                />
                {k === 'cuil' && err('cuil') && (
                  <p className="text-xs text-red-500 mt-1">CUIL inválido</p>
                )}
              </div>
            ))}
            {isVisible('fechaIngreso') && (
              <div>
                <Label className="mb-1.5">Fecha Ingreso{isRequired('fechaIngreso') && <span className="text-red-500 ml-1">*</span>}</Label>
                <Input
                  type="date"
                  value={form.fechaIngreso?.toString().slice(0, 10)}
                  onChange={e => setField('fechaIngreso')(e.target.value)}
                  className={cn('mt-1', err('fechaIngreso') && 'border-red-500 focus-visible:ring-red-500')}
                />
              </div>
            )}
            {isVisible('categoria') && (
              <div>
                <Label className="mb-1.5">Categoría{isRequired('categoria') && <span className="text-red-500 ml-1">*</span>}</Label>
                <Select value={form.categoriaId ? String(form.categoriaId) : ''} onValueChange={v => { if (v) { setField('categoriaId')(v); clearError('categoria') } }}>
                  <SelectTrigger className={cn('mt-1', err('categoria') && 'border-red-500 focus:ring-red-500')}>
                    <SelectValue placeholder="Seleccionar">
                      {cats.find(c => c.id === Number(form.categoriaId))?.nombre ?? 'Seleccionar'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {cats.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isVisible('estado') && (
              <div>
                <Label className="mb-1.5">Estado</Label>
                <Select value={form.estado} onValueChange={v => v && setField('estado')(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVO">Activo</SelectItem>
                    <SelectItem value="INACTIVO">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {camposCustom.filter(c => c.visible).map(c => (
              <div key={c.id} className={c.tipo === 'archivo' ? 'col-span-2' : ''}>
                <Label className="mb-1.5">{c.nombre}{c.requerido && <span className="text-red-500 ml-1">*</span>}</Label>
                {c.tipo === 'booleano' ? (
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox
                      checked={valoresCustom[c.id] === 'true'}
                      onCheckedChange={v => setValoresCustom(prev => ({ ...prev, [c.id]: v ? 'true' : 'false' }))}
                    />
                    <span className="text-sm text-muted-foreground">Sí</span>
                  </div>
                ) : c.tipo === 'archivo' ? (
                  <div className="mt-1 space-y-1.5">
                    {valoresCustom[c.id] ? (
                      <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/40">
                        <Paperclip size={13} className="text-muted-foreground shrink-0" />
                        <a
                          href={`/api/campos/archivo?file=${valoresCustom[c.id]}`}
                          target="_blank"
                          className="text-sm text-blue-600 hover:underline flex-1 truncate"
                        >
                          {valoresCustom[c.id].replace(/^\d+-/, '')}
                        </a>
                        <button
                          type="button"
                          title="Quitar archivo"
                          onClick={() => setValoresCustom(prev => ({ ...prev, [c.id]: '' }))}
                          className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                        >
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
                            const errP = await parseApiError(res)
                            showApiError(errP, href => router.push(href))
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
                    className={cn('mt-1', err(`custom_${c.id}`) && 'border-red-500 focus-visible:ring-red-500')}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Solicitudes de modificación */}
        <div className="rounded-xl border bg-card shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solicitudes de modificación</p>
          <SolicitudesModificacionAdmin employeeId={form.id} />
        </div>

        {/* Acceso al sistema */}
        <div className="rounded-xl border bg-card shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acceso al sistema</p>
          {existingUser ? (
            <div>
              <Label className="mb-1.5">Nombre de usuario</Label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Sin nombre de usuario"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Email: {existingUser.email}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Checkbox id="crearUsuario" checked={crearUsuario} onCheckedChange={v => setCrearUsuario(!!v)} />
                <Label htmlFor="crearUsuario" className="cursor-pointer">Crear acceso al sistema</Label>
              </div>
              {crearUsuario && (
                <div className="grid grid-cols-2 gap-3">
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

        <div className="flex justify-end gap-2 pb-8">
          <Button variant="outline" onClick={() => router.push('/admin/empleados')}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
        </div>}
      </div>
    </>
  )
}
