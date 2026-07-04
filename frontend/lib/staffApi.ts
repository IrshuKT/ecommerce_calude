import axios from "axios";
import { useStaffAuthStore } from "@/store/staffAuth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const staffApi = axios.create({ baseURL: BASE_URL });

staffApi.interceptors.request.use((config) => {
  const token = useStaffAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default staffApi;