import { AdminHeader } from '@/components/layout/AdminHeader'
import { UsuariosPage } from '@/components/usuarios/UsuariosPage'

export default function Page() {
  return (
    <>
      <AdminHeader title="Usuarios y Roles" />
      <UsuariosPage />
    </>
  )
}
