import { useEffect, useState } from "react";
import { socket } from "../lib/socket";
import type { SafeClawConfig } from "@safeclaw/shared";

const PORT_MIN = 1024;
const PORT_MAX = 65535;

export function SettingsPage() {
  const [config, setConfig] = useState<SafeClawConfig | null>(null);
  const [portInput, setPortInput] = useState("");
  const [portError, setPortError] = useState<string | null>(null);
  const [portSaved, setPortSaved] = useState(false);

  useEffect(() => {
    socket.emit("safeclaw:getSettings");

    const handler = (data: SafeClawConfig) => {
      setConfig(data);
      setPortInput(String(data.port));
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

  const handlePortChange = (value: string) => {
    setPortInput(value);
    setPortSaved(false);
    setPortError(null);
  };

  const savePort = () => {
    if (!config) return;
    const num = Number(portInput);
    if (!Number.isInteger(num) || num < PORT_MIN || num > PORT_MAX) {
      setPortError(`Port must be an integer between ${PORT_MIN} and ${PORT_MAX}`);
      return;
    }
    setPortError(null);
    socket.emit("safeclaw:updateSettings", { port: num });
    setPortSaved(true);
  };

  const handlePortKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") savePort();
  };

  const portChanged = config ? Number(portInput) !== config.port : false;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      {config ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="text-sm font-medium text-gray-200 mb-4">General</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-sm text-gray-400">Port</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={PORT_MIN}
                    max={PORT_MAX}
                    value={portInput}
                    onChange={(e) => handlePortChange(e.target.value)}
                    onKeyDown={handlePortKeyDown}
                    className="w-24 rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1 text-sm text-gray-200 text-right focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {portChanged && !portSaved && (
                    <button
                      type="button"
                      onClick={savePort}
                      className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/80 transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>
              {portError && (
                <p className="text-xs text-danger -mt-2">{portError}</p>
              )}
              {portSaved && (
                <p className="text-xs text-warning -mt-2">
                  Port updated. Restart SafeClaw for changes to take effect.
                </p>
              )}
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-sm text-gray-400">
                  Auto-open browser
                </span>
                <button
                  type="button"
                  onClick={toggleAutoOpen}
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer ${
                    config.autoOpenBrowser ? "bg-success" : "bg-gray-700"
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
