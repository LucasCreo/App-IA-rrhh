import { Textarea, Label } from "rrhh_temp"

export function ConEtiqueta() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 280 }}>
      <Label htmlFor="obs-textarea">Observaciones</Label>
      <Textarea
        id="obs-textarea"
        placeholder="Agregá comentarios sobre la licencia..."
        defaultValue="El empleado solicitó licencia por enfermedad desde el 12/09 hasta el 16/09, con certificado médico adjunto."
      />
    </div>
  )
}
