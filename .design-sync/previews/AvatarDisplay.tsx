import * as React from "react"
import { AvatarDisplay } from "rrhh_temp"

export function Default() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <AvatarDisplay nombre="Ana Gómez" />
      <AvatarDisplay nombre="Martín Fernández" />
      <AvatarDisplay nombre="Lucía Rodríguez" size={56} />
      <AvatarDisplay nombre="Juan Carlos Pérez" bgColor="#dbeafe" textColor="#1e40af" size={40} />
      <AvatarDisplay iniciales="RH" bgColor="#fef3c7" textColor="#92400e" size={40} />
    </div>
  )
}
