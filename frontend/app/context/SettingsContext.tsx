"use client";
import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

interface Settings {
  company_name: string;
  tagline: string;
  logo_url: string;
  email: string;
  phone: string;
  mobile: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  country: string;
  gstin: string;
  pan: string;
  website: string;
  invoice_terms: string;
  invoice_footer: string;
  invoice_prefix: string;
  bank_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_branch: string;
}

const defaultSettings: Settings = {
  company_name: "", tagline: "", logo_url: "", email: "", phone: "",
  mobile: "", address_line1: "", address_line2: "", city: "", state: "Kerala",
  state_code: "32", pincode: "", country: "India", gstin: "", pan: "",
  website: "", invoice_terms: "", invoice_footer: "", invoice_prefix: "INV",
  bank_name: "", bank_account_number: "", bank_ifsc: "", bank_branch: "",
};

const SettingsContext = createContext<Settings>(defaultSettings);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    api.get("/settings/")
      .then(r => setSettings({ ...defaultSettings, ...r.data }))
      .catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);