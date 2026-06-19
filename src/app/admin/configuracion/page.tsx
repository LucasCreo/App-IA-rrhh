import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { ConfiguracionClient } from '@/components/configuracion/ConfiguracionClient'

export default async function ConfiguracionPage() {
  const puedeGestionarUsuarios = !!(await requirePermiso(PERMISOS.GESTIONAR_USUARIOS))
  return <ConfiguracionClient puedeGestionarUsuarios={puedeGestionarUsuarios} />
}
