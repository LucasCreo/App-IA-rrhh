import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "rrhh_temp"
import { Button } from "rrhh_temp"

export function Default() {
  return (
    <Card style={{ width: 320 }}>
      <CardHeader>
        <CardTitle>Solicitud de licencia</CardTitle>
        <CardDescription>Martín Díaz · Legajo #4821</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ margin: 0 }}>Licencia médica del 01/09/2026 al 08/09/2026.</p>
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
