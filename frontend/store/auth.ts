import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "@/lib/api";
interface User { user_id: number; name: string; role: string; access_token: string; }
interface AuthState {
  user: User | null; isLoading: boolean; error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  logout: () => void; clearError: () => void;
}
export const useAuthStore = create<AuthState>()(persist((set) => ({
  user: null, isLoading: false, error: null,
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const form = new URLSearchParams();
      form.append("username", username); form.append("password", password);
      const res = await api.post("/auth/login", form, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      localStorage.setItem("access_token", res.data.access_token);
      set({ user: res.data, isLoading: false });
    } catch (err: any) { set({ error: err.response?.data?.detail || "Login failed", isLoading: false }); }
  },
  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post("/auth/register", data);
      localStorage.setItem("access_token", res.data.access_token);
      set({ user: res.data, isLoading: false });
    } catch (err: any) { set({ error: err.response?.data?.detail || "Registration failed", isLoading: false }); }
  },
  logout: () => { localStorage.removeItem("access_token"); set({ user: null }); },
  clearError: () => set({ error: null }),
}), { name: "auth-store", partialize: (s) => ({ user: s.user }) }));
