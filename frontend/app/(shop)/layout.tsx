import Navbar from "@/components/shop/Navbar";
import Footer from "@/components/shop/Footer";
import { PublicSettingsProvider } from "../context/PublicSettingsContext";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicSettingsProvider>
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </div>
   
    </PublicSettingsProvider>
  );
}
