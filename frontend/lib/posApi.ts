import axios from "axios";
import { useAuthStore } from "@/store/auth";
import { useStaffAuthStore } from "@/store/staffAuth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Used for routes accessible by BOTH the legacy customer-admin login
// and internal staff (admin/manager/sales) logins — e.g. /pos/*.
// Prefers the staff token if present, falls back to the customer token.
const posApi = axios.create({ baseURL: BASE_URL });

posApi.interceptors.request.use((config) => {
  const staffToken = useStaffAuthStore.getState().token;
  const customerToken = useAuthStore.getState().user?.access_token;
  const token = staffToken || customerToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default posApi;