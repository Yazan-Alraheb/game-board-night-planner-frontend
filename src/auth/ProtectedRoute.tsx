
import { Navigate, Outlet } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { getSession } from "@/auth/session";
import { ROUTES } from "@/lib/routes";

function ProtectedRoute() {
  const { session } = useAuth();

  // Make sure the user has a session
  // and the saved JWT has not expired
  if (!session || !getSession()) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
