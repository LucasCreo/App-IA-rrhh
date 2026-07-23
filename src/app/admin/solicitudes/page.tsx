import { AdminHeader } from '@/components/layout/AdminHeader'
import { SolicitudesAdminTabs } from '@/components/solicitudes/SolicitudesAdminTabs'

export default function SolicitudesPage() {
  return (
    <>
      <AdminHeader title="Solicitudes" />
      <div className="p-4 sm:p-6">
        <SolicitudesAdminTabs />
      </div>
    </>
  )
}
