import { Badge } from "rrhh_temp"

export function Variants() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <Badge variant="default">Activo</Badge>
      <Badge variant="secondary">Nuevo</Badge>
      <Badge variant="destructive">Vencido</Badge>
      <Badge variant="outline">Borrador</Badge>
      <Badge variant="ghost">Archivado</Badge>
    </div>
  )
}
