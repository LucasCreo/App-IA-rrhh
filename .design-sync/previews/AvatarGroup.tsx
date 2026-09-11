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
    </AvatarGroup>
  )
}

export function WithOverflowCount() {
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
      <AvatarGroupCount>+4</AvatarGroupCount>
    </AvatarGroup>
  )
}
