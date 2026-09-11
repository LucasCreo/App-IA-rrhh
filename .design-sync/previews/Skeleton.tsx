import { Skeleton } from "rrhh_temp"

export function CargandoLista() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 260 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton style={{ height: 40, width: 40, borderRadius: 9999 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton style={{ height: 12, width: 140 }} />
          <Skeleton style={{ height: 10, width: 90 }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton style={{ height: 10, width: "100%" }} />
        <Skeleton style={{ height: 10, width: "90%" }} />
        <Skeleton style={{ height: 10, width: "70%" }} />
      </div>
    </div>
  )
}
