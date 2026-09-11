import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "rrhh_temp"
import { MoreVerticalIcon } from "lucide-react"

export function Default() {
  return (
    <Card style={{ width: 320 }}>
      <CardHeader>
        <CardTitle>Lucía Fernández</CardTitle>
        <CardDescription>Coordinadora de Administración</CardDescription>
        <CardAction>
          <MoreVerticalIcon size={16} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p style={{ margin: 0 }}>Equipo: Administración de Personal.</p>
      </CardContent>
    </Card>
  )
}
