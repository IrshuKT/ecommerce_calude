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
  name: z.string().min(2, "Min. 2 characters"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  password: z.string().min(6, "Min. 6 characters"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });
type F = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: reg, user, isLoading, error, clearError } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema) });
  useEffect(() => { if (user) router.replace("/shop"); }, [user, router]);
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "#1e293b", margin: 0 }}>Create account</h2>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>Start shopping glass materials</p>
      </div>
      {error && <div style={{ marginBottom: 20 }}><Alert message={error} onClose={clearError} /></div>}
      <form onSubmit={handleSubmit((d) => reg({ name: d.name, email: d.email, phone: d.phone, password: d.password }))} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="label">Full name</label>
          <input {...register("name")} className="input-field" placeholder="Your full name" />
          {errors.name && <p className="error-text">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Email</label>
          <input {...register("email")} type="email" className="input-field" placeholder="you@email.com" />
          {errors.email && <p className="error-text">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Mobile number</label>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="input-field" style={{ width: 60, textAlign: "center", color: "#94a3b8", cursor: "default" }}>+91</span>
            <input {...register("phone")} className="input-field" placeholder="9876543210" maxLength={10} style={{ flex: 1 }} />
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
        <button type="submit" disabled={isLoading} className="btn-primary" style={{ marginTop: 8 }}>
          {isLoading ? <><Spinner size="sm" /> Creating account...</> : "Create account"}
        </button>
      </form>
      <p style={{ textAlign: "center", fontSize: 14, color: "#64748b", marginTop: 24 }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#0284c7", fontWeight: 500 }}>Sign in</Link>
      </p>
    </div>
  );
}
