import { create } from "zustand";
import api from "@/lib/api";

interface CompanyState {
  settings: any;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  settings: null,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const res = await api.get("/settings/");
      set({ settings: res.data, loaded: true });
    } catch { }
  },
}));
