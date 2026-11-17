import { BrowserRouter, Routes, Route } from "react-router";
import { AuthProvider } from "@/auth/AuthProvider";
import ProtectedRoute from "@/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import ComingSoon from "@/pages/ComingSoon";
import { ROUTES } from "@/lib/routes";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            {/* Public pages */}
            <Route path={ROUTES.home} element={<Home />} />
            <Route path={ROUTES.login} element={<Login />} />
            <Route path={ROUTES.register} element={<Register />} />
            <Route
              path={ROUTES.findGame}
              element={<ComingSoon title="Find a Game" />}
            />
            <Route
              path={ROUTES.browse}
              element={<ComingSoon title="Browse Games" />}
            />

            {/* Protected pages */}
            <Route element={<ProtectedRoute />}>
              <Route
                path={ROUTES.dashboard}
                element={<Dashboard />}
              />
              <Route
                path={ROUTES.collection}
                element={<ComingSoon title="My Collection" />}
              />
              <Route
                path={ROUTES.messages}
                element={<ComingSoon title="Messages" />}
              />
              <Route
                path={ROUTES.createGameNight}
                element={<ComingSoon title="Create Game Night" />}
              />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
