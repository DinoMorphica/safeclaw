import { useEffect, useState } from "react";
import { socket } from "../lib/socket";
import type { OpenClawMonitorStatus } from "@safeclaw/shared";

export function ConnectionStatus() {
  const [openclawStatus, setOpenclawStatus] =
    useState<OpenClawMonitorStatus | null>(null);

  useEffect(() => {
    socket.emit("safeclaw:getOpenclawMonitorStatus");
    socket.on("safeclaw:openclawMonitorStatus", setOpenclawStatus);

    return () => {
      socket.off("safeclaw:openclawMonitorStatus", setOpenclawStatus);
    };
  }, []);

  const openclawColor =
    openclawStatus?.connectionStatus === "connected"
      ? "bg-success"
      : openclawStatus?.connectionStatus === "connecting"
        ? "bg-warning animate-pulse"
        : "bg-danger";

  const openclawLabel =
    openclawStatus?.connectionStatus === "connected"
      ? "Connected"
      : openclawStatus?.connectionStatus === "connecting"
        ? "Connecting"
        : openclawStatus?.connectionStatus === "not_configured"
          ? "Not Configured"
          : "Disconnected";

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${openclawColor}`} />
        <span className="text-gray-500 text-xs">OpenClaw: {openclawLabel}</span>
      </div>
    </div>
  );
}
