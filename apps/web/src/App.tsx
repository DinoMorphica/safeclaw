import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { InterceptionPage } from "./pages/InterceptionPage";
import { SessionsPage } from "./pages/SessionsPage";
import { ThreatsPage } from "./pages/ThreatsPage";
import { AccessControlPage } from "./pages/AccessControlPage";
import { OpenClawPage } from "./pages/OpenClawPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SkillScannerPage } from "./pages/SkillScannerPage";
import { SecurityWorkflowPage } from "./pages/SecurityWorkflowPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="security" element={<SecurityWorkflowPage />} />
          <Route path="interception" element={<InterceptionPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="threats" element={<ThreatsPage />} />
          <Route path="skill-scanner" element={<SkillScannerPage />} />
          <Route path="access" element={<AccessControlPage />} />
          <Route path="openclaw" element={<OpenClawPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
