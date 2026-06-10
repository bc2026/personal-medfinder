import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    watch: process.env.CHOKIDAR_USEPOLLING
      ? {
          usePolling: true,
          interval: 1000,
          ignored: ["**/node_modules/**", "**/.git/**"],
        }
      : undefined,
    proxy: {
      "/api": apiTarget,
      "/health": apiTarget,
    },
  },
});
