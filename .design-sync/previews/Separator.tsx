import { Separator } from "rrhh_temp"

export function Horizontal() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 260 }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>Datos personales</div>
      <Separator />
      <div style={{ fontSize: 13, fontWeight: 500 }}>Datos laborales</div>
    </div>
  )
}

export function Vertical() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: 32 }}>
      <span style={{ fontSize: 13 }}>Legajo</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: 13 }}>Área</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: 13 }}>Sucursal</span>
    </div>
  )
}
