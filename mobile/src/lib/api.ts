import axios from "axios";
import { Platform } from "react-native";

let currentToken: string | null = null;
let currentLanguage = "en";

export function setApiToken(token: string | null) {
  currentToken = token;
}

export function setApiLanguage(language: string) {
  currentLanguage = language;
}

function getApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  if (__DEV__ && Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }

  return "http://127.0.0.1:8000";
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const headers = config.headers ?? {};

  headers["Accept-Language"] = currentLanguage;

  if (currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  }

  config.headers = headers;
  return config;
});
