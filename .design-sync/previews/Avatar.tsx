import { Avatar, AvatarFallback } from "rrhh_temp"

export function Default() {
  return (
    <Avatar>
      <AvatarFallback>AG</AvatarFallback>
    </Avatar>
  )
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar size="sm">
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar size="default">
        <AvatarFallback>LF</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>AG</AvatarFallback>
      </Avatar>
    </div>
  )
}
