import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@safeclaw/shared";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const URL = import.meta.env.DEV ? "" : window.location.origin;

export const socket: TypedSocket = io(URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
});
