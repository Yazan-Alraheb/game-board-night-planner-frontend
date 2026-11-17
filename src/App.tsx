import { BrowserRouter, Routes, Route } from "react-router";
import AppLayout from "./components/layout/AppLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ComingSoon from "./pages/ComingSoon";
import { ROUTES } from "./lib/routes";
import Register from "./pages/Register";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.home} element={<Home />} />
          <Route path={ROUTES.login} element={<Login />} />
          <Route path={ROUTES.register} element={<Register />} />
          <Route path={ROUTES.dashboard} element={<Dashboard />} />

          {/* PLACEHOLDER routes: linked from the navbar/homepage, pages not built yet. */}
          <Route path={ROUTES.findGame} element={<ComingSoon title="Find a Game" />} />
          <Route path={ROUTES.browse} element={<ComingSoon title="Browse Games" />} />
          <Route path={ROUTES.collection} element={<ComingSoon title="My Collection" />} />
          <Route path={ROUTES.messages} element={<ComingSoon title="Messages" />} />
          <Route path={ROUTES.createGameNight} element={<ComingSoon title="Create Game Night" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
