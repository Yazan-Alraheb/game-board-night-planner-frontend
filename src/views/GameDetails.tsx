"use client";

import GameDetailsView from "@/components/games/GameDetailsView";
import { useGame, useGameCollectionStatus } from "@/hooks/useGameDetails";
import { parseGameId } from "@/lib/games/game-details";

interface GameDetailsProps {
  id: string;
}

function GameDetails({ id }: GameDetailsProps) {
  const gameId = parseGameId(id);
  const { game, retry: retryGame } = useGame(gameId);
  const { collection, save, remove, retry: retryCollection } = useGameCollectionStatus(gameId);

  return (
    <GameDetailsView
      game={gameId === null ? null : game}
      collection={collection}
      onRetryGame={retryGame}
      onSave={save}
      onRemove={remove}
      onRetryCollection={retryCollection}
    />
  );
}

export default GameDetails;
