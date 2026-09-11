import { Avatar, AvatarFallback, AvatarBadge } from "rrhh_temp"

export function Default() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <Avatar>
        <AvatarFallback>AG</AvatarFallback>
        <AvatarBadge style={{ width: 10, height: 10 }} />
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>MD</AvatarFallback>
        <AvatarBadge style={{ width: 12, height: 12 }} />
      </Avatar>
    </div>
  )
}
