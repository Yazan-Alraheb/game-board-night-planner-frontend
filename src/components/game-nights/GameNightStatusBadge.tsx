import { CircleCheck, CircleHelp, CircleX, Crown, MailQuestion } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MyGameNightStatus } from "@/lib/game-nights/overview";

interface BadgeStyle {
  label: string;
  pastLabel: string;
  icon: LucideIcon;
  className: string;
}

// Each status has its own icon and wording, so it never depends on colour alone.
const STYLES: Record<MyGameNightStatus | "unknown", BadgeStyle> = {
  hosting: {
    label: "Hosting",
    pastLabel: "Hosted",
    icon: Crown,
    className: "bg-brand-strong text-brand-foreground",
  },
  going: {
    label: "Going",
    pastLabel: "Attended",
    icon: CircleCheck,
    className: "bg-brand-soft text-brand-strong",
  },
  invited: {
    label: "Invited",
    pastLabel: "No response",
    icon: MailQuestion,
    className: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  },
  declined: {
    label: "Declined",
    pastLabel: "Declined",
    icon: CircleX,
    className: "bg-muted text-foreground/75 ring-1 ring-border",
  },
  unknown: {
    label: "Status unavailable",
    pastLabel: "Status unavailable",
    icon: CircleHelp,
    className: "bg-muted text-foreground/75 ring-1 ring-border",
  },
};

interface GameNightStatusBadgeProps {
  status: MyGameNightStatus | null;
  past: boolean;
}

function GameNightStatusBadge({ status, past }: GameNightStatusBadgeProps) {
  const style = STYLES[status ?? "unknown"];
  const Icon = style.icon;

  return (
    <Badge className={cn("h-auto shrink-0 gap-1.5 px-3 py-1 text-sm font-medium", style.className)}>
      <Icon aria-hidden="true" />
      <span className="sr-only">Your status: </span>
      {past ? style.pastLabel : style.label}
    </Badge>
  );
}

export default GameNightStatusBadge;
