import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Moon, Eye, EyeOff, ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function Login() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) navigate("/admin/dashboard");
  }, [ready, user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Login berhasil. Selamat datang!");
      navigate("/admin/dashboard");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex islamic-pattern items-center justify-center p-12">
        <div className="absolute inset-0 bg-emerald-950/70" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-white max-w-md"
        >
          <div className="h-14 w-14 rounded-2xl bg-gold flex items-center justify-center mb-8">
            <Moon className="h-7 w-7 text-emerald-900" />
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Portal Admin Majelis Raudhatul Jannah
          </h1>
          <p className="text-white/75 mt-5 leading-relaxed">
            Kelola data cabang, jamaah, agenda, dan dokumentasi majelis dalam
            satu sistem terpadu yang aman.
          </p>
          <div className="mt-8 flex items-center gap-3 text-white/70 text-sm">
            <ShieldCheck className="h-5 w-5 text-gold" /> Akses terlindungi
            dengan otentikasi berbasis peran.
          </div>
        </motion.div>
      </div>

      <div className="flex items-center justify-center p-6 bg-[#FAFAFA]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-8"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke situs publik
          </Link>
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl bg-emerald-brand flex items-center justify-center">
              <Moon className="h-6 w-6 text-gold" />
            </div>
            <p className="font-display font-bold text-charcoal text-lg">
              Raudhatul Jannah
            </p>
          </div>
          <h2 className="font-display text-3xl font-bold text-charcoal">
            Masuk Portal Admin
          </h2>
          <p className="text-muted-foreground mt-2">
            Silakan masuk menggunakan akun admin Anda.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <Label className="mb-1.5 block">Email atau Username</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@raudhatuljannah.id"
                className="rounded-xl h-12"
                data-testid="login-email"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Kata Sandi</Label>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-xl h-12 pr-11"
                  data-testid="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {show ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl h-12"
              data-testid="login-submit"
            >
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>

          <div className="mt-8 rounded-xl bg-secondary/60 p-4 text-sm">
            <p className="font-semibold text-charcoal mb-1">Akun Demo</p>
            <p className="text-muted-foreground">
              Super Admin: admin@raudhatuljannah.id / Admin@2026
              <br />
              Admin Cabang: cabang@raudhatuljannah.id / Cabang@2026
              <br />
              Viewer: viewer@raudhatuljannah.id / Viewer@2026
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
