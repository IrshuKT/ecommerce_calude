"use client";
import { createContext, useContext, useEffect, useState } from "react";
import staffApi from "@/lib/staffApi";

interface PublicSettings {
  company_name: string;
  tagline: string;
  logo_url: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  gstin: string;
}

const defaults: PublicSettings = {
  company_name: "", tagline: "", logo_url: "",
  email: "", phone: "", city: "", state: "Kerala", gstin: "",
};

const PublicSettingsContext = createContext<PublicSettings>(defaults);

export function PublicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(defaults);

  useEffect(() => {
    staffApi.get("/settings/")
      .then(r => setSettings({ ...defaults, ...r.data }))
      .catch(() => {});
  }, []);

  return (
    <PublicSettingsContext.Provider value={settings}>
      {children}
    </PublicSettingsContext.Provider>
  );
}

export const usePublicSettings = () => useContext(PublicSettingsContext);