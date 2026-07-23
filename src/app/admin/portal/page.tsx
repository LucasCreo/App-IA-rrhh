import { AdminHeader } from '@/components/layout/AdminHeader'
import { PortalFeed } from '@/components/portal/PortalFeed'

export default function AdminPortalPage() {
  return (
    <>
      <AdminHeader title="Avisos" />
      <div className="p-4 sm:p-6">
        <PortalFeed />
      </div>
    </>
  )
}
