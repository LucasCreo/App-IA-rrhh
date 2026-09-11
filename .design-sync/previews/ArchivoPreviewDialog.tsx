import * as React from "react"
import { ArchivoPreviewDialog } from "rrhh_temp"

export function Default() {
  return (
    <ArchivoPreviewDialog
      open={true}
      onClose={() => {}}
      url="/files/contrato-ana-gomez.docx"
      filename="contrato-ana-gomez.docx"
    />
  )
}
