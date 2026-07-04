"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useStaffAuthStore } from "@/store/staffAuth";
import AdminSidebar from "@/components/admin/Sidebar";
import Spinner from "@/components/ui/Spinner";
import { SettingsProvider } from "../context/SettingsContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user: customerUser } = useAuthStore();
  const staffUser = useStaffAuthStore((s) => s.user);
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  const isStaffLoginRoute = pathname === "/admin/staff-login";

  // Existing customer-admin path is untouched — full access, no menu restriction.
  const isCustomerAdmin = customerUser?.role === "admin";
  // New staff path — role-restricted menus.
  const isInternalStaff = !!staffUser;

  useEffect(() => {
    if (!hydrated || isStaffLoginRoute) return;
    if (!customerUser && !isInternalStaff) router.replace("/staff-login");
    else if (customerUser && customerUser.role !== "admin") router.replace("/shop");
  }, [customerUser, isInternalStaff, router, hydrated, isStaffLoginRoute]);

  if (isStaffLoginRoute) return <>{children}</>;

  if (!hydrated || (!isCustomerAdmin && !isInternalStaff)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <SettingsProvider>
      <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
        <AdminSidebar />
        <main style={{ flex: 1, overflow: "auto" }}>
          {children}
        </main>
      </div>
    </SettingsProvider>
  );
}