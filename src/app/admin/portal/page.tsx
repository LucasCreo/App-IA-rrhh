import { AdminHeader } from '@/components/layout/AdminHeader'
import { PortalFeed } from '@/components/portal/PortalFeed'

export default function AdminPortalPage() {
  return (
    <>
      <AdminHeader title="Portal interno" />
      <div className="p-6">
        <PortalFeed />
      </div>
    </>
  )
}
