import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "rrhh_temp"

export function Default() {
  return (
    <Card style={{ width: 320 }}>
      <CardHeader>
        <CardTitle>Ana Gómez</CardTitle>
        <CardDescription>Analista de RRHH</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ margin: 0 }}>Legajo #3190 · Sede Buenos Aires.</p>
      </CardContent>
    </Card>
  )
}
