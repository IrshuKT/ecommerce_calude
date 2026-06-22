#!/bin/bash
# ============================================================
# GlassStore — Next.js Frontend Setup
# Run INSIDE your existing ecommerce_calude folder:
#   cd ecommerce_calude
#   bash setup_frontend.sh
# ============================================================

set -e

echo "=========================================="
echo "  GlassStore Frontend Setup"
echo "=========================================="

# ── Init Next.js app ─────────────────────
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --yes
echo "✓ Next.js created"

# ── Install dependencies ─────────────────
npm install axios zustand react-hook-form zod @hookform/resolvers lucide-react
echo "✓ Dependencies installed"

# ── Environment ──────────────────────────
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
EOF

# ════════════════════════════════════════════
# TAILWIND CONFIG — clean minimal palette
# ════════════════════════════════════════════

cat > tailwind.config.ts << 'EOF'
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f9ff",
          100: "#e0f2fe",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted:   "#f8fafc",
          border:  "#e2e8f0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
EOF

# ════════════════════════════════════════════
# GLOBAL CSS
# ════════════════════════════════════════════

cat > app/globals.css << 'EOF'
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; }
  body {
    @apply bg-surface-muted text-slate-800 font-sans antialiased;
  }
  input, select, textarea {
    @apply outline-none;
  }
}

@layer components {
  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg
           bg-brand-600 text-white text-sm font-medium
           hover:bg-brand-700 active:scale-95
           transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .btn-outline {
    @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg
           border border-surface-border text-slate-700 text-sm font-medium
           hover:bg-slate-50 active:scale-95
           transition-all duration-150;
  }
  .input-field {
    @apply w-full px-3.5 py-2.5 rounded-lg border border-surface-border
           bg-white text-sm text-slate-800 placeholder:text-slate-400
           focus:border-brand-500 focus:ring-2 focus:ring-brand-100
           transition-all duration-150;
  }
  .card {
    @apply bg-white rounded-xl border border-surface-border shadow-sm;
  }
  .label {
    @apply block text-sm font-medium text-slate-700 mb-1.5;
  }
  .error-text {
    @apply text-xs text-red-500 mt-1;
  }
}
EOF

# ════════════════════════════════════════════
# LIB — API CLIENT
# ════════════════════════════════════════════

mkdir -p lib

cat > lib/api.ts << 'EOF'
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
EOF

# ════════════════════════════════════════════
# STORE — AUTH (Zustand)
# ════════════════════════════════════════════

mkdir -p store

cat > store/auth.ts << 'EOF'
import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "@/lib/api";

interface User {
  user_id: number;
  name: string;
  role: string;
  access_token: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      error: null,

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const form = new URLSearchParams();
          form.append("username", username);
          form.append("password", password);
          const res = await api.post("/auth/login", form, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          });
          const user = res.data;
          localStorage.setItem("access_token", user.access_token);
          set({ user, isLoading: false });
        } catch (err: any) {
          set({ error: err.response?.data?.detail || "Login failed", isLoading: false });
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post("/auth/register", data);
          const user = res.data;
          localStorage.setItem("access_token", user.access_token);
          set({ user, isLoading: false });
        } catch (err: any) {
          set({ error: err.response?.data?.detail || "Registration failed", isLoading: false });
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        set({ user: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-store",
      partialize: (state) => ({ user: state.user }),
    }
  )
);
EOF

# ════════════════════════════════════════════
# COMPONENTS — SHARED
# ════════════════════════════════════════════

mkdir -p components/ui

cat > components/ui/Logo.tsx << 'EOF'
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
          <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
          <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
          <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
        </svg>
      </div>
      <span className="text-lg font-semibold text-slate-800 tracking-tight">
        Glass<span className="text-brand-600">Store</span>
      </span>
    </div>
  );
}
EOF

cat > components/ui/Spinner.tsx << 'EOF'
export default function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-8 h-8" : "w-5 h-5";
  return (
    <svg className={`${s} animate-spin text-current`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}
EOF

cat > components/ui/Alert.tsx << 'EOF'
interface AlertProps {
  type?: "error" | "success" | "info";
  message: string;
  onClose?: () => void;
}

export default function Alert({ type = "error", message, onClose }: AlertProps) {
  const styles = {
    error:   "bg-red-50 border-red-200 text-red-700",
    success: "bg-green-50 border-green-200 text-green-700",
    info:    "bg-blue-50 border-blue-200 text-blue-700",
  };
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${styles[type]}`}>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
      )}
    </div>
  );
}
EOF

# ════════════════════════════════════════════
# AUTH LAYOUT
# ════════════════════════════════════════════

mkdir -p app/\(auth\)

cat > "app/(auth)/layout.tsx" << 'EOF'
import Logo from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-600 flex-col justify-between p-12">
        <Logo className="[&_span]:text-white [&_.text-brand-600]:text-white/80" />
        <div>
          <h1 className="text-4xl font-light text-white leading-snug mb-4">
            Quality glass<br/>
            <span className="font-semibold">delivered to you.</span>
          </h1>
          <p className="text-brand-100 text-lg leading-relaxed max-w-sm">
            Premium glass materials for homes, offices, and projects across India.
            GST invoices included with every order.
          </p>
        </div>
        <div className="flex gap-8 text-brand-100 text-sm">
          <span>🪟 500+ products</span>
          <span>📦 Pan India delivery</span>
          <span>🧾 GST compliant</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
EOF

# ════════════════════════════════════════════
# LOGIN PAGE
# ════════════════════════════════════════════

cat > "app/(auth)/login/page.tsx" << 'EOF'
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/store/auth";
import Alert from "@/components/ui/Alert";
import Spinner from "@/components/ui/Spinner";

const schema = z.object({
  username: z.string().min(1, "Email or phone is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isLoading, error, clearError } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (user) {
      router.replace(user.role === "admin" ? "/admin" : "/");
    }
  }, [user, router]);

  const onSubmit = async (data: FormData) => {
    await login(data.username, data.password);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-800">Welcome back</h2>
        <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
      </div>

      {error && (
        <div className="mb-5">
          <Alert message={error} onClose={clearError} />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Email or Phone</label>
          <input
            {...register("username")}
            className="input-field"
            placeholder="you@email.com or 9876543210"
            autoComplete="username"
          />
          {errors.username && <p className="error-text">{errors.username.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Password</label>
            <Link href="/forgot-password" className="text-xs text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            {...register("password")}
            type="password"
            className="input-field"
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {errors.password && <p className="error-text">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary w-full mt-2">
          {isLoading ? <><Spinner size="sm" /> Signing in...</> : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-brand-600 font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
EOF

# ════════════════════════════════════════════
# REGISTER PAGE
# ════════════════════════════════════════════

mkdir -p "app/(auth)/register"

cat > "app/(auth)/register/page.tsx" << 'EOF'
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/store/auth";
import Alert from "@/components/ui/Alert";
import Spinner from "@/components/ui/Spinner";

const schema = z.object({
  name:     z.string().min(2, "Name must be at least 2 characters"),
  email:    z.string().email("Enter a valid email"),
  phone:    z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm:  z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, user, isLoading, error, clearError } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const onSubmit = async (data: FormData) => {
    await registerUser({ name: data.name, email: data.email, phone: data.phone, password: data.password });
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-800">Create account</h2>
        <p className="text-slate-500 text-sm mt-1">Start shopping glass materials</p>
      </div>

      {error && (
        <div className="mb-5">
          <Alert message={error} onClose={clearError} />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input {...register("name")} className="input-field" placeholder="Irshad K T" />
          {errors.name && <p className="error-text">{errors.name.message}</p>}
        </div>

        <div>
          <label className="label">Email</label>
          <input {...register("email")} type="email" className="input-field" placeholder="you@email.com" />
          {errors.email && <p className="error-text">{errors.email.message}</p>}
        </div>

        <div>
          <label className="label">Mobile number</label>
          <div className="flex gap-2">
            <span className="input-field w-16 text-center text-slate-500 cursor-default">+91</span>
            <input {...register("phone")} className="input-field flex-1" placeholder="9876543210" maxLength={10} />
          </div>
          {errors.phone && <p className="error-text">{errors.phone.message}</p>}
        </div>

        <div>
          <label className="label">Password</label>
          <input {...register("password")} type="password" className="input-field" placeholder="Min. 6 characters" />
          {errors.password && <p className="error-text">{errors.password.message}</p>}
        </div>

        <div>
          <label className="label">Confirm password</label>
          <input {...register("confirm")} type="password" className="input-field" placeholder="Re-enter password" />
          {errors.confirm && <p className="error-text">{errors.confirm.message}</p>}
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary w-full mt-2">
          {isLoading ? <><Spinner size="sm" /> Creating account...</> : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 font-medium hover:underline">
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs text-slate-400 mt-4">
        By registering, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
EOF

# ════════════════════════════════════════════
# ROOT LAYOUT
# ════════════════════════════════════════════

cat > app/layout.tsx << 'EOF'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlassStore — Premium Glass Materials",
  description: "Buy quality glass materials online. GST invoices, pan India delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
EOF

# ════════════════════════════════════════════
# ROOT PAGE — redirect to login
# ════════════════════════════════════════════

cat > app/page.tsx << 'EOF'
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import Spinner from "@/components/ui/Spinner";

export default function RootPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      router.replace(user.role === "admin" ? "/admin" : "/shop");
    } else {
      router.replace("/login");
    }
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
EOF

echo "✓ All frontend files created"

# ════════════════════════════════════════════
# GIT PUSH
# ════════════════════════════════════════════

cd ..
git add .
git commit -m "feat: Next.js frontend — auth pages (login + register)"
git push origin main

echo ""
echo "=========================================="
echo "  ✅ Frontend pushed!"
echo ""
echo "  To run the frontend:"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo "  Open: http://localhost:3000/login"
echo "  Open: http://localhost:3000/register"
echo "=========================================="
