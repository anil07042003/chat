import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load env so we can read VITE_SERVER_URL at config time
  const env = loadEnv(mode, process.cwd(), "");

  // The backend URL — defaults to localhost:3001 for local dev.
  // Override with VITE_SERVER_URL in .env when using a network IP or
  // VS Code forwarded port (e.g. VITE_SERVER_URL=http://192.168.1.5:3001)
  const backendUrl = env.VITE_SERVER_URL || "http://localhost:3001";

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
