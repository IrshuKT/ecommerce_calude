import { create } from "zustand";
import staffApi from "@/lib/staffApi";

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
      const res = await staffApi.get("/settings/");
      set({ settings: res.data, loaded: true });
    } catch { }
  },
}));
