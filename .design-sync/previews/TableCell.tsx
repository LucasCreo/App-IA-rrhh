import * as React from "react"
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "rrhh_temp"

export function Default() {
  return (
    <Table>
      <TableCaption>Empleados activos por área — septiembre 2026.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Empleado</TableHead>
          <TableHead>Área</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead style={{ textAlign: "right" }}>Antigüedad</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Ana Gómez</TableCell>
          <TableCell>Recursos Humanos</TableCell>
          <TableCell>Activo</TableCell>
          <TableCell style={{ textAlign: "right" }}>3 años</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Martín Díaz</TableCell>
          <TableCell>Sistemas</TableCell>
          <TableCell>Licencia</TableCell>
          <TableCell style={{ textAlign: "right" }}>1 año</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Lucía Fernández</TableCell>
          <TableCell>Administración</TableCell>
          <TableCell>Activo</TableCell>
          <TableCell style={{ textAlign: "right" }}>5 años</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell style={{ textAlign: "right" }}>3 empleados</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}
