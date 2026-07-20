'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Trash2, ShieldCheck, User, ExternalLink, Network, KeyRound } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BloqueoEliminacionDialog } from '@/components/shared/BloqueoEliminacionDialog'
import { SubordinadosDialog } from '@/components/usuarios/SubordinadosDialog'
import { PermisosDialog } from '@/components/usuarios/PermisosDialog'

interface Usuario {
  id: number
  email: string
  role: string
  createdAt: string
  employee: { id: number; nombre: string; apellido: string; legajo: string } | null
  permisos: string[]
}

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteUser, setDeleteUser] = useState<{ id: number; email: string; hasEmployee: boolean } | null>(null)
  const [blockedDelete, setBlockedDelete] = useState<{ id: number; email: string; dependencias: { label: string; count: number; href: string }[] } | null>(null)
  const [subordinadosOf, setSubordinadosOf] = useState<{ id: number; label: string } | null>(null)
  const [permisosOf, setPermisosOf] = useState<Usuario | null>(null)

  async function fetchAll() {
    setLoading(true)
    const r = await fetch('/api/usuarios').then(r => r.json())
    setUsuarios(Array.isArray(r) ? r : [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

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

  async function doDeleteUser() {
    if (!deleteUser) return
    const target = deleteUser
    const res = await fetch(`/api/usuarios/${target.id}`, { method: 'DELETE' })
    setDeleteUser(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && Array.isArray(data.dependencias)) {
        setBlockedDelete({ id: target.id, email: target.email, dependencias: data.dependencias })
        return
      }
      toast.error(data.error ?? 'Error')
      return
    }
    toast.success(target.hasEmployee ? 'Usuario y legajo eliminados' : 'Usuario eliminado')
    fetchAll()
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Los usuarios se crean desde <strong>Personal → Nuevo empleado</strong>. Acá gestionás el acceso, permisos y organigrama de los ya existentes.
        </p>
        <Link href="/admin/empleados" className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1 shrink-0">
          Ir a Personal <ExternalLink size={11} />
        </Link>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Usuario</th>
              <th className="text-left px-4 py-2.5 font-medium">Acceso</th>
              <th className="text-left px-4 py-2.5 font-medium">Permisos</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-3" colSpan={4}><Skeleton className="h-8 w-full" /></td>
                </tr>
              ))
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
                      {u.employee ? (
                        <Link href={`/admin/empleados/${u.employee.id}`} className="text-xs text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1">
                          {u.employee.apellido}, {u.employee.nombre} · {u.employee.legajo}
                          <ExternalLink size={10} />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin legajo</span>
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
                    <span className="text-xs text-muted-foreground">
                      {u.permisos.length === 0 ? 'Acceso total' : `${u.permisos.length} permiso${u.permisos.length !== 1 ? 's' : ''}`}
                      {!u.employee && <span className="ml-1 text-green-700 dark:text-green-400">· soporte</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.role === 'ADMIN' && (
                    <button
                      onClick={() => setPermisosOf(u)}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mr-1"
                      title="Editar permisos"
                    >
                      <KeyRound size={13} />
                    </button>
                  )}
                  {u.employee && (
                    <button
                      onClick={() => setSubordinadosOf({
                        id: u.id,
                        label: `${u.employee!.apellido}, ${u.employee!.nombre}`,
                      })}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mr-1"
                      title="Configurar subordinados"
                    >
                      <Network size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteUser({ id: u.id, email: u.email, hasEmployee: !!u.employee })}
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
      <ConfirmDialog
        open={!!deleteUser}
        title={`¿Eliminar usuario ${deleteUser?.email}?`}
        description={deleteUser?.hasEmployee
          ? 'Esta acción también elimina el legajo asociado. No se puede deshacer.'
          : 'Esta acción no se puede deshacer.'}
        onConfirm={doDeleteUser}
        onCancel={() => setDeleteUser(null)}
      />
      <BloqueoEliminacionDialog
        open={!!blockedDelete}
        onClose={() => setBlockedDelete(null)}
        title={blockedDelete ? `No se puede eliminar el usuario ${blockedDelete.email}` : ''}
        dependencias={blockedDelete?.dependencias ?? []}
        forceDeleteUrl={blockedDelete ? `/api/usuarios/${blockedDelete.id}` : undefined}
        confirmToken={blockedDelete?.email}
        onDeleted={fetchAll}
      />
      {subordinadosOf && (
        <SubordinadosDialog
          open={true}
          managerId={subordinadosOf.id}
          managerLabel={subordinadosOf.label}
          onClose={() => setSubordinadosOf(null)}
          onSaved={fetchAll}
        />
      )}
      {permisosOf && (
        <PermisosDialog
          open={true}
          userId={permisosOf.id}
          userLabel={permisosOf.employee ? `${permisosOf.employee.apellido}, ${permisosOf.employee.nombre}` : permisosOf.email}
          initialPermisos={permisosOf.permisos}
          onClose={() => setPermisosOf(null)}
          onSaved={fetchAll}
        />
      )}
    </div>
  )
}
