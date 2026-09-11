import * as React from "react"
import { Switch, Label } from "rrhh_temp"

function Row({ label, ...props }: { label: string } & React.ComponentProps<typeof Switch>) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Switch id={label} {...props} />
      <Label htmlFor={label}>{label}</Label>
    </div>
  )
}

export function Estados() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Row label="Apagado" />
      <Row label="Encendido" defaultChecked />
      <Row label="Deshabilitado" disabled />
      <Row label="Deshabilitado y encendido" disabled defaultChecked />
    </div>
  )
}

export function Tamanos() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Switch id="switch-sm" size="sm" defaultChecked />
        <Label htmlFor="switch-sm">Chico</Label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Switch id="switch-default" size="default" defaultChecked />
        <Label htmlFor="switch-default">Normal</Label>
      </div>
    </div>
  )
}
