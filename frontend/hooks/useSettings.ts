// /frontend/hooks/useSettings.ts
import { useEffect, useState } from "react";
import staffApi from "@/lib/staffApi";

let cachedSettings: any = null;  // simple in-memory cache

export function useSettings() {
  const [settings, setSettings] = useState<any>(cachedSettings);

  useEffect(() => {
    if (cachedSettings) { setSettings(cachedSettings); return; }
    staffApi.get("/settings/").then(r => {
      cachedSettings = r.data;
      setSettings(r.data);
    }).catch(() => {});
  }, []);

  return settings;
}