"use client";

import FindGameWizard from "@/components/find-a-game/FindGameWizard";
import { useAuth } from "@/auth/useAuth";

/** Find a Game questionnaire. Rendered inside the (protected) layout, so a session exists. */
function FindGame() {
  const { session } = useAuth();
  if (!session) return null;

  const userId = session.user.id;
  // Keyed by user so switching accounts in the same tab never shows another user's answers.
  return <FindGameWizard key={userId} userId={userId} />;
}

export default FindGame;
