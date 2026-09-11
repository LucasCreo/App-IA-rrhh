import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Avatar,
  AvatarFallback,
} from "rrhh_temp"
import { Button } from "rrhh_temp"
import { MoreVerticalIcon } from "lucide-react"

export function Default() {
  return (
    <Card style={{ width: 320 }}>
      <CardHeader>
        <CardTitle>Ana Gómez</CardTitle>
        <CardDescription>Analista de RRHH</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ margin: 0 }}>
          Ingresó el 12/03/2023. Área: Recursos Humanos. Estado: Activo.
        </p>
      </CardContent>
    </Card>
  )
}

export function WithFooterActions() {
  return (
    <Card style={{ width: 320 }}>
      <CardHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar>
            <AvatarFallback>MD</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>Martín Díaz</CardTitle>
            <CardDescription>Legajo #4821</CardDescription>
          </div>
        </div>
        <CardAction>
          <MoreVerticalIcon size={16} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p style={{ margin: 0 }}>Solicitud de licencia pendiente de aprobación.</p>
      </CardContent>
      <CardFooter style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="outline" size="sm">
          Rechazar
        </Button>
        <Button size="sm">Aprobar</Button>
      </CardFooter>
    </Card>
  )
}
