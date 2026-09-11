import { Button } from "rrhh_temp"
import { PlusIcon, TrashIcon } from "lucide-react"

export function Variants() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <Button variant="default">Guardar</Button>
      <Button variant="secondary">Cancelar</Button>
      <Button variant="outline">Ver detalle</Button>
      <Button variant="ghost">Omitir</Button>
      <Button variant="destructive">Eliminar</Button>
      <Button variant="link">Ver más</Button>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <Button size="xs">Extra chico</Button>
      <Button size="sm">Chico</Button>
      <Button size="default">Normal</Button>
      <Button size="lg">Grande</Button>
      <Button size="icon" aria-label="Agregar">
        <PlusIcon />
      </Button>
    </div>
  )
}

export function WithIconAndStates() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <Button>
        <PlusIcon />
        Nuevo empleado
      </Button>
      <Button variant="destructive">
        <TrashIcon />
        Eliminar
      </Button>
      <Button disabled>No disponible</Button>
    </div>
  )
}
