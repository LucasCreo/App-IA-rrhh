import * as React from "react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "rrhh_temp"
import { Button } from "rrhh_temp"

export function Default() {
  return (
    <Dialog defaultOpen modal={false}>
      <DialogTrigger render={<Button variant="outline">Editar empleado</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar empleado</DialogTitle>
          <DialogDescription>
            Actualizá los datos del legajo. Los cambios se guardan al confirmar.
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
          <div>Nombre: Ana Gómez</div>
          <div>Puesto: Analista de RRHH</div>
          <div>Área: Recursos Humanos</div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancelar</Button>} />
          <Button>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
