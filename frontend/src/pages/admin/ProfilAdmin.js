import React, { useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Save, Lock, ShieldCheck } from "lucide-react";

const ROLE_LABEL = { super_admin: "Super Admin", admin_cabang: "Admin Cabang", viewer: "Viewer" };

export default function ProfilAdmin() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || "", username: user?.username || "", avatar: user?.avatar || "" });
  const [pw, setPw] = useState({ old_password: "", new_password: "", confirm: "" });
  const [s1, setS1] = useState(false);
  const [s2, setS2] = useState(false);

  const saveProfile = async () => {
    setS1(true);
    try {
      const { data } = await api.put("/auth/profile", profile);
      setUser(data);
      toast.success("Profil diperbarui");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setS1(false); }
  };

  const changePw = async () => {
    if (!pw.old_password || !pw.new_password) { toast.error("Lengkapi kata sandi"); return; }
    if (pw.new_password !== pw.confirm) { toast.error("Konfirmasi kata sandi tidak cocok"); return; }
    setS2(true);
    try {
      await api.put("/auth/password", { old_password: pw.old_password, new_password: pw.new_password });
      toast.success("Kata sandi berhasil diubah");
      setPw({ old_password: "", new_password: "", confirm: "" });
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setS2(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><User className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold font-display text-charcoal">Profil Admin</h1>
          <p className="text-sm text-muted-foreground">Kelola profil & keamanan akun Anda</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="premium-card p-8 text-center h-fit">
          <Avatar className="h-24 w-24 mx-auto">
            {profile.avatar && <AvatarImage src={profile.avatar} />}
            <AvatarFallback className="bg-gold text-emerald-900 text-2xl font-display font-bold">
              {(user?.name || user?.username || "A").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h3 className="font-display text-xl font-bold text-charcoal mt-4">{user?.name || user?.username}</h3>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <Badge className="mt-3 rounded-full bg-primary/10 text-primary hover:bg-primary/10 gap-1"><ShieldCheck className="h-3 w-3" /> {ROLE_LABEL[user?.role]}</Badge>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="premium-card p-8">
            <h3 className="font-semibold text-charcoal mb-5">Informasi Profil</h3>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><Label className="mb-1.5 block text-sm">Nama Lengkap</Label><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="rounded-xl" data-testid="profile-name" /></div>
              <div><Label className="mb-1.5 block text-sm">Username</Label><Input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} className="rounded-xl" /></div>
              <div className="sm:col-span-2"><Label className="mb-1.5 block text-sm">URL Avatar</Label><Input value={profile.avatar} onChange={(e) => setProfile({ ...profile, avatar: e.target.value })} placeholder="https://..." className="rounded-xl" /></div>
            </div>
            <Button onClick={saveProfile} disabled={s1} className="rounded-xl gap-2 mt-6" data-testid="profile-save"><Save className="h-4 w-4" /> {s1 ? "Menyimpan..." : "Simpan Profil"}</Button>
          </div>

          <div className="premium-card p-8">
            <h3 className="font-semibold text-charcoal mb-5 flex items-center gap-2"><Lock className="h-4 w-4 text-gold" /> Ubah Kata Sandi</h3>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2"><Label className="mb-1.5 block text-sm">Kata Sandi Lama</Label><Input type="password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} className="rounded-xl" data-testid="pw-old" /></div>
              <div><Label className="mb-1.5 block text-sm">Kata Sandi Baru</Label><Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} className="rounded-xl" data-testid="pw-new" /></div>
              <div><Label className="mb-1.5 block text-sm">Konfirmasi</Label><Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="rounded-xl" data-testid="pw-confirm" /></div>
            </div>
            <Button onClick={changePw} disabled={s2} variant="outline" className="rounded-xl gap-2 mt-6 border-gold text-gold hover:bg-gold/5" data-testid="pw-save"><Lock className="h-4 w-4" /> {s2 ? "Memproses..." : "Ubah Kata Sandi"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
