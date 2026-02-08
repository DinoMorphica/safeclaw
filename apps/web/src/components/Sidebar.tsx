import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/interception", label: "Command Interception" },
  { to: "/sessions", label: "Session Monitor" },
  { to: "/threats", label: "Threat Center" },
  { to: "/access", label: "Access Control" },
  { to: "/openclaw", label: "OpenClaw Config" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar border-r border-gray-800">
      <div className="flex h-14 items-center gap-2 px-6 border-b border-gray-800">
        <span className="text-xl font-bold">
          <span className="text-white">Safe</span>
          <span className="text-red-500" style={{ textShadow: "0 0 8px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.3)" }}>Claw</span>
        </span>
        <span className="text-xs text-gray-500">v0.1.0</span>
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
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
