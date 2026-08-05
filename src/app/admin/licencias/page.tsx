import { AdminHeader } from '@/components/layout/AdminHeader'
import { LicenciasAdmin } from '@/components/licencias/LicenciasAdmin'

export default function LicenciasPage() {
  return (
    <>
      <AdminHeader title="Licencias" />
      <div className="p-4 sm:p-6">
        <LicenciasAdmin />
      </div>
    </>
  )
}
