import axios from "axios";
import { auth } from "./auth";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000",
  headers: { Accept: "application/json" },
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
});

api.interceptors.request.use((config) => {
  const token = auth.getToken();

  config.headers = config.headers ?? {};
  config.headers["Accept-Language"] = "en";

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
