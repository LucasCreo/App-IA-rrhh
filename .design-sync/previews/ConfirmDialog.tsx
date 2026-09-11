import * as React from "react"
import { ConfirmDialog } from "rrhh_temp"

export function Default() {
  return (
    <ConfirmDialog
      open={true}
      title="Eliminar empleado"
      description="¿Confirmás la baja del legajo de Ana Gómez? Esta acción no se puede deshacer."
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  )
}

export function Aprobacion() {
  return (
    <ConfirmDialog
      open={true}
      title="Aprobar solicitud de vacaciones"
      description="Se notificará al empleado y se descontarán los días del saldo disponible."
      confirmLabel="Aprobar"
      confirmVariant="default"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  )
}
