import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "rrhh_temp"
import { Button } from "rrhh_temp"

export function Default() {
  return (
    <Card style={{ width: 320 }}>
      <CardHeader>
        <CardTitle>Solicitud de vacaciones</CardTitle>
        <CardDescription>Ana Gómez · 10 días</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            Revisar
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p style={{ margin: 0 }}>Del 03/11/2026 al 13/11/2026.</p>
      </CardContent>
    </Card>
  )
}
