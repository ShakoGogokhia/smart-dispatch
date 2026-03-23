import axios from "axios";
import { auth } from "./auth";

const LANGUAGE_STORAGE_KEY = "smart-dispatch-language";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000",
  headers: { Accept: "application/json" },
});

api.interceptors.request.use((config) => {
  const token = auth.getToken();
  const language = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "en";

  config.headers = config.headers ?? {};
  config.headers["Accept-Language"] = language;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
