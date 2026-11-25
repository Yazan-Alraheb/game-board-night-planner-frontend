"use client";

import { useParams } from "next/navigation";
import GameDetails from "@/views/GameDetails";

export default function Page() {
  const params = useParams<{ id: string }>();

  return <GameDetails id={params.id} />;
}