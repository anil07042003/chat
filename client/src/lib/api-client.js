import axios from "axios";
import { HOST } from "../utils/constants";

// HOST points to the deployed Render backend unless VITE_SERVER_URL overrides it.
// Credentials stay enabled so auth cookies/sessions continue to flow cross-origin.
export const apiClient = axios.create({
  baseURL: HOST,
  withCredentials: true,
  timeout: 30000,
});

// Request interceptor — pass through unchanged
apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response interceptor — redirect to /auth on 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }
    }
    return Promise.reject(error);
  }
);
