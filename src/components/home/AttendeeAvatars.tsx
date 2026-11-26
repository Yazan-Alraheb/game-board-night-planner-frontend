import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { getInitials, placeholderColor } from "@/lib/format";
import type { PublicUser } from "@/types/friend";

interface AttendeeAvatarsProps {
  attendees: readonly PublicUser[];
  max?: number;
}

/** Overlapping avatar stack; extra attendees collapse into a "+N" bubble. */
function AttendeeAvatars({ attendees, max = 4 }: AttendeeAvatarsProps) {
  const visible = attendees.slice(0, max);
  const hidden = attendees.length - visible.length;

  return (
    // The player count is shown as text next to this, so the names are hidden from screen readers.
    <AvatarGroup aria-hidden="true">
      {visible.map((person) => (
        <Avatar key={person.id} size="lg">
          {person.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
          <AvatarFallback className={`text-xs font-semibold ${placeholderColor(person.id)}`}>
            {getInitials(person.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {hidden > 0 && <AvatarGroupCount>+{hidden}</AvatarGroupCount>}
    </AvatarGroup>
  );
}

export default AttendeeAvatars;
