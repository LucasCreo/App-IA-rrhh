import { Avatar, AvatarImage, AvatarFallback } from "rrhh_temp"

export function Default() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar>
        <AvatarImage src="/avatars/ana-gomez.jpg" alt="Ana Gómez" />
        <AvatarFallback>AG</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
    </div>
  )
}
