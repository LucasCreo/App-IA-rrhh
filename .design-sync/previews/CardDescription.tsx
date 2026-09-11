import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "rrhh_temp"

export function Default() {
  return (
    <Card style={{ width: 320 }}>
      <CardHeader>
        <CardTitle>Martín Díaz</CardTitle>
        <CardDescription>Analista de Sistemas — Legajo #4821</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ margin: 0 }}>Ingresó el 04/06/2021. Estado: Licencia.</p>
      </CardContent>
    </Card>
  )
}
