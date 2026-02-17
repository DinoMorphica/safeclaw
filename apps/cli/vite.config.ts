import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "web"),
  publicDir: path.resolve(__dirname, "web", "static"),
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:54335",
        ws: true,
      },
      "/api": {
        target: "http://localhost:54335",
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "public"),
    emptyOutDir: true,
    sourcemap: false,
  },
});
