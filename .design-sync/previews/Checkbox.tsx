import * as React from "react"
import { Checkbox, Label } from "rrhh_temp"

function Row({ label, ...props }: { label: string } & React.ComponentProps<typeof Checkbox>) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Checkbox id={label} {...props} />
      <Label htmlFor={label}>{label}</Label>
    </div>
  )
}

export function States() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Row label="Sin marcar" />
      <Row label="Marcado" defaultChecked />
      <Row label="Deshabilitado" disabled />
      <Row label="Deshabilitado y marcado" disabled defaultChecked />
    </div>
  )
}
