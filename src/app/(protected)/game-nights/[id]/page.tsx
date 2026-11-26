import GameNightDetails from "@/views/GameNightDetails";
import { parseGameNightId } from "@/lib/game-nights/details";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Keyed by id so moving between nights starts with fresh page state.
  return <GameNightDetails key={id} id={parseGameNightId(id)} />;
}
