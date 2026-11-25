"use client";

import { useState } from "react";
import { getInitials, placeholderColor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface GameImageProps {
  gameId: number;
  name: string;
  imageUrl: string | null;
  className?: string;
  /** Text size for the initials placeholder. */
  placeholderClassName?: string;
}

/**
 * Game picture with a coloured initials tile when there's no image or it fails to load.
 * Same fallback approach as the homepage GameCard. Decorative: the name is shown as text next to it.
 */
function GameImage({ gameId, name, imageUrl, className, placeholderClassName }: GameImageProps) {
  // Remember which URL failed so a new image_url gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = imageUrl !== null && imageUrl !== "" && imageUrl !== failedUrl;

  return (
    <div className={cn("relative overflow-hidden bg-white", className)}>
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setFailedUrl(imageUrl)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            "flex size-full items-center justify-center font-heading font-bold",
            placeholderColor(gameId),
            placeholderClassName ?? "text-4xl",
          )}
        >
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}

export default GameImage;
