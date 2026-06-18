'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, ShieldCheck, User, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { TODOS_LOS_PERMISOS, LABELS_PERMISOS, type Permiso } from '@/lib/permissions'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Rol {
  id: number
  nombre: string
  descripcion: string | null
  permisos: string[]
  usuariosCount: number
}

interface Usuario {
  id: number
  email: string
  role: string
  rolId: number | null
  rolNombre: string | null
  createdAt: string
  employee: { id: number; nombre: string; apellido: string; legajo: string } | null
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'roles', label: 'Roles' },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function UsuariosPage() {
  const [tab, setTab] = useState<'usuarios' | 'roles'>('usuarios')

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex border-b mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
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
      {tab === 'usuarios' ? <TabUsuarios /> : <TabRoles />}
    </div>
  )
}

// ─── Tab: Usuarios ────────────────────────────────────────────────────────────

function TabUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRolId, setNewRolId] = useState<string>('')
  const [adding, setAdding] = useState(false)

  async function fetchAll() {
    setLoading(true)
    const [u, r] = await Promise.all([
      fetch('/api/usuarios').then(r => r.json()),
      fetch('/api/roles').then(r => r.json()),
    ])
    setUsuarios(Array.isArray(u) ? u : [])
    setRoles(Array.isArray(r) ? r : [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function handleAdd() {
    if (!newEmail.trim() || !newPassword) return
    setAdding(true)
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim(), password: newPassword, rolId: newRolId || null }),
    })
    setAdding(false)
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error'); return }
    toast.success('Usuario creado')
    setNewEmail(''); setNewPassword(''); setNewRolId('')
    fetchAll()
  }

  async function handleRolChange(userId: number, rolId: string) {
    const res = await fetch(`/api/usuarios/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolId: rolId || null }),
    })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error'); return }
    toast.success('Rol actualizado')
    fetchAll()
  }

  async function handleRoleChange(userId: number, role: string) {
    const res = await fetch(`/api/usuarios/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error'); return }
    toast.success('Acceso actualizado')
    fetchAll()
  }

  async function handleDelete(userId: number, email: string) {
    if (!confirm(`¿Eliminar usuario ${email}?`)) return
    const res = await fetch(`/api/usuarios/${userId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error'); return }
    toast.success('Usuario eliminado')
    fetchAll()
  }

  return (
    <div className="space-y-6">
      {/* Create user */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Nuevo usuario administrador</p>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Email"
            className="flex-1 min-w-48"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <Input
            type="password"
            placeholder="Contraseña"
            className="w-44"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={newRolId}
            onChange={e => setNewRolId(e.target.value)}
          >
            <option value="">Sin rol (acceso total)</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={handleAdd}
            disabled={adding || !newEmail.trim() || !newPassword}
          >
            <Plus size={14} className="mr-1.5" />Crear
          </Button>
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Usuario</th>
              <th className="text-left px-4 py-2.5 font-medium">Acceso</th>
              <th className="text-left px-4 py-2.5 font-medium">Rol de permisos</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-xs">Cargando...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-xs">No hay usuarios</td></tr>
            ) : usuarios.map(u => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {u.role === 'ADMIN'
                        ? <ShieldCheck size={13} className="text-green-700 dark:text-green-400" />
                        : <User size={13} className="text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium leading-tight">{u.email}</p>
                      {u.employee && (
                        <p className="text-xs text-muted-foreground">{u.employee.apellido}, {u.employee.nombre} · {u.employee.legajo}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="EMPLOYEE">Empleado</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.role === 'ADMIN' ? (
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={u.rolId ?? ''}
                      onChange={e => handleRolChange(u.id, e.target.value)}
                    >
                      <option value="">Acceso total</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(u.id, u.email)}
                    className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    title="Eliminar usuario"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Roles ───────────────────────────────────────────────────────────────

function TabRoles() {
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', permisos: [] as string[] })
  const [saving, setSaving] = useState(false)

  async function fetchRoles() {
    setLoading(true)
    const r = await fetch('/api/roles')
    if (r.ok) setRoles(await r.json())
    setLoading(false)
  }

  useEffect(() => { fetchRoles() }, [])

  function startNew() {
    setForm({ nombre: '', descripcion: '', permisos: [] })
    setEditingId('new')
  }

  function startEdit(rol: Rol) {
    setForm({ nombre: rol.nombre, descripcion: rol.descripcion ?? '', permisos: [...rol.permisos] })
    setEditingId(rol.id)
  }

  function togglePermiso(p: string) {
    setForm(f => ({
      ...f,
      permisos: f.permisos.includes(p)
        ? f.permisos.filter(x => x !== p)
        : [...f.permisos, p],
    }))
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    const isNew = editingId === 'new'
    const url = isNew ? '/api/roles' : `/api/roles/${editingId}`
    const method = isNew ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error'); return }
    toast.success(isNew ? 'Rol creado' : 'Rol actualizado')
    setEditingId(null)
    fetchRoles()
  }

  async function handleDelete(rol: Rol) {
    if (rol.usuariosCount > 0) {
      toast.error(`${rol.usuariosCount} usuario${rol.usuariosCount !== 1 ? 's usan' : ' usa'} este rol`)
      return
    }
    if (!confirm(`¿Eliminar el rol "${rol.nombre}"?`)) return
    const res = await fetch(`/api/roles/${rol.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Error'); return }
    toast.success('Rol eliminado')
    fetchRoles()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="bg-green-700 hover:bg-green-800" size="sm" onClick={startNew} disabled={editingId === 'new'}>
          <Plus size={14} className="mr-1.5" />Nuevo rol
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {/* New rol form */}
          {editingId === 'new' && (
            <RolForm
              form={form}
              setForm={setForm}
              onTogglePermiso={togglePermiso}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
              saving={saving}
              isNew
            />
          )}

          {roles.map(rol => (
            <div key={rol.id} className="rounded-xl border bg-card overflow-hidden">
              {editingId === rol.id ? (
                <RolForm
                  form={form}
                  setForm={setForm}
                  onTogglePermiso={togglePermiso}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              ) : (
                <div className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{rol.nombre}</p>
                      <span className="text-xs text-muted-foreground">
                        {rol.usuariosCount} usuario{rol.usuariosCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {rol.descripcion && <p className="text-xs text-muted-foreground mb-2">{rol.descripcion}</p>}
                    <div className="flex flex-wrap gap-1">
                      {rol.permisos.length === 0
                        ? <span className="text-xs text-muted-foreground italic">Sin permisos</span>
                        : rol.permisos.map(p => (
                          <span key={p} className="text-xs bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
                            {LABELS_PERMISOS[p as Permiso] ?? p}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(rol)}
                      className="p-1.5 rounded text-muted-foreground hover:bg-muted transition-colors"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(rol)}
                      className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {roles.length === 0 && editingId !== 'new' && (
            <p className="text-center text-sm text-muted-foreground py-8">No hay roles creados</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Rol form (shared for new and edit) ───────────────────────────────────────

function RolForm({
  form, setForm, onTogglePermiso, onSave, onCancel, saving, isNew,
}: {
  form: { nombre: string; descripcion: string; permisos: string[] }
  setForm: (f: any) => void
  onTogglePermiso: (p: string) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew?: boolean
}) {
  return (
    <div className="px-5 py-4 space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {isNew ? 'Nuevo rol' : 'Editar rol'}
      </p>
      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">Nombre</p>
          <Input
            value={form.nombre}
            onChange={e => setForm((f: any) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: RRHH"
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">Descripción (opcional)</p>
          <Input
            value={form.descripcion}
            onChange={e => setForm((f: any) => ({ ...f, descripcion: e.target.value }))}
            placeholder="Ej: Gestión de empleados y documentos"
          />
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Permisos</p>
        <div className="grid grid-cols-2 gap-2">
          {TODOS_LOS_PERMISOS.map(p => {
            const checked = form.permisos.includes(p)
            return (
              <button
                key={p}
                onClick={() => onTogglePermiso(p)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors',
                  checked
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                    : 'border-border hover:border-muted-foreground text-muted-foreground'
                )}
              >
                <div className={cn(
                  'h-4 w-4 rounded flex items-center justify-center shrink-0',
                  checked ? 'bg-green-600' : 'border border-muted-foreground'
                )}>
                  {checked && <Check size={10} className="text-white" />}
                </div>
                {LABELS_PERMISOS[p]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X size={13} className="mr-1" />Cancelar
        </Button>
        <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={onSave} disabled={saving}>
          <Check size={13} className="mr-1" />{saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}
