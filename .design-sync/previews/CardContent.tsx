import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "rrhh_temp"

export function Default() {
  return (
    <Card style={{ width: 320 }}>
      <CardHeader>
        <CardTitle>Resumen del legajo</CardTitle>
        <CardDescription>Lucía Fernández</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ margin: 0 }}>Área: Administración de Personal</p>
          <p style={{ margin: 0 }}>Puesto: Coordinadora</p>
          <p style={{ margin: 0 }}>Antigüedad: 5 años</p>
        </div>
      </CardContent>
    </Card>
  )
}
