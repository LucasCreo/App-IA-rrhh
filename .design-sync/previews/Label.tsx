import { Label, Input, Switch } from "rrhh_temp"

export function ConInput() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 240 }}>
      <Label htmlFor="puesto-input">Puesto</Label>
      <Input id="puesto-input" placeholder="Ej: Analista de RRHH" />
    </div>
  )
}

export function ConSwitch() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Switch id="notif-switch" defaultChecked />
      <Label htmlFor="notif-switch">Recibir notificaciones por email</Label>
    </div>
  )
}
