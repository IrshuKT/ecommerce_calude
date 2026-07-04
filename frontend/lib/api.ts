import axios from "axios";
const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL, headers: { "Content-Type": "application/json" } });
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
api.interceptors.response.use((res) => res, (err) => {
  if (err.response?.status === 401 && typeof window !== "undefined") {
    // If a staff session is active, this 401 just means "this endpoint doesn't
    // accept staff tokens yet" — not "you're logged out". Don't force-redirect.
    const hasStaffSession = !!localStorage.getItem("staff-auth-storage");
    if (!hasStaffSession) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
  }
  return Promise.reject(err);
});
export default api;