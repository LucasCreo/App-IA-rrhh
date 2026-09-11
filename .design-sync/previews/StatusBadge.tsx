import { StatusBadge } from "rrhh_temp"

export function EstadosAdmin() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <StatusBadge estado="BORRADOR" />
      <StatusBadge estado="PENDIENTE_ENVIO" />
      <StatusBadge estado="ENVIADO_A_FIRMA" />
      <StatusBadge estado="FIRMADO" />
      <StatusBadge estado="APROBADO" />
      <StatusBadge estado="RECHAZADO" />
      <StatusBadge estado="ERROR" />
    </div>
  )
}

export function VistaEmpleado() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <StatusBadge estado="ENVIADO_A_FIRMA" accion="FIRMA" pov="empleado" />
      <StatusBadge estado="FIRMADO" accion="FIRMA" pov="empleado" />
      <StatusBadge estado="RECHAZADO" accion="FIRMA" pov="empleado" />
      <StatusBadge estado="ENVIADO_A_FIRMA" accion="LECTURA" pov="empleado" />
      <StatusBadge estado="FIRMADO" accion="LECTURA" pov="empleado" />
    </div>
  )
}
