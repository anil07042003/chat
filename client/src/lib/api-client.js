import axios from "axios";
import { HOST } from "../utils/constants";

// When HOST is "/" (proxy mode) or an absolute URL, axios handles both correctly.
// baseURL "/" means all requests go to the same origin and the Vite proxy
// forwards /api/* to the backend.
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
