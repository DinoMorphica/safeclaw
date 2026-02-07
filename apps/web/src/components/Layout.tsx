import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ConnectionStatus } from "./ConnectionStatus";

export function Layout() {
  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-gray-800 px-6">
          <h1 className="text-sm font-medium text-gray-300">
            AI Agent Security Dashboard
          </h1>
          <ConnectionStatus />
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
