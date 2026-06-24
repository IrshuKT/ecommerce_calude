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

const schema = z.object({ username: z.string().min(1, "Email or phone is required"), password: z.string().min(6, "Min. 6 characters") });
type F = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isLoading, error, clearError } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema) });
  useEffect(() => { if (user) router.replace(user.role === "admin" ? "/admin" : "/shop"); }, [user, router]);
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "#1e293b", margin: 0 }}>Welcome back</h2>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>Sign in to your account</p>
      </div>
      {error && <div style={{ marginBottom: 20 }}><Alert message={error} onClose={clearError} /></div>}
      <Link
  href="/"
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "#64748b",
    textDecoration: "none",
    marginBottom: 24,
    fontSize: 14,
  }}
>
  ← Back to Home
</Link>
      <form onSubmit={handleSubmit((d) => login(d.username, d.password))} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="label">Email or Phone</label>
          <input {...register("username")} className="input-field" placeholder="you@email.com or 9876543210" />
          {errors.username && <p className="error-text">{errors.username.message}</p>}
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label className="label" style={{ marginBottom: 0 }}>Password</label>
            <Link href="/forgot-password" style={{ fontSize: 12, color: "#0284c7" }}>Forgot password?</Link>
          </div>
          <input {...register("password")} type="password" className="input-field" placeholder="••••••••" />
          {errors.password && <p className="error-text">{errors.password.message}</p>}
        </div>
        <button type="submit" disabled={isLoading} className="btn-primary" style={{ marginTop: 8 }}>
          {isLoading ? <><Spinner size="sm" /> Signing in...</> : "Sign in"}
        </button>
      </form>
      <p style={{ textAlign: "center", fontSize: 14, color: "#64748b", marginTop: 24 }}>
        Don&apos;t have an account?{" "}
        <Link href="/register" style={{ color: "#0284c7", fontWeight: 500 }}>Create one</Link>
      </p>
    </div>
  );
}
