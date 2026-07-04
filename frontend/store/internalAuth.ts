import { create } from "zustand";

export interface InternalUser {
  id: number;
  name: string;
  role: "admin" | "manager" | "sales" | "inventory";
}

interface InternalAuthState {
  token: string | null;
  user: InternalUser | null;
  menus: string[];
  setSession: (token: string, user: InternalUser, menus: string[]) => void;
  logout: () => void;
}

const STORAGE_KEY = "internal-auth-storage";

// Synchronous read on module load — no async rehydration race.
function loadFromStorage(): { token: string | null; user: InternalUser | null; menus: string[] } {
  if (typeof window === "undefined") return { token: null, user: null, menus: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null, menus: [] };
    const parsed = JSON.parse(raw);
    return {
      token: parsed.token ?? null,
      user: parsed.user ?? null,
      menus: parsed.menus ?? [],
    };
  } catch {
    return { token: null, user: null, menus: [] };
  }
}

function saveToStorage(state: { token: string | null; user: InternalUser | null; menus: string[] }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore write failures (private browsing, quota, etc.)
  }
}

export const useInternalAuthStore = create<InternalAuthState>()((set) => ({
  ...loadFromStorage(),
  setSession: (token, user, menus) => {
    saveToStorage({ token, user, menus });
    set({ token, user, menus });
  },
  logout: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    set({ token: null, user: null, menus: [] });
  },
}));