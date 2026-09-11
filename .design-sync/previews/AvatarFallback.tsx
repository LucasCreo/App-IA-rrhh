import { Avatar, AvatarFallback } from "rrhh_temp"

export function Default() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar>
        <AvatarFallback>AG</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>LF</AvatarFallback>
      </Avatar>
    </div>
  )
}
