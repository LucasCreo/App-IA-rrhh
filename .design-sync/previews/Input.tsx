import { Input, Label } from "rrhh_temp"

export function Estados() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 260 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Label htmlFor="nombre-input">Nombre completo</Label>
        <Input id="nombre-input" placeholder="Ej: Martina Gómez" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Label htmlFor="email-input">Correo electrónico</Label>
        <Input id="email-input" type="email" defaultValue="martina.gomez@empresa.com.ar" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Label htmlFor="legajo-input">Legajo (deshabilitado)</Label>
        <Input id="legajo-input" defaultValue="LEG-04821" disabled />
      </div>
    </div>
  )
}
