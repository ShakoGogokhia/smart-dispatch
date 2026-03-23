export const auth = {
  getToken(): string | null {
    return localStorage.getItem("token");
  },
  setToken(token: string) {
    localStorage.setItem("token", token);
  },
  clearToken() {
    localStorage.removeItem("token");
  },
  clear() {
    localStorage.removeItem("token");
  },
};
