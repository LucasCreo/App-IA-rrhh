import * as React from "react"
import { Pagination } from "rrhh_temp"

export function Default() {
  return (
    <div style={{ width: 420, border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>Legajos — Recursos Humanos</div>
      <Pagination
        page={2}
        pageSize={20}
        total={132}
        itemLabel="empleados"
        onPageChange={() => {}}
      />
    </div>
  )
}

export function ConSelectorDeTamano() {
  return (
    <div style={{ width: 420, border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>Solicitudes de licencia</div>
      <Pagination
        page={1}
        pageSize={10}
        total={47}
        itemLabel="solicitudes"
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    </div>
  )
}
