import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { InterceptionPage } from "./pages/InterceptionPage";
import { SessionsPage } from "./pages/SessionsPage";
import { AccessControlPage } from "./pages/AccessControlPage";
import { OpenClawPage } from "./pages/OpenClawPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="interception" element={<InterceptionPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="access" element={<AccessControlPage />} />
          <Route path="openclaw" element={<OpenClawPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
