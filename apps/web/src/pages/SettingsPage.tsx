import { useEffect, useState } from "react";
import { socket } from "../lib/socket";
import type { SafeClawConfig } from "@safeclaw/shared";

export function SettingsPage() {
  const [config, setConfig] = useState<SafeClawConfig | null>(null);

  useEffect(() => {
    socket.emit("safeclaw:getSettings");

    const handler = (data: SafeClawConfig) => {
      setConfig(data);
    };

    socket.on("safeclaw:settingsData", handler);
    return () => {
      socket.off("safeclaw:settingsData", handler);
    };
  }, []);

  const toggleAutoOpen = () => {
    if (!config) return;
    socket.emit("safeclaw:updateSettings", {
      autoOpenBrowser: !config.autoOpenBrowser,
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      {config ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="text-sm font-medium text-gray-200 mb-4">General</h3>
            <div className="space-y-3">
              <SettingRow label="Port" value={String(config.port)} />
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-sm text-gray-400">
                  Auto-open browser
                </span>
                <button
                  type="button"
                  onClick={toggleAutoOpen}
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer ${
                    config.autoOpenBrowser ? "bg-primary" : "bg-gray-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      config.autoOpenBrowser
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <SettingRow label="Data directory" value="~/.safeclaw/" />
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="text-sm font-medium text-gray-200 mb-4">Account</h3>
            <div className="space-y-3">
              <SettingRow
                label="Plan"
                value={config.premium ? "Premium" : "Free"}
              />
              <SettingRow label="Version" value={config.version} />
              <SettingRow
                label="User ID"
                value={config.userId ?? "Not set"}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">Loading settings...</p>
      )}
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm text-gray-200">{value}</span>
    </div>
  );
}
