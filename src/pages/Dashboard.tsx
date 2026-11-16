
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import api from "@/api/client";

function Dashboard() {
  const [gameCount, setGameCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchGames() {
      try {
        const response = await api.get("/games");
        setGameCount(response.data.total);
      } catch (err) {
        console.error(err);
        setError("Failed to connect to FastAPI");
      }
    }

    fetchGames();
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="mb-4 text-3xl font-bold">
        Game Night Planner
      </h1>

      <p className="mb-6 text-muted-foreground">
        Welcome to your dashboard!
      </p>

      {error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <p className="mb-4">
          Games in database: {gameCount ?? "Loading..."}
        </p>
      )}

      <Button>Create Game Night</Button>
    </div>
  );
}

export default Dashboard;
