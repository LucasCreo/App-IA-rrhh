import * as React from "react"
import { BloqueoEliminacionDialog } from "rrhh_temp"

export function Default() {
  return (
    <BloqueoEliminacionDialog
      open={true}
      onClose={() => {}}
      title="No se puede eliminar el área Sistemas"
      dependencias={[
        { label: "Empleados", count: 5, href: "#" },
        { label: "Puestos", count: 2, href: "#" },
        { label: "Solicitudes de vacaciones", count: 8, href: "#" },
      ]}
      suggest="Reasigná los legajos a otra área antes de continuar."
    />
  )
}

export function ConCascada() {
  return (
    <BloqueoEliminacionDialog
      open={true}
      onClose={() => {}}
      title="No se puede eliminar a Martín Fernández"
      dependencias={[
        { label: "Recibos de sueldo", count: 12, href: "#" },
        { label: "Solicitudes", count: 3, href: "#" },
      ]}
      forceDeleteUrl="/api/empleados/123"
      confirmToken="martin.fernandez@rrhh.com"
      onDeleted={() => {}}
    />
  )
}
