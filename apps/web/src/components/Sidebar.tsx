import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  ShieldAlert,
  Activity,
  AlertTriangle,
  ScanSearch,
  Lock,
  Bot,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/security", label: "Security Setup", icon: ShieldCheck },
  { to: "/sessions", label: "Session Monitor", icon: Activity },
  { to: "/threats", label: "Threat Center", icon: AlertTriangle },
  { to: "/interception", label: "Command Interceptor", icon: ShieldAlert },
  { to: "/skill-scanner", label: "Skill Scanner", icon: ScanSearch },
  { to: "/access", label: "Access Control", icon: Lock },
  { to: "/openclaw", label: "OpenClaw Config", icon: Bot },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar border-r border-gray-800">
      <div className="flex h-14 items-center gap-3 px-6 border-b border-gray-800">
        <img
          src="/safeclaw_icon.png"
          alt="SafeClaw"
          className="h-8 w-8 object-contain"
        />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">
            <span className="text-white">Safe</span>
            <span className="text-red-500" style={{ textShadow: "0 0 8px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.3)" }}>Claw</span>
          </span>
          <span className="text-xs text-gray-500">v0.1.0</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4 border-t border-gray-800 pt-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`
          }
        >
          <Settings size={18} />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
