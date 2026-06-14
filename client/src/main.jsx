import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { SocketProvider } from "./context/SocketContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// NOTE: StrictMode is intentionally removed here.
// React StrictMode invokes effects twice in development (mount → cleanup → mount),
// which breaks WebRTC peer connections — the first PC gets created and destroyed
// before signaling completes, causing calls to never connect.
createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <SettingsProvider>
      <SocketProvider>
        <App />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          toastClassName="baatchit-toast"
        />
      </SocketProvider>
    </SettingsProvider>
  </ThemeProvider>
);
