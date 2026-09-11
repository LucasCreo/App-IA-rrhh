import { AvatarGroup, Avatar, AvatarFallback, AvatarGroupCount } from "rrhh_temp"

export function Default() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>AG</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>LF</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+6</AvatarGroupCount>
    </AvatarGroup>
  )
}
