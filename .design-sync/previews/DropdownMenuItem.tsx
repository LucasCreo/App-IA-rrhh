import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "rrhh_temp"
import { Button } from "rrhh_temp"
import {
  MoreHorizontalIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  DownloadIcon,
} from "lucide-react"

export function Default() {
  return (
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon">
            <MoreHorizontalIcon />
          </Button>
        }
      />
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Ana Gómez</DropdownMenuLabel>
          <DropdownMenuItem>
            <EyeIcon />
            Ver legajo
          </DropdownMenuItem>
          <DropdownMenuItem>
            <PencilIcon />
            Editar
            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem defaultChecked>
          Notificar cambios
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup defaultValue="activo">
          <DropdownMenuRadioItem value="activo">Activo</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="licencia">Licencia</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="baja">Baja</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub defaultOpen>
          <DropdownMenuSubTrigger>
            <DownloadIcon />
            Exportar
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>PDF</DropdownMenuItem>
            <DropdownMenuItem>Excel</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <TrashIcon />
          Eliminar
          <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
