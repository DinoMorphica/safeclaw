import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/interception", label: "Command Interception" },
  { to: "/sessions", label: "Session Monitor" },
  { to: "/access", label: "Access Control" },
  { to: "/openclaw", label: "OpenClaw Config" },
  { to: "/settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar border-r border-gray-800">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-800">
        <span className="text-xl font-bold text-primary">SafeClaw</span>
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
    </aside>
  );
}
