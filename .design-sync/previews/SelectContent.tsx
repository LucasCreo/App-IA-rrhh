import * as React from "react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "rrhh_temp"

export function Default() {
  return (
    <Select defaultOpen modal={false} defaultValue="rrhh">
      <SelectTrigger>
        <SelectValue placeholder="Área" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Área</SelectLabel>
          <SelectItem value="rrhh">Recursos Humanos</SelectItem>
          <SelectItem value="sistemas">Sistemas</SelectItem>
          <SelectItem value="administracion">Administración</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Estado</SelectLabel>
          <SelectItem value="activo">Activo</SelectItem>
          <SelectItem value="licencia">Licencia</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
