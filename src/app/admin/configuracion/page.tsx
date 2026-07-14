import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { ConfiguracionClient } from '@/components/configuracion/ConfiguracionClient'

export default async function ConfiguracionPage() {
  const puedeGestionarUsuarios = !!(await requirePermiso(PERMISOS.GESTIONAR_USUARIOS))
  const puedeVerAuditoria = !!(await requirePermiso(PERMISOS.VER_AUDITORIA))
  return <ConfiguracionClient puedeGestionarUsuarios={puedeGestionarUsuarios} puedeVerAuditoria={puedeVerAuditoria} />
}
