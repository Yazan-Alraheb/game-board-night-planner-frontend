import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { getSession } from "@/auth/session";
import { ROUTES } from "@/lib/routes";

function ProtectedRoute() {
  const { session } = useAuth();
  const location = useLocation();

  if (!session || !getSession()) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{
          from:
            location.pathname +
            location.search +
            location.hash,
        }}
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
