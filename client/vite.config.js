import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const PRODUCTION_SERVER_URL = "https://chat-mz3s.onrender.com";

export default defineConfig(({ mode }) => {
  // Load env so we can read VITE_SERVER_URL at config time
  const env = loadEnv(mode, process.cwd(), "");

  // Backend URL used by the Vite dev proxy.
  // Keep this aligned with client/src/utils/constants.js for deployed builds.
  const backendUrl = (env.VITE_SERVER_URL || PRODUCTION_SERVER_URL).replace(/\/+$/, "");

  return {
    plugins: [react()],

    server: {
      // Bind to all interfaces so the dev server is reachable from:
      //   - localhost (same machine)
      //   - local network IP (mobile on same Wi-Fi)
      //   - VS Code forwarded ports
      host: true,   // equivalent to --host 0.0.0.0
      port: 3000,
      strictPort: true,

      // Proxy API, uploads, and Socket.IO to the backend.
      // Uses the backendUrl so it works with network IPs and forwarded ports.
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        "/uploads": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          ws: true,   // proxy WebSocket upgrades
        },
      },
    },

    build: {
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            socket: ["socket.io-client"],
            ui:     ["react-icons", "react-toastify"],
            emoji:  ["emoji-picker-react"],
          },
        },
      },
    },
  };
});
