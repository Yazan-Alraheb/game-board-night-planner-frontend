import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials, placeholderColor } from "@/lib/format";
import type { PublicUser } from "@/types/friend";
import type { RecommendationMode } from "@/types/recommendation";

interface OwnerListProps {
  owners: PublicUser[];
  mode: RecommendationMode;
}

const MAX_AVATARS = 3;

/**
 * Who brings the game. Personal mode: it's always the user's own copy.
 * Game-night mode: the eligible owners returned by the backend.
 */
function OwnerList({ owners, mode }: OwnerListProps) {
  if (mode === "personal") {
    return (
      <Badge className="h-auto bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-strong">
        In your collection
      </Badge>
    );
  }

  if (owners.length === 0) return null;

  const names = owners.map((owner) => owner.name).join(", ");

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
      <AvatarGroup aria-hidden="true">
        {owners.slice(0, MAX_AVATARS).map((owner) => (
          <Avatar key={owner.id} size="sm">
            {owner.avatar_url && <AvatarImage src={owner.avatar_url} alt="" />}
            <AvatarFallback className={`text-[10px] font-semibold ${placeholderColor(owner.id)}`}>
              {getInitials(owner.name)}
            </AvatarFallback>
          </Avatar>
        ))}
      </AvatarGroup>
      <p className="min-w-0 break-words">
        <span className="font-medium text-foreground">Owned by</span> {names}
      </p>
    </div>
  );
}

export default OwnerList;
