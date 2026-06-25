#!/bin/bash
# ============================================================
# GlassStore — Company Settings + Customer Account Pages
# Run from ecommerce_calude/
#   bash setup_account.sh
# ============================================================

set -e
echo "=========================================="
echo "  Company Settings + Account Pages"
echo "=========================================="

# ════════════════════════════════════════════
# 1. BACKEND — Company Settings Model
# ════════════════════════════════════════════

cd backend

cat >> app/models/models.py << 'PYEOF'


class CompanySettings(Base):
    __tablename__ = "company_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_name: Mapped[str] = mapped_column(String(200), default="GlassStore")
    tagline: Mapped[Optional[str]] = mapped_column(String(300))
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    email: Mapped[Optional[str]] = mapped_column(String(150))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    mobile: Mapped[Optional[str]] = mapped_column(String(20))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100), default="Kerala")
    state_code: Mapped[str] = mapped_column(String(5), default="32")
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    country: Mapped[str] = mapped_column(String(50), default="India")
    gstin: Mapped[Optional[str]] = mapped_column(String(20))
    pan: Mapped[Optional[str]] = mapped_column(String(12))
    bank_name: Mapped[Optional[str]] = mapped_column(String(100))
    bank_account_number: Mapped[Optional[str]] = mapped_column(String(30))
    bank_ifsc: Mapped[Optional[str]] = mapped_column(String(20))
    bank_branch: Mapped[Optional[str]] = mapped_column(String(100))
    invoice_prefix: Mapped[str] = mapped_column(String(10), default="INV")
    invoice_terms: Mapped[Optional[str]] = mapped_column(String(500))
    invoice_footer: Mapped[Optional[str]] = mapped_column(String(300))
    website: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
PYEOF

echo "✓ CompanySettings model added"

# ── Company Settings Endpoint ─────────────

cat > app/api/v1/endpoints/settings.py << 'PYEOF'
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import uuid

from app.db.session import get_db
from app.models.models import CompanySettings, User
from app.api.v1.endpoints.auth import get_admin_user, get_current_user

router = APIRouter()


async def get_or_create_settings(db: AsyncSession) -> CompanySettings:
    result = await db.execute(select(CompanySettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = CompanySettings()
        db.add(settings)
        await db.flush()
    return settings


@router.get("/")
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Public endpoint — returns company info for frontend."""
    settings = await get_or_create_settings(db)
    return {
        "company_name": settings.company_name,
        "tagline": settings.tagline,
        "logo_url": settings.logo_url,
        "email": settings.email,
        "phone": settings.phone,
        "mobile": settings.mobile,
        "address_line1": settings.address_line1,
        "address_line2": settings.address_line2,
        "city": settings.city,
        "state": settings.state,
        "state_code": settings.state_code,
        "pincode": settings.pincode,
        "country": settings.country,
        "gstin": settings.gstin,
        "website": settings.website,
        "invoice_terms": settings.invoice_terms,
        "invoice_footer": settings.invoice_footer,
        "bank_name": settings.bank_name,
        "bank_account_number": settings.bank_account_number,
        "bank_ifsc": settings.bank_ifsc,
        "bank_branch": settings.bank_branch,
    }


@router.patch("/")
async def update_settings(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    settings = await get_or_create_settings(db)
    allowed = {
        "company_name", "tagline", "email", "phone", "mobile",
        "address_line1", "address_line2", "city", "state", "state_code",
        "pincode", "country", "gstin", "pan", "bank_name",
        "bank_account_number", "bank_ifsc", "bank_branch",
        "invoice_prefix", "invoice_terms", "invoice_footer", "website",
    }
    for k, v in payload.items():
        if k in allowed:
            setattr(settings, k, v)
    return {"message": "Settings updated"}


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    from app.core.config import settings as app_settings
    ext = Path(file.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
        raise HTTPException(400, "Invalid file type")
    contents = await file.read()
    upload_dir = Path(app_settings.UPLOAD_DIR) / "company"
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"logo{ext}"
    with open(upload_dir / filename, "wb") as f:
        f.write(contents)
    url = f"/uploads/company/{filename}"
    settings = await get_or_create_settings(db)
    settings.logo_url = url
    return {"logo_url": url}
PYEOF

echo "✓ Settings endpoint created"

# ── Add to API router ─────────────────────

python << 'PYEOF'
path = "app/api/v1/__init__.py"
with open(path, "r") as f:
    content = f.read()

if "settings" not in content:
    old = "from app.api.v1.endpoints import ("
    new = "from app.api.v1.endpoints import (\n    settings,"
    content = content.replace(old, new)
    old = "router.include_router(images.router"
    new = "router.include_router(settings.router,     prefix=\"/settings\",        tags=[\"Company Settings\"])\nrouter.include_router(images.router"
    content = content.replace(old, new)
    with open(path, "w") as f:
        f.write(content)
    print("✓ Settings router added")
else:
    print("✓ Settings router already exists")
PYEOF

# ── Add profile update + password change to users.py ─────

cat >> app/api/v1/endpoints/users.py << 'PYEOF'


# ── Profile update ────────────────────────

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

@router.patch("/me/profile")
async def update_profile(
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.name: current_user.name = payload.name
    if payload.email: current_user.email = payload.email
    if payload.phone: current_user.phone = payload.phone
    return {"message": "Profile updated"}


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@router.patch("/me/password")
async def change_password(
    payload: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import bcrypt
    if not bcrypt.checkpw(payload.current_password.encode(), current_user.hashed_password.encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()
    return {"message": "Password changed successfully"}
PYEOF

echo "✓ Profile + password endpoints added"

# ── Alembic migration ─────────────────────

alembic revision --autogenerate -m "add_company_settings"
alembic upgrade head
echo "✓ Database migrated"

cd ..

# ════════════════════════════════════════════
# 2. FRONTEND — Company Settings Admin Page
# ════════════════════════════════════════════

cd frontend
mkdir -p "app/(admin)/admin/settings"
mkdir -p "app/(shop)/account/orders"
mkdir -p "app/(shop)/account/addresses"
mkdir -p "app/(shop)/account/invoices"

# ── Company Settings store ────────────────

cat > store/company.ts << 'EOF'
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
EOF

echo "✓ Company store created"

# ── Admin Settings Page ───────────────────

cat > "app/(admin)/admin/settings/page.tsx" << 'EOF'
"use client";
import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Bihar", code: "10" },
  { name: "Delhi", code: "07" }, { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" }, { name: "Haryana", code: "06" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" },
  { name: "Madhya Pradesh", code: "23" }, { name: "Maharashtra", code: "27" },
  { name: "Odisha", code: "21" }, { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" }, { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" }, { name: "Uttar Pradesh", code: "09" },
  { name: "West Bengal", code: "19" },
];

export default function SettingsPage() {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/settings/").then(r => { setForm(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/settings/", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); }
    finally { setSaving(false); }
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/settings/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm({ ...form, logo_url: res.data.logo_url });
    } catch { alert("Failed to upload logo"); }
    finally { setUploadingLogo(false); }
  };

  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 } as const;
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>;

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <PageHeader title="Company Settings" subtitle="Business information used in invoices, emails and shop frontend"
        action={
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Changes"}
          </button>
        }
      />

      {/* Logo */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Company Logo</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 100, height: 100, borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {form.logo_url
              ? <img src={`${API_BASE}${form.logo_url}`} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <span style={{ fontSize: 32 }}>🏢</span>}
          </div>
          <div>
            <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo} className="btn-outline">
              {uploadingLogo ? "Uploading..." : "Upload Logo"}
            </button>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 0" }}>PNG, JPG, SVG — Max 2MB. Recommended: 200×200px</p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Basic Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Company Name *</label>
            <input style={inp} value={form.company_name || ""} onChange={e => set("company_name", e.target.value)} placeholder="Your Company Name" />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Tagline</label>
            <input style={inp} value={form.tagline || ""} onChange={e => set("tagline", e.target.value)} placeholder="Premium glass materials for India" />
          </div>
          <div>
            <label style={lbl}>Email</label>
            <input style={inp} type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} placeholder="hello@company.in" />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input style={inp} value={form.phone || ""} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label style={lbl}>Mobile</label>
            <input style={inp} value={form.mobile || ""} onChange={e => set("mobile", e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label style={lbl}>Website</label>
            <input style={inp} value={form.website || ""} onChange={e => set("website", e.target.value)} placeholder="https://glassstore.in" />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Business Address</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Address Line 1</label>
            <input style={inp} value={form.address_line1 || ""} onChange={e => set("address_line1", e.target.value)} placeholder="Shop No, Street, Area" />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Address Line 2</label>
            <input style={inp} value={form.address_line2 || ""} onChange={e => set("address_line2", e.target.value)} placeholder="Landmark (optional)" />
          </div>
          <div>
            <label style={lbl}>City</label>
            <input style={inp} value={form.city || ""} onChange={e => set("city", e.target.value)} placeholder="Kochi" />
          </div>
          <div>
            <label style={lbl}>State</label>
            <select style={inp} value={form.state || "Kerala"} onChange={e => {
              const st = INDIAN_STATES.find(s => s.name === e.target.value);
              setForm((f: any) => ({ ...f, state: e.target.value, state_code: st?.code || f.state_code }));
            }}>
              {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Pincode</label>
            <input style={inp} value={form.pincode || ""} onChange={e => set("pincode", e.target.value)} placeholder="682001" maxLength={6} />
          </div>
          <div>
            <label style={lbl}>Country</label>
            <input style={inp} value={form.country || "India"} onChange={e => set("country", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tax Info */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Tax & Legal</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>GSTIN</label>
            <input style={inp} value={form.gstin || ""} onChange={e => set("gstin", e.target.value.toUpperCase())} placeholder="32XXXXX0000X1ZX" maxLength={15} />
          </div>
          <div>
            <label style={lbl}>PAN</label>
            <input style={inp} value={form.pan || ""} onChange={e => set("pan", e.target.value.toUpperCase())} placeholder="XXXXX0000X" maxLength={10} />
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Bank Details</h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Shown on invoices for bank transfer payments</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>Bank Name</label>
            <input style={inp} value={form.bank_name || ""} onChange={e => set("bank_name", e.target.value)} placeholder="State Bank of India" />
          </div>
          <div>
            <label style={lbl}>Account Number</label>
            <input style={inp} value={form.bank_account_number || ""} onChange={e => set("bank_account_number", e.target.value)} placeholder="XXXXXXXXXXXX" />
          </div>
          <div>
            <label style={lbl}>IFSC Code</label>
            <input style={inp} value={form.bank_ifsc || ""} onChange={e => set("bank_ifsc", e.target.value.toUpperCase())} placeholder="SBIN0000000" maxLength={11} />
          </div>
          <div>
            <label style={lbl}>Branch</label>
            <input style={inp} value={form.bank_branch || ""} onChange={e => set("bank_branch", e.target.value)} placeholder="MG Road, Kochi" />
          </div>
        </div>
      </div>

      {/* Invoice Settings */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Invoice Settings</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>Invoice Prefix</label>
            <input style={inp} value={form.invoice_prefix || "INV"} onChange={e => set("invoice_prefix", e.target.value.toUpperCase())} placeholder="INV" maxLength={10} />
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>e.g. INV → INV-2506-0001</p>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Payment Terms</label>
            <textarea style={{ ...inp, height: 70, resize: "vertical" as const }} value={form.invoice_terms || ""} onChange={e => set("invoice_terms", e.target.value)} placeholder="Payment due within 30 days. Late payments subject to 2% interest per month." />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Invoice Footer Note</label>
            <input style={inp} value={form.invoice_footer || ""} onChange={e => set("invoice_footer", e.target.value)} placeholder="Thank you for your business!" />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ minWidth: 140 }}>
          {saving ? "Saving..." : saved ? "✓ Saved!" : "Save All Changes"}
        </button>
      </div>
    </div>
  );
}
EOF

echo "✓ Admin settings page created"

# ── Add settings to sidebar ───────────────

python3 << 'PYEOF'
path = "components/admin/Sidebar.tsx"
with open(path, "r") as f:
    content = f.read()

old = '  { label: "Coupons",     href: "/admin/coupons",      icon: "🏷️" },'
new = '  { label: "Coupons",     href: "/admin/coupons",      icon: "🏷️" },\n  { label: "Settings",    href: "/admin/settings",     icon: "⚙️" },'

if "Settings" not in content:
    content = content.replace(old, new)
    with open(path, "w") as f:
        f.write(content)
    print("✓ Settings added to sidebar")
else:
    print("✓ Settings already in sidebar")
PYEOF

# ════════════════════════════════════════════
# 3. FRONTEND — Customer Account Pages
# ════════════════════════════════════════════

# ── Account Layout ────────────────────────

mkdir -p "app/(shop)/account"

cat > "app/(shop)/account/layout.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

const navItems = [
  { label: "Dashboard",  href: "/account",           icon: "▦" },
  { label: "My Orders",  href: "/account/orders",    icon: "📦" },
  { label: "Invoices",   href: "/account/invoices",  icon: "🧾" },
  { label: "Addresses",  href: "/account/addresses", icon: "📍" },
  { label: "Profile",    href: "/account/profile",   icon: "👤" },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user]);

  if (!hydrated || !user) return null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        {/* Sidebar */}
        <aside>
          {/* User card */}
          <div className="card" style={{ padding: 20, marginBottom: 16, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 22, fontWeight: 700, margin: "0 auto 10px" }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{user.name}</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px" }}>{user.role === "admin" ? "Administrator" : "Customer"}</p>
            {(user as any).is_trade_approved && (
              <span style={{ fontSize: 11, fontWeight: 700, background: "#d1fae5", color: "#065f46", padding: "3px 10px", borderRadius: 20 }}>
                ✓ Trade Account
              </span>
            )}
          </div>

          {/* Nav */}
          <div className="card" style={{ overflow: "hidden" }}>
            {navItems.map((item, i) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", fontSize: 14, textDecoration: "none",
                  borderBottom: i < navItems.length - 1 ? "1px solid #f1f5f9" : "none",
                  background: active ? "#eff6ff" : "white",
                  color: active ? "#0284c7" : "#475569",
                  fontWeight: active ? 500 : 400,
                }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
            <button onClick={() => { logout(); router.push("/login"); }} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "12px 16px", fontSize: 14, color: "#dc2626", background: "#fff5f5",
              border: "none", cursor: "pointer", borderTop: "1px solid #fee2e2",
            }}>
              <span>🚪</span> Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main>{children}</main>
      </div>
    </div>
  );
}
EOF

echo "✓ Account layout created"

# ── Account Dashboard ─────────────────────

cat > "app/(shop)/account/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

function StatCard({ label, value, icon, href }: any) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div className="card" style={{ padding: 20, transition: "all 0.15s" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#0284c7"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", margin: 0 }}>{value}</p>
          </div>
          <span style={{ fontSize: 28 }}>{icon}</span>
        </div>
      </div>
    </Link>
  );
}

export default function AccountDashboard() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/orders/").catch(() => ({ data: [] })),
      api.get("/invoices/my").catch(() => ({ data: [] })),
    ]).then(([o, i]) => {
      setOrders(Array.isArray(o.data) ? o.data : []);
      setInvoices(Array.isArray(i.data) ? i.data : []);
    }).finally(() => setLoading(false));
  }, []);

  const pendingOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length;
  const totalSpent = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>
          Welcome back, {user?.name?.split(" ")[0]}!
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>Here's a summary of your account.</p>
      </div>

      {/* Trade status banner */}
      {(user as any)?.is_trade_approved ? (
        <div style={{ padding: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#166534", margin: 0 }}>Trade Account Active</p>
            <p style={{ fontSize: 13, color: "#16a34a", margin: 0 }}>You are getting exclusive trade pricing on all products.</p>
          </div>
        </div>
      ) : (
        <div style={{ padding: 14, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>💼</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1d4ed8", margin: 0 }}>Upgrade to Trade Account</p>
              <p style={{ fontSize: 13, color: "#3b82f6", margin: 0 }}>Get exclusive pricing. Contact us to get approved.</p>
            </div>
          </div>
          <a href="mailto:hello@glassstore.in" style={{ fontSize: 13, color: "#0284c7", background: "white", padding: "6px 14px", borderRadius: 6, border: "1px solid #bfdbfe", textDecoration: "none", fontWeight: 500 }}>
            Contact Us
          </a>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Orders" value={loading ? "..." : orders.length} icon="📦" href="/account/orders" />
        <StatCard label="Active Orders" value={loading ? "..." : pendingOrders} icon="⏳" href="/account/orders" />
        <StatCard label="Total Spent" value={loading ? "..." : `₹${totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`} icon="💰" href="/account/orders" />
        <StatCard label="Invoices" value={loading ? "..." : invoices.length} icon="🧾" href="/account/invoices" />
      </div>

      {/* Recent orders */}
      <div className="card">
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Recent Orders</h2>
          <Link href="/account/orders" style={{ fontSize: 13, color: "#0284c7", textDecoration: "none" }}>View all →</Link>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <p style={{ color: "#64748b", marginBottom: 12 }}>No orders yet.</p>
            <Link href="/shop" style={{ color: "#0284c7", fontSize: 14 }}>Start Shopping →</Link>
          </div>
        ) : orders.slice(0, 5).map((order: any) => {
          const statusColors: Record<string, string> = { placed: "#854d0e", confirmed: "#1d4ed8", processing: "#6d28d9", shipped: "#065f46", delivered: "#166534", cancelled: "#991b1b" };
          const statusBg: Record<string, string> = { placed: "#fef9c3", confirmed: "#dbeafe", processing: "#ede9fe", shipped: "#d1fae5", delivered: "#dcfce7", cancelled: "#fee2e2" };
          return (
            <div key={order.id} style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{order.order_number}</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>₹{parseFloat(order.total_amount).toLocaleString("en-IN")}</span>
                <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20, background: statusBg[order.status] || "#f1f5f9", color: statusColors[order.status] || "#475569", textTransform: "capitalize" }}>
                  {order.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
EOF

echo "✓ Account dashboard created"

# ── My Orders Page ────────────────────────

cat > "app/(shop)/account/orders/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/orders/").then(r => setOrders(Array.isArray(r.data) ? r.data : [])).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);

  const statusColors: Record<string, { bg: string; color: string }> = {
    placed:     { bg: "#fef9c3", color: "#854d0e" },
    confirmed:  { bg: "#dbeafe", color: "#1d4ed8" },
    processing: { bg: "#ede9fe", color: "#6d28d9" },
    shipped:    { bg: "#d1fae5", color: "#065f46" },
    delivered:  { bg: "#dcfce7", color: "#166534" },
    cancelled:  { bg: "#fee2e2", color: "#991b1b" },
  };

  const STEPS = ["placed", "confirmed", "processing", "shipped", "delivered"];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "0 0 20px" }}>My Orders</h1>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <p style={{ color: "#64748b", marginBottom: 16 }}>No orders yet.</p>
          <Link href="/shop" style={{ padding: "10px 24px", background: "#0284c7", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 500 }}>Start Shopping</Link>
        </div>
      ) : orders.map((order: any) => {
        const c = statusColors[order.status] || { bg: "#f1f5f9", color: "#475569" };
        const stepIdx = STEPS.indexOf(order.status);

        return (
          <div key={order.id} className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
            {/* Order header */}
            <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{order.order_number}</span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 12 }}>
                  {new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>₹{parseFloat(order.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 12px", borderRadius: 20, background: c.bg, color: c.color, textTransform: "capitalize" }}>{order.status}</span>
              </div>
            </div>

            {/* Progress bar — only for active orders */}
            {!["cancelled", "refunded"].includes(order.status) && (
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {STEPS.map((step, i) => (
                    <div key={step} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700,
                          background: i <= stepIdx ? "#0284c7" : "#e2e8f0",
                          color: i <= stepIdx ? "white" : "#94a3b8",
                        }}>
                          {i < stepIdx ? "✓" : i + 1}
                        </div>
                        <span style={{ fontSize: 10, color: i <= stepIdx ? "#0284c7" : "#94a3b8", marginTop: 4, textTransform: "capitalize", whiteSpace: "nowrap" }}>{step}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: i < stepIdx ? "#0284c7" : "#e2e8f0", margin: "0 4px", marginBottom: 16 }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order details */}
            <div style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                <span style={{ marginRight: 16 }}>Payment: <strong style={{ textTransform: "uppercase" }}>{order.payment_method}</strong></span>
                <span>Status: <strong style={{ color: order.payment_status === "paid" ? "#16a34a" : "#d97706", textTransform: "capitalize" }}>{order.payment_status}</strong></span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/account/invoices?order=${order.order_number}`}
                  style={{ fontSize: 13, color: "#0284c7", textDecoration: "none", padding: "5px 12px", border: "1px solid #bfdbfe", borderRadius: 6, background: "#eff6ff" }}>
                  🧾 Invoice
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
EOF

echo "✓ My orders page created"

# ── My Invoices Page ──────────────────────

cat > "app/(shop)/account/invoices/page.tsx" << 'EOF'
"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";

function InvoicesContent() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    api.get("/invoices/my").then(r => setInvoices(Array.isArray(r.data) ? r.data : [])).catch(() => setInvoices([])).finally(() => setLoading(false));
  }, []);

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "0 0 20px" }}>My Invoices</h1>
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
          <p style={{ color: "#64748b" }}>No invoices yet. Place an order to get started.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                {["Invoice #", "Date", "Amount", "GST", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => {
                const statusColors: Record<string, { bg: string; color: string }> = {
                  confirmed:      { bg: "#dbeafe", color: "#1d4ed8" },
                  partially_paid: { bg: "#fef9c3", color: "#854d0e" },
                  paid:           { bg: "#dcfce7", color: "#166534" },
                  cancelled:      { bg: "#fee2e2", color: "#991b1b" },
                };
                const c = statusColors[inv.status] || { bg: "#f1f5f9", color: "#475569" };
                const totalTax = parseFloat(inv.cgst_amount || 0) + parseFloat(inv.sgst_amount || 0) + parseFloat(inv.igst_amount || 0);
                return (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0284c7" }}>{inv.invoice_number}</td>
                    <td style={{ padding: "12px 16px", color: "#475569" }}>{new Date(inv.invoice_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{fmt(inv.grand_total)}</td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{fmt(totalTax)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20, background: c.bg, color: c.color, textTransform: "capitalize" }}>
                        {inv.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/account/invoices/${inv.invoice_number}`}
                        style={{ fontSize: 13, color: "#0284c7", textDecoration: "none", padding: "5px 12px", border: "1px solid #bfdbfe", borderRadius: 6 }}>
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>Loading...</div>}><InvoicesContent /></Suspense>;
}
EOF

echo "✓ My invoices page created"

# ── Invoice detail for customer ───────────

mkdir -p "app/(shop)/account/invoices/[invoiceNumber]"

cat > "app/(shop)/account/invoices/[invoiceNumber]/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useCompanyStore } from "@/store/company";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

export default function CustomerInvoicePage() {
  const { invoiceNumber } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { settings, load: loadCompany } = useCompanyStore();

  useEffect(() => {
    loadCompany();
    if (invoiceNumber) {
      api.get(`/invoices/${invoiceNumber}`)
        .then(r => setInvoice(r.data))
        .catch(() => setInvoice(null))
        .finally(() => setLoading(false));
    }
  }, [invoiceNumber]);

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const company = settings || {};

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading invoice...</div>;
  if (!invoice) return <div style={{ padding: 40, textAlign: "center" }}>Invoice not found. <button onClick={() => router.back()} style={{ color: "#0284c7", background: "none", border: "none", cursor: "pointer" }}>Go back</button></div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, justifyContent: "space-between" }} className="no-print">
        <button onClick={() => router.back()} style={{ fontSize: 13, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>← Back</button>
        <button onClick={() => window.print()} className="btn-outline">🖨️ Print / Download</button>
      </div>

      <div className="card" style={{ padding: 40 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            {company.logo_url && <img src={`${API_BASE}${company.logo_url}`} alt="Logo" style={{ height: 50, marginBottom: 8, objectFit: "contain" }} />}
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>{company.company_name || "GlassStore"}</h2>
            {company.address_line1 && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{company.address_line1}</p>}
            {company.city && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{company.city}, {company.state} — {company.pincode}</p>}
            {company.gstin && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>GSTIN: {company.gstin}</p>}
            {company.phone && <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>📞 {company.phone}</p>}
          </div>
          <div style={{ textAlign: "right" }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0284c7", margin: "0 0 8px" }}>TAX INVOICE</h1>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 4px" }}>#{invoice.invoice_number}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>
              {new Date(invoice.invoice_date).toLocaleDateString("en-IN", { dateStyle: "long" })}
            </p>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 4,
              background: invoice.status === "paid" ? "#dcfce7" : "#fef9c3",
              color: invoice.status === "paid" ? "#166534" : "#854d0e", textTransform: "capitalize" }}>
              {invoice.status.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Bill To */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28, padding: 16, background: "#f8fafc", borderRadius: 8 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Bill To</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{invoice.billing_name}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{invoice.billing_line1}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{invoice.billing_city}, {invoice.billing_state} — {invoice.billing_pincode}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>📞 {invoice.billing_phone}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>GST Info</p>
            <p style={{ fontSize: 13, color: "#475569", margin: "0 0 4px" }}>Type: <strong>{invoice.is_interstate ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}</strong></p>
            {invoice.customer_gstin && <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>GSTIN: <strong>{invoice.customer_gstin}</strong></p>}
          </div>
        </div>

        {/* Items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1e293b", color: "white" }}>
              {["#", "Product", "HSN", "Qty", "Rate", "Taxable", "GST", "Total"].map(h => (
                <th key={h} style={{ padding: "10px", textAlign: "left", fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item: any, i: number) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                <td style={{ padding: "10px" }}>{i + 1}</td>
                <td style={{ padding: "10px", fontWeight: 500 }}>{item.product_name}</td>
                <td style={{ padding: "10px", color: "#64748b" }}>{item.hsn_code || "—"}</td>
                <td style={{ padding: "10px" }}>{parseFloat(item.quantity).toFixed(2)} {item.unit}</td>
                <td style={{ padding: "10px" }}>{fmt(item.unit_price)}</td>
                <td style={{ padding: "10px" }}>{fmt(item.taxable_amount)}</td>
                <td style={{ padding: "10px" }}>{invoice.is_interstate ? `${item.igst_rate}% IGST` : `${item.cgst_rate}%+${item.sgst_rate}%`}</td>
                <td style={{ padding: "10px", fontWeight: 600 }}>{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <div style={{ width: 280 }}>
            {[
              { label: "Subtotal", value: fmt(invoice.subtotal) },
              ...(parseFloat(invoice.discount_amount) > 0 ? [{ label: "Discount", value: `−${fmt(invoice.discount_amount)}` }] : []),
              { label: "Taxable Amount", value: fmt(invoice.taxable_amount) },
              ...(parseFloat(invoice.cgst_amount) > 0 ? [{ label: "CGST", value: fmt(invoice.cgst_amount) }] : []),
              ...(parseFloat(invoice.sgst_amount) > 0 ? [{ label: "SGST", value: fmt(invoice.sgst_amount) }] : []),
              ...(parseFloat(invoice.igst_amount) > 0 ? [{ label: "IGST", value: fmt(invoice.igst_amount) }] : []),
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#475569", borderBottom: "1px solid #f1f5f9" }}>
                <span>{r.label}</span><span>{r.value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 17, fontWeight: 700, color: "#1e293b", borderTop: "2px solid #1e293b", marginTop: 4 }}>
              <span>Grand Total</span><span>{fmt(invoice.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* Bank details */}
        {company.bank_name && (
          <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            <p style={{ fontWeight: 600, color: "#475569", margin: "0 0 6px" }}>Bank Details</p>
            <p style={{ color: "#64748b", margin: "0 0 2px" }}>Bank: {company.bank_name} | A/C: {company.bank_account_number}</p>
            <p style={{ color: "#64748b", margin: 0 }}>IFSC: {company.bank_ifsc} | Branch: {company.bank_branch}</p>
          </div>
        )}

        {/* Terms */}
        {company.invoice_terms && (
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px" }}><strong>Terms:</strong> {company.invoice_terms}</p>
        )}
        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, textAlign: "center" }}>
          {company.invoice_footer || "Thank you for your business!"}
        </p>
      </div>

      <style>{`@media print { .no-print { display: none !important; } body { background: white; } .card { box-shadow: none; border: none; } }`}</style>
    </div>
  );
}
EOF

echo "✓ Customer invoice page created"

# ── Addresses Page ────────────────────────

cat > "app/(shop)/account/addresses/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Bihar", code: "10" },
  { name: "Delhi", code: "07" }, { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" }, { name: "Haryana", code: "06" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" },
  { name: "Madhya Pradesh", code: "23" }, { name: "Maharashtra", code: "27" },
  { name: "Odisha", code: "21" }, { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" }, { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" }, { name: "Uttar Pradesh", code: "09" },
  { name: "West Bengal", code: "19" },
];

const emptyForm = { label: "Home", full_name: "", phone: "", line1: "", line2: "", city: "", state: "Kerala", state_code: "32", pincode: "", is_default: false };

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get("/users/addresses"); setAddresses(res.data || []); }
    catch { setAddresses([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.full_name || !form.phone || !form.line1 || !form.city || !form.pincode) {
      alert("Please fill all required fields"); return;
    }
    setSaving(true);
    try { await api.post("/users/addresses", form); setShowForm(false); setForm({ ...emptyForm }); load(); }
    catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteAddr = async (id: number) => {
    if (!confirm("Delete this address?")) return;
    setDeleting(id);
    try { await api.delete(`/users/addresses/${id}`); load(); }
    catch { alert("Failed to delete"); } finally { setDeleting(null); }
  };

  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 } as const;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Saved Addresses</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ Add Address</button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>New Address</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Label</label>
              <select style={inp} value={form.label} onChange={e => set("label", e.target.value)}>
                {["Home", "Office", "Other"].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Full Name *</label>
              <input style={inp} value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label style={lbl}>Phone *</label>
              <input style={inp} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="10-digit mobile" maxLength={10} />
            </div>
            <div>
              <label style={lbl}>Pincode *</label>
              <input style={inp} value={form.pincode} onChange={e => set("pincode", e.target.value)} placeholder="6-digit pincode" maxLength={6} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>Address Line 1 *</label>
              <input style={inp} value={form.line1} onChange={e => set("line1", e.target.value)} placeholder="House no, Street, Area" />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>Landmark</label>
              <input style={inp} value={form.line2} onChange={e => set("line2", e.target.value)} placeholder="Optional landmark" />
            </div>
            <div>
              <label style={lbl}>City *</label>
              <input style={inp} value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" />
            </div>
            <div>
              <label style={lbl}>State *</label>
              <select style={inp} value={form.state} onChange={e => {
                const st = INDIAN_STATES.find(s => s.name === e.target.value);
                setForm(f => ({ ...f, state: e.target.value, state_code: st?.code || f.state_code }));
              }}>
                {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="default" checked={form.is_default} onChange={e => set("is_default", e.target.checked)} style={{ width: 16, height: 16 }} />
              <label htmlFor="default" style={{ fontSize: 14, color: "#475569", cursor: "pointer" }}>Set as default address</label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Address"}</button>
            <button onClick={() => { setShowForm(false); setForm({ ...emptyForm }); }} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Address list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading...</div>
      ) : addresses.length === 0 && !showForm ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📍</div>
          <p style={{ color: "#64748b", marginBottom: 12 }}>No saved addresses yet.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">Add Your First Address</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {addresses.map(addr => (
            <div key={addr.id} className="card" style={{ padding: 20, position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, color: "#475569" }}>{addr.label}</span>
                  {addr.is_default && <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "1px 6px", borderRadius: 3, fontWeight: 500 }}>Default</span>}
                </div>
                <button onClick={() => deleteAddr(addr.id)} disabled={deleting === addr.id}
                  style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>
                  {deleting === addr.id ? "..." : "Delete"}
                </button>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{addr.full_name}</p>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{addr.city}, {addr.state} — {addr.pincode}</p>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>📞 {addr.phone}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
EOF

echo "✓ Addresses page created"

# ── Profile Page ──────────────────────────

mkdir -p "app/(shop)/account/profile"

cat > "app/(shop)/account/profile/page.tsx" << 'EOF'
"use client";
import { useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [form, setForm] = useState({ name: user?.name || "", email: (user as any)?.email || "", phone: (user as any)?.phone || "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 } as const;

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch("/users/me/profile", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to update"); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) { setPwMsg({ type: "error", text: "Passwords do not match" }); return; }
    if (pwForm.new_password.length < 6) { setPwMsg({ type: "error", text: "Password must be at least 6 characters" }); return; }
    setChangingPw(true);
    try {
      await api.patch("/users/me/password", { current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwMsg({ type: "success", text: "Password changed successfully!" });
      setPwForm({ current_password: "", new_password: "", confirm: "" });
    } catch (e: any) { setPwMsg({ type: "error", text: e.response?.data?.detail || "Failed to change password" }); }
    finally { setChangingPw(false); }
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "0 0 20px" }}>My Profile</h1>

      {/* Trade status */}
      <div style={{ padding: 14, borderRadius: 8, marginBottom: 20, border: "1px solid", borderColor: (user as any)?.is_trade_approved ? "#bbf7d0" : "#e2e8f0", background: (user as any)?.is_trade_approved ? "#f0fdf4" : "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{(user as any)?.is_trade_approved ? "✅" : "👤"}</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: (user as any)?.is_trade_approved ? "#166534" : "#475569", margin: 0 }}>
              {(user as any)?.is_trade_approved ? "Trade Account — You get exclusive pricing" : "Regular Customer Account"}
            </p>
            {!(user as any)?.is_trade_approved && (
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Contact us to upgrade to a trade account and get better prices.</p>
            )}
          </div>
        </div>
      </div>

      {/* Profile form */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Personal Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Full Name</label>
            <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Email</label>
            <input style={inp} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input style={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} maxLength={10} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={saveProfile} disabled={saving} className="btn-primary">
            {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Password change */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Change Password</h2>
        {pwMsg && (
          <div style={{ padding: "10px 14px", borderRadius: 7, marginBottom: 14, fontSize: 13, background: pwMsg.type === "success" ? "#f0fdf4" : "#fef2f2", color: pwMsg.type === "success" ? "#16a34a" : "#dc2626", border: `1px solid ${pwMsg.type === "success" ? "#bbf7d0" : "#fecaca"}` }}>
            {pwMsg.text}
          </div>
        )}
        <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
          <div>
            <label style={lbl}>Current Password</label>
            <input style={inp} type="password" value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} placeholder="••••••••" />
          </div>
          <div>
            <label style={lbl}>New Password</label>
            <input style={inp} type="password" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="Min. 6 characters" />
          </div>
          <div>
            <label style={lbl}>Confirm New Password</label>
            <input style={inp} type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="Re-enter new password" />
          </div>
          <button onClick={changePassword} disabled={changingPw} className="btn-primary" style={{ width: "fit-content" }}>
            {changingPw ? "Changing..." : "Change Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
EOF

echo "✓ Profile page created"

# ════════════════════════════════════════════
# GIT PUSH
# ════════════════════════════════════════════

cd ..
git add .
git commit -m "feat: company settings + customer account (dashboard, orders, invoices, addresses, profile)"
git push origin main

echo ""
echo "=========================================="
echo "  ✅ Done!"
echo ""
echo "  Admin:"
echo "  /admin/settings     — Company info, logo, bank, GST"
echo ""
echo "  Customer:"
echo "  /account            — Dashboard"
echo "  /account/orders     — Order history + tracking"
echo "  /account/invoices   — GST invoices with print"
echo "  /account/addresses  — Saved addresses"
echo "  /account/profile    — Profile + password change"
echo "=========================================="